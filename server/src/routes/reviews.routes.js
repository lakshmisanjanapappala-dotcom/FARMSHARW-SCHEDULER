import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReviewSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// POST /api/bookings/:id/reviews - Submit review (eligible completed transactions only)
router.post('/bookings/:id/reviews', authenticate, validate(createReviewSchema), (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

    if (booking.status !== 'completed') {
      throw new AppError('Reviews can only be submitted for completed transactions', 400, 'TRANSACTION_NOT_COMPLETED');
    }

    if (booking.renter_id !== req.user.id && booking.owner_id !== req.user.id) {
      throw new AppError('Only participants in this transaction can leave a review', 403, 'FORBIDDEN');
    }

    // Check duplicate review
    const existing = memoryDb.tables.reviews.find(r => r.booking_id === booking.id && r.author_id === req.user.id);
    if (existing) {
      throw new AppError('You have already submitted a review for this transaction', 400, 'DUPLICATE_REVIEW');
    }

    const recipientId = booking.renter_id === req.user.id ? booking.owner_id : booking.renter_id;
    const { rating, comment } = req.body;

    const review = {
      id: 'rev-' + Date.now(),
      booking_id: booking.id,
      equipment_id: booking.equipment_id,
      author_id: req.user.id,
      recipient_id: recipientId,
      rating,
      comment,
      is_visible: true,
      created_at: new Date().toISOString()
    };

    memoryDb.tables.reviews.push(review);

    res.status(201).json({
      success: true,
      data: { review }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id/reviews - Reviews for a machine
router.get('/equipment/:id/reviews', (req, res) => {
  const reviews = memoryDb.tables.reviews
    .filter(r => r.equipment_id === req.params.id && r.is_visible)
    .map(r => {
      const author = memoryDb.tables.profiles.find(p => p.id === r.author_id);
      return {
        ...r,
        author_name: author ? author.full_name : 'Verified Farmer'
      };
    });

  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : null;

  res.json({
    success: true,
    data: {
      averageRating: avgRating ? parseFloat(avgRating) : null,
      totalReviews: reviews.length,
      reviews
    }
  });
});

export default router;

