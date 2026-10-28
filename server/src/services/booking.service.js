import { memoryDb, isLiveSupabase, supabaseAdmin } from '../config/supabase.js';
import { PricingService } from './pricing.service.js';
import { AppError } from '../middleware/error-handler.js';
import { NotificationService } from './notification.service.js';

// Valid transitions dictionary
const VALID_TRANSITIONS = {
  draft: ['pending_owner', 'cancelled'],
  pending_owner: ['awaiting_payment', 'confirmed', 'rejected', 'cancelled', 'expired'],
  awaiting_payment: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['active', 'cancelled', 'disputed'],
  active: ['completed', 'disputed'],
  completed: ['disputed'],
  rejected: [],
  cancelled: [],
  expired: [],
  disputed: ['completed', 'cancelled']
};

export class BookingService {
  /**
   * Check for conflicting overlapping active reservations or blackouts
   * Enforces half-open interval [start, end)
   */
  static checkConflict(equipmentId, startTimeStr, endTimeStr, excludeBookingId = null) {
    const reqStart = new Date(startTimeStr).getTime();
    const reqEnd = new Date(endTimeStr).getTime();

    // 1. Check existing active bookings
    const activeStatuses = ['pending_owner', 'awaiting_payment', 'confirmed', 'active'];
    const conflictingBooking = memoryDb.tables.bookings.find(b => {
      if (b.equipment_id !== equipmentId) return false;
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (!activeStatuses.includes(b.status)) return false;

      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();

      // Half-open interval overlap: max(reqStart, bStart) < min(reqEnd, bEnd)
      return Math.max(reqStart, bStart) < Math.min(reqEnd, bEnd);
    });

    if (conflictingBooking) {
      return {
        hasConflict: true,
        reason: 'BOOKING_CONFLICT',
        message: `This equipment is already reserved from ${new Date(conflictingBooking.start_time).toLocaleString('en-IN')} to ${new Date(conflictingBooking.end_time).toLocaleString('en-IN')}.`,
        conflictingId: conflictingBooking.id
      };
    }

    // 2. Check active exchange reservations
    const conflictingExchange = memoryDb.tables.exchange_reservations.find(xr => {
      if (xr.equipment_id !== equipmentId || !xr.is_active) return false;
      const xStart = new Date(xr.start_time).getTime();
      const xEnd = new Date(xr.end_time).getTime();
      return Math.max(reqStart, xStart) < Math.min(reqEnd, xEnd);
    });

    if (conflictingExchange) {
      return {
        hasConflict: true,
        reason: 'EXCHANGE_RESERVATION_CONFLICT',
        message: 'This equipment is committed to an active agricultural idle-time exchange during the selected dates.'
      };
    }

    // 3. Check blackout periods
    const conflictingBlackout = memoryDb.tables.equipment_blackout_periods.find(bp => {
      if (bp.equipment_id !== equipmentId) return false;
      const bpStart = new Date(bp.start_time).getTime();
      const bpEnd = new Date(bp.end_time).getTime();
      return Math.max(reqStart, bpStart) < Math.min(reqEnd, bpEnd);
    });

    if (conflictingBlackout) {
      return {
        hasConflict: true,
        reason: 'BLACKOUT_CONFLICT',
        message: `This equipment is unavailable due to owner blackout: ${conflictingBlackout.reason || 'Scheduled maintenance/personal use'}.`
      };
    }

    return { hasConflict: false };
  }

