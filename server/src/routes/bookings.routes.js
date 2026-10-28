import { Router } from 'express';
import { BookingService } from '../services/booking.service.js';
import { PricingService } from '../services/pricing.service.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookingQuoteSchema, createBookingSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { NotificationService } from '../services/notification.service.js';

const router = Router();

// POST /api/bookings/quote - Authoritative price calculation before booking
router.post('/bookings/quote', validate(bookingQuoteSchema), (req, res, next) => {
  try {
    const { equipmentId, startTime, endTime, handoverMethod, deliveryDistanceKm } = req.body;

    const equipment = memoryDb.tables.equipment.find(e => e.id === equipmentId);
    if (!equipment) throw new AppError('Equipment listing not found', 404, 'EQUIPMENT_NOT_FOUND');

    const pricingRule = memoryDb.tables.equipment_pricing_rules.find(pr => pr.equipment_id === equipmentId && pr.is_active);
    if (!pricingRule) throw new AppError('Pricing rules not configured for this machinery', 400, 'PRICING_NOT_CONFIGURED');

    const quote = PricingService.calculateQuote({
      equipment,
      pricingRule,
      startTime,
      endTime,
      handoverMethod,
      deliveryDistanceKm
    });

    const conflict = BookingService.checkConflict(equipmentId, startTime, endTime);

    res.json({
      success: true,
      data: {
        quote,
        isAvailable: !conflict.hasConflict,
        conflictDetails: conflict.hasConflict ? conflict.message : null
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings - Create booking request
router.post('/bookings', authenticate, validate(createBookingSchema), async (req, res, next) => {
  try {
    const {
      equipmentId,
      startTime,
      endTime,
      handoverMethod,
      deliveryAddress,
      deliveryDistanceKm,
      paymentMethod,
      notes
    } = req.body;

    const result = await BookingService.createBooking({
      renterId: req.user.id,
      equipmentId,
      startTime,
      endTime,
      handoverMethod,
      deliveryAddress,
      deliveryDistanceKm,
      paymentMethod,
      notes
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings - List user's bookings (as renter or owner)
router.get('/bookings', authenticate, (req, res, next) => {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    let bookings = memoryDb.tables.bookings.filter(b => {
      if (role === 'owner') return b.owner_id === userId;
      if (role === 'renter') return b.renter_id === userId;
      return b.renter_id === userId || b.owner_id === userId;
    });

    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }

    // Sort newest first
    bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Enrich with equipment & participant profiles
    const enriched = bookings.map(b => {
      const equip = memoryDb.tables.equipment.find(e => e.id === b.equipment_id);
      const owner = memoryDb.tables.profiles.find(p => p.id === b.owner_id);
      const renter = memoryDb.tables.profiles.find(p => p.id === b.renter_id);
      return {
        ...b,
        equipment: equip ? { id: equip.id, title: equip.title, image_url: '/assets/images/tractor.svg', state: equip.state, district: equip.district } : null,
        owner: owner ? { id: owner.id, full_name: owner.full_name, phone_number: owner.phone_number } : null,
        renter: renter ? { id: renter.id, full_name: renter.full_name, phone_number: renter.phone_number } : null
      };
    });

    const total = enriched.length;
    const offset = (page - 1) * limit;

    res.json({
      success: true,
      data: {
        bookings: enriched.slice(offset, offset + limit),
        pagination: { page: parseInt(page), limit: parseInt(limit), total }
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id - Booking details & status timeline
router.get('/bookings/:id', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

    // Access control
    if (booking.renter_id !== req.user.id && booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden: you are not authorized to view this booking', 403, 'FORBIDDEN');
    }

    const equip = memoryDb.tables.equipment.find(e => e.id === booking.equipment_id);
    const owner = memoryDb.tables.profiles.find(p => p.id === booking.owner_id);
    const renter = memoryDb.tables.profiles.find(p => p.id === booking.renter_id);
    const priceItems = memoryDb.tables.booking_price_items.filter(pi => pi.booking_id === booking.id);
    const statusHistory = memoryDb.tables.booking_status_history.filter(sh => sh.booking_id === booking.id);
    const payments = memoryDb.tables.payment_transactions.filter(pt => pt.booking_id === booking.id);

    res.json({
      success: true,
      data: {
        booking: {
          ...booking,
          // Show exact equipment address once confirmed
          exact_pickup_address: ['confirmed', 'active', 'completed'].includes(booking.status) ? equip?.exact_address : undefined,
          equipment: equip,
          owner: owner ? { id: owner.id, full_name: owner.full_name, phone: owner.phone_number, district: owner.district } : null,
          renter: renter ? { id: renter.id, full_name: renter.full_name, phone: renter.phone_number, district: renter.district } : null,
          priceItems,
          statusHistory,
          payments
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/approve - Owner approval
router.post('/bookings/:id/approve', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only the equipment owner can approve this booking', 403, 'FORBIDDEN');
    }

    const targetStatus = booking.payment_method === 'online' ? 'awaiting_payment' : 'confirmed';
    const updated = BookingService.transitionStatus(booking.id, targetStatus, req.user.id, 'Approved by equipment owner');

    NotificationService.createNotification({
      userId: booking.renter_id,
      title: 'Booking Approved!',
      message: `Your booking for machinery has been approved! Status: ${targetStatus}`,
      type: 'booking_status',
      linkUrl: `/bookings.html?id=${booking.id}`
    });

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/reject - Owner rejection
router.post('/bookings/:id/reject', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only the equipment owner can reject this booking', 403, 'FORBIDDEN');
    }

    const { reason } = req.body;
    booking.cancellation_reason = reason || 'Declined by owner';
    const updated = BookingService.transitionStatus(booking.id, 'rejected', req.user.id, reason || 'Owner declined request');

    NotificationService.createNotification({
      userId: booking.renter_id,
      title: 'Booking Request Declined',
      message: `Your booking was declined by the equipment owner. Reason: ${reason || 'Unavailable'}`,
      type: 'booking_status',
      linkUrl: `/bookings.html?id=${booking.id}`
    });

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/cancel - Cancellation
router.post('/bookings/:id/cancel', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.renter_id !== req.user.id && booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const { reason } = req.body;
    booking.cancellation_reason = reason || 'Cancelled by participant';
    booking.cancelled_by = req.user.id;
    booking.cancelled_at = new Date().toISOString();

    const updated = BookingService.transitionStatus(booking.id, 'cancelled', req.user.id, reason || 'Cancelled');

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/reschedule - Reschedule booking dates
router.post('/bookings/:id/reschedule', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.renter_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only the renter can request rescheduling', 403, 'FORBIDDEN');
    }

    const { newStartTime, newEndTime } = req.body;
    if (!newStartTime || !newEndTime) {
      throw new AppError('newStartTime and newEndTime are required', 400, 'MISSING_PARAMS');
    }

    // Check conflict excluding current booking
    const conflict = BookingService.checkConflict(booking.equipment_id, newStartTime, newEndTime, booking.id);
    if (conflict.hasConflict) {
      throw new AppError(`Cannot reschedule: ${conflict.message}`, 409, 'RESCHEDULE_CONFLICT');
    }

    booking.start_time = new Date(newStartTime).toISOString();
    booking.end_time = new Date(newEndTime).toISOString();
    booking.status = 'pending_owner'; // Re-requires owner confirmation
    booking.updated_at = new Date().toISOString();

    memoryDb.tables.booking_status_history.push({
      id: `bsh-${booking.id}-${Date.now()}`,
      booking_id: booking.id,
      from_status: booking.status,
      to_status: 'pending_owner',
      changed_by: req.user.id,
      notes: `Rescheduled to ${newStartTime} - ${newEndTime}`,
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: { booking }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/check-in - Handover/check-in confirmation
router.post('/bookings/:id/check-in', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only equipment owner can record physical equipment handover', 403, 'FORBIDDEN');
    }

    booking.checked_in_at = new Date().toISOString();
    booking.handover_notes = req.body.notes || 'Equipment inspected and handed over successfully';
    const updated = BookingService.transitionStatus(booking.id, 'active', req.user.id, 'Equipment checked-in and active');

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/return - Return inspection
router.post('/bookings/:id/return', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only equipment owner can confirm return', 403, 'FORBIDDEN');
    }

    booking.returned_at = new Date().toISOString();
    booking.return_notes = req.body.notes || 'Equipment returned in good working condition';
    const updated = BookingService.transitionStatus(booking.id, 'completed', req.user.id, 'Equipment returned and rental completed');

    res.json({
      success: true,
      data: { booking: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/bookings/:id/complete - Mark completed
router.post('/bookings/:id/complete', authenticate, (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const updated = BookingService.transitionStatus(booking.id, 'completed', req.user.id, 'Completed');
    res.json({ success: true, data: { booking: updated } });
  } catch (err) {
    next(err);
  }
});

export default router;

