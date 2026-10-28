import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createDisputeSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// POST /api/disputes - Open dispute
router.post('/disputes', authenticate, validate(createDisputeSchema), (req, res, next) => {
  try {
    const { bookingId, exchangeId, againstUserId, reason, desiredResolution } = req.body;

    const disputeId = 'dsp-' + Date.now();
    const disputeRef = 'DSP-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);

    const dispute = {
      id: disputeId,
      dispute_reference: disputeRef,
      booking_id: bookingId || null,
      exchange_id: exchangeId || null,
      opened_by: req.user.id,
      against_user_id: againstUserId,
      reason,
      desired_resolution: desiredResolution || null,
      status: 'opened',
      admin_notes: null,
      resolution_summary: null,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.disputes.push(dispute);

    // If linked to booking, flag booking as disputed
    if (bookingId) {
      const booking = memoryDb.tables.bookings.find(b => b.id === bookingId);
      if (booking) {
        booking.status = 'disputed';
        booking.updated_at = new Date().toISOString();
      }
    }

    res.status(201).json({
      success: true,
      data: { dispute }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/disputes - List disputes for user
router.get('/disputes', authenticate, (req, res) => {
  const userId = req.user.id;
  const disputes = memoryDb.tables.disputes.filter(
    d => d.opened_by === userId || d.against_user_id === userId
  );

  res.json({
    success: true,
    data: { disputes }
  });
});

export default router;

