import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { NotificationService } from '../services/notification.service.js';

const router = Router();

// GET /api/conversations - List conversations for user
router.get('/conversations', authenticate, (req, res) => {
  const userId = req.user.id;
  const participantRecords = memoryDb.tables.conversation_participants.filter(cp => cp.user_id === userId);
  const conversationIds = participantRecords.map(cp => cp.conversation_id);

  const convos = memoryDb.tables.conversations
    .filter(c => conversationIds.includes(c.id))
    .map(c => {
      const participants = memoryDb.tables.conversation_participants
        .filter(cp => cp.conversation_id === c.id)
        .map(cp => {
          const profile = memoryDb.tables.profiles.find(p => p.id === cp.user_id);
          return { userId: cp.user_id, fullName: profile?.full_name || 'Farmer' };
        });

      const lastMessage = memoryDb.tables.messages
        .filter(m => m.conversation_id === c.id)
        .slice(-1)[0] || null;

      return {
        ...c,
        participants,
        lastMessage
      };
    });

  convos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  res.json({
    success: true,
    data: { conversations: convos }
  });
});

// POST /api/conversations - Start or find conversation
router.post('/conversations', authenticate, (req, res, next) => {
  try {
    const { recipientId, bookingId, exchangeId, equipmentId, subject, initialMessage } = req.body;
    if (!recipientId) throw new AppError('recipientId is required', 400, 'MISSING_RECIPIENT');

    // Find existing conversation between the two parties
    let convo = memoryDb.tables.conversations.find(c => {
      const parts = memoryDb.tables.conversation_participants.filter(cp => cp.conversation_id === c.id).map(cp => cp.user_id);
      return parts.includes(req.user.id) && parts.includes(recipientId);
    });

    if (!convo) {
      const convoId = 'conv-' + Date.now();
      convo = {
        id: convoId,
        booking_id: bookingId || null,
        exchange_id: exchangeId || null,
        equipment_id: equipmentId || null,
        subject: subject || 'Equipment Inquiry',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryDb.tables.conversations.push(convo);

      memoryDb.tables.conversation_participants.push(
        { id: `cp-${convoId}-1`, conversation_id: convoId, user_id: req.user.id, last_read_at: new Date().toISOString(), created_at: new Date().toISOString() },
        { id: `cp-${convoId}-2`, conversation_id: convoId, user_id: recipientId, last_read_at: null, created_at: new Date().toISOString() }
      );
    }

    if (initialMessage) {
      const msgId = 'msg-' + Date.now();
      const msg = {
        id: msgId,
        conversation_id: convo.id,
        sender_id: req.user.id,
        body: initialMessage,
        is_read: false,
        created_at: new Date().toISOString()
      };
      memoryDb.tables.messages.push(msg);

      NotificationService.createNotification({
        userId: recipientId,
        title: 'New Message Received',
        message: `${req.user.profile?.full_name || 'A user'} sent you a message: "${initialMessage.substring(0, 60)}..."`,
        type: 'message',
        linkUrl: `/messages.html?convo=${convo.id}`
      });
    }

    res.status(201).json({
      success: true,
      data: { conversation: convo }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages - Get messages in a conversation
router.get('/conversations/:id/messages', authenticate, (req, res, next) => {
  try {
    const convoId = req.params.id;
    const isParticipant = memoryDb.tables.conversation_participants.some(
      cp => cp.conversation_id === convoId && cp.user_id === req.user.id
    );

    if (!isParticipant && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden: you are not a participant in this conversation', 403, 'FORBIDDEN');
    }

    const messages = memoryDb.tables.messages
      .filter(m => m.conversation_id === convoId)
      .map(m => {
        const sender = memoryDb.tables.profiles.find(p => p.id === m.sender_id);
        return {
          ...m,
          sender_name: sender ? sender.full_name : 'User'
        };
      });

    // Mark messages as read for this user
    messages.forEach(m => {
      if (m.sender_id !== req.user.id) {
        m.is_read = true;
      }
    });

    res.json({
      success: true,
      data: { messages }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', authenticate, (req, res, next) => {
  try {
    const convoId = req.params.id;
    const { body } = req.body;
    if (!body || !body.trim()) throw new AppError('Message body cannot be empty', 400, 'EMPTY_MESSAGE');

    const participants = memoryDb.tables.conversation_participants.filter(cp => cp.conversation_id === convoId);
    const isParticipant = participants.some(cp => cp.user_id === req.user.id);

    if (!isParticipant && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden: you are not a participant in this conversation', 403, 'FORBIDDEN');
    }

    const msg = {
      id: 'msg-' + Date.now(),
      conversation_id: convoId,
      sender_id: req.user.id,
      body: body.trim(),
      is_read: false,
      created_at: new Date().toISOString()
    };
    memoryDb.tables.messages.push(msg);

    // Update conversation updated_at
    const convo = memoryDb.tables.conversations.find(c => c.id === convoId);
    if (convo) convo.updated_at = new Date().toISOString();

    // Notify other participants
    const otherParticipants = participants.filter(cp => cp.user_id !== req.user.id);
    otherParticipants.forEach(op => {
      NotificationService.createNotification({
        userId: op.user_id,
        title: 'New Message Received',
        message: `${req.user.profile?.full_name || 'A user'} sent you a message: "${body.substring(0, 50)}..."`,
        type: 'message',
        linkUrl: `/messages.html?convo=${convoId}`
      });
    });

    res.status(201).json({
      success: true,
      data: { message: msg }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