  /**
   * Authoritative Booking Request Creation
   */
  static async createBooking({
    renterId,
    equipmentId,
    startTime,
    endTime,
    handoverMethod,
    deliveryAddress,
    deliveryDistanceKm = 0,
    paymentMethod = 'cash_on_pickup',
    notes = ''
  }) {
    // 1. Fetch equipment
    const equipment = memoryDb.tables.equipment.find(e => e.id === equipmentId);
    if (!equipment) {
      throw new AppError('Specified equipment listing does not exist', 404, 'EQUIPMENT_NOT_FOUND');
    }

    if (!equipment.is_published) {
      throw new AppError('This equipment listing is currently not published for rental', 400, 'EQUIPMENT_UNPUBLISHED');
    }

    if (equipment.maintenance_status !== 'operational') {
      throw new AppError(
        `Equipment is currently ${equipment.maintenance_status.replace('_', ' ')} and cannot accept new bookings`,
        400,
        'EQUIPMENT_UNDER_MAINTENANCE'
      );
    }

    if (equipment.owner_id === renterId) {
      throw new AppError('You cannot rent your own equipment', 400, 'SELF_RENTAL_PROHIBITED');
    }

    // 2. Concurrency Conflict Prevention
    const conflictResult = this.checkConflict(equipmentId, startTime, endTime);
    if (conflictResult.hasConflict) {
      throw new AppError(conflictResult.message, 409, conflictResult.reason);
    }

    // 3. Fetch Pricing Rule and calculate quote authoritatively
    const pricingRule = memoryDb.tables.equipment_pricing_rules.find(pr => pr.equipment_id === equipmentId && pr.is_active);
    if (!pricingRule) {
      throw new AppError('Active pricing rules not configured for this machinery', 400, 'PRICING_NOT_CONFIGURED');
    }

    const quote = PricingService.calculateQuote({
      equipment,
      pricingRule,
      startTime,
      endTime,
      handoverMethod,
      deliveryDistanceKm
    });

    // 4. Determine initial status based on listing approval policy and payment method
    let initialStatus = 'pending_owner';
    if (equipment.booking_approval_policy === 'instant') {
      initialStatus = paymentMethod === 'online' ? 'awaiting_payment' : 'confirmed';
    }

    const bookingId = 'bk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const bookingRef = 'FSB-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);

    const newBooking = {
      id: bookingId,
      booking_reference: bookingRef,
      equipment_id: equipmentId,
      renter_id: renterId,
      owner_id: equipment.owner_id,
      status: initialStatus,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      rental_duration_hours: quote.durationHours,
      handover_method: handoverMethod,
      delivery_address: deliveryAddress || null,
      delivery_distance_km: deliveryDistanceKm,
      currency: quote.currency,
      base_rental_amount: quote.baseRentalAmount,
      delivery_fee: quote.deliveryFee,
      deposit_amount: quote.depositAmount,
      discount_amount: quote.discountAmount,
      platform_fee: quote.platformFee,
      tax_amount: quote.taxAmount,
      total_amount: quote.totalAmount,
      payment_method: paymentMethod,
      payment_status: 'pending',
      handover_notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Atomic Insertion
    memoryDb.tables.bookings.push(newBooking);

    // Record line items
    quote.lineItems.forEach((item, idx) => {
      memoryDb.tables.booking_price_items.push({
        id: `bpi-${bookingId}-${idx}`,
        booking_id: bookingId,
        item_type: item.item_type,
        description: item.description,
        rate: item.rate,
        quantity: item.quantity,
        amount: item.amount,
        created_at: new Date().toISOString()
      });
    });

    // Record status history
    memoryDb.tables.booking_status_history.push({
      id: `bsh-${bookingId}-init`,
      booking_id: bookingId,
      from_status: null,
      to_status: initialStatus,
      changed_by: renterId,
      notes: `Booking request created (${equipment.booking_approval_policy} policy)`,
      created_at: new Date().toISOString()
    });

    // Notify Owner
    NotificationService.createNotification({
      userId: equipment.owner_id,
      title: 'New Equipment Booking Request',
      message: `Farmer has requested to book "${equipment.title}" for ₹${quote.totalAmount}. Ref: ${bookingRef}`,
      type: 'booking_request',
      linkUrl: `/bookings.html?id=${bookingId}`
    });

    return { booking: newBooking, quote };
  }

  /**
   * Validate state transition and update status
   */
  static transitionStatus(bookingId, targetStatus, actorId, notes = '') {
    const booking = memoryDb.tables.bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    const currentStatus = booking.status;
    const allowedTargets = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedTargets.includes(targetStatus)) {
      throw new AppError(
        `Invalid status transition from "${currentStatus}" to "${targetStatus}". Permitted transitions: ${allowedTargets.join(', ') || 'none'}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    booking.status = targetStatus;
    booking.updated_at = new Date().toISOString();

    memoryDb.tables.booking_status_history.push({
      id: `bsh-${bookingId}-${Date.now()}`,
      booking_id: bookingId,
      from_status: currentStatus,
      to_status: targetStatus,
      changed_by: actorId,
      notes: notes || `Status changed to ${targetStatus}`,
      created_at: new Date().toISOString()
    });

    return booking;
  }
}

