import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { NotificationService } from '../services/notification.service.js';

const router = Router();

// GET /api/notifications
router.get('/notifications', authenticate, (req, res) => {
  const result = NotificationService.getUserNotifications(req.user.id);
  res.json({
    success: true,
    data: result
  });
});

// POST /api/notifications/:id/read
router.post('/notifications/:id/read', authenticate, (req, res) => {
  const updated = NotificationService.markAsRead(req.params.id, req.user.id);
  res.json({
    success: true,
    data: { notification: updated }
  });
});

// POST /api/notifications/read-all
router.post('/notifications/read-all', authenticate, (req, res) => {
  NotificationService.markAllAsRead(req.user.id);
  res.json({
    success: true,
    data: { message: 'All notifications marked as read' }
  });
});

export default router;

