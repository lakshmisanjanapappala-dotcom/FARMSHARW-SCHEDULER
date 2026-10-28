import crypto from 'crypto';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { logAuditEvent } from '../middleware/audit.js';

export class PaymentService {
  /**
   * Create Checkout Session for Online Payment
   */
  static async createCheckoutSession({ bookingId, userId, successUrl, cancelUrl }) {
    const booking = memoryDb.tables.bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.renter_id !== userId) {
      throw new AppError('Only the booking renter can initiate payment', 403, 'FORBIDDEN');
    }

    const transactionRef = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const mockGatewayOrderId = 'order_mock_' + Math.random().toString(36).substr(2, 9);

    const transaction = {
      id: 'ptxn-' + Date.now(),
      booking_id: bookingId,
      transaction_reference: transactionRef,
      gateway_order_id: mockGatewayOrderId,
      gateway_payment_id: null,
      gateway_provider: 'mock',
      amount: booking.total_amount,
      currency: booking.currency || 'INR',
      status: 'pending',
      payment_method: 'online',
      recorded_by: userId,
      metadata: {
        booking_reference: booking.booking_reference,
        renter_id: userId
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.payment_transactions.push(transaction);

    return {
      transactionReference: transactionRef,
      gatewayOrderId: mockGatewayOrderId,
      amount: booking.total_amount,
      currency: booking.currency,
      provider: 'mock',
      checkoutUrl: `/dashboard.html?pay_session=${transactionRef}&booking_id=${bookingId}`
    };
  }

  /**
   * Verify and process webhook event with idempotent record keeping
   */
  static async processWebhook(provider, signature, rawBody, payload) {
    const eventId = payload.event_id || payload.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // 1. Check idempotency: If event already processed, return 200 immediately
    const existingEvent = memoryDb.tables.payment_webhook_events.find(
      e => e.provider === provider && e.event_id === eventId
    );

    if (existingEvent && existingEvent.processed_status === 'processed') {
      return { status: 'already_processed', eventId };
    }

    // 2. Signature verification
    if (provider === 'razorpay' && process.env.PAYMENT_WEBHOOK_SECRET) {
      const expectedSig = crypto
        .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (expectedSig !== signature) {
        throw new AppError('Invalid webhook cryptographic signature', 400, 'INVALID_SIGNATURE');
      }
    }

    // 3. Record webhook event in database
    const webhookRecord = {
      id: 'whevt-' + Date.now(),
      provider,
      event_id: eventId,
      event_type: payload.event || 'payment.captured',
      payload,
      processed_status: 'pending',
      created_at: new Date().toISOString(),
      processed_at: null
    };
    memoryDb.tables.payment_webhook_events.push(webhookRecord);

    // 4. Update transaction status
    const orderId = payload.order_id || payload.payload?.payment?.entity?.order_id;
    const paymentId = payload.payment_id || payload.payload?.payment?.entity?.id || 'pay_mock_' + Date.now();

    const transaction = memoryDb.tables.payment_transactions.find(
      t => t.gateway_order_id === orderId || t.transaction_reference === payload.transaction_reference
    );

    if (transaction) {
      transaction.status = 'captured';
      transaction.gateway_payment_id = paymentId;
      transaction.updated_at = new Date().toISOString();

      // Update booking status
      const booking = memoryDb.tables.bookings.find(b => b.id === transaction.booking_id);
      if (booking) {
        booking.payment_status = 'captured';
        if (booking.status === 'awaiting_payment') {
          booking.status = 'confirmed';
        }
        booking.updated_at = new Date().toISOString();
      }
    }

    webhookRecord.processed_status = 'processed';
    webhookRecord.processed_at = new Date().toISOString();

    return { status: 'processed', eventId };
  }

  /**
   * Record Cash on Pickup collection with strict audit trail
   */
  static async recordCashPayment({ bookingId, amountCollected, recordedBy, notes }) {
    const booking = memoryDb.tables.bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Only owner of the machinery or admin can mark cash as collected
    if (booking.owner_id !== recordedBy.id && !recordedBy.roles?.includes('admin')) {
      throw new AppError('Only the equipment owner or platform admin can record cash receipt', 403, 'FORBIDDEN');
    }

    const transactionRef = 'CSH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

    const cashTxn = {
      id: 'ptxn-' + Date.now(),
      booking_id: bookingId,
      transaction_reference: transactionRef,
      gateway_order_id: null,
      gateway_payment_id: null,
      gateway_provider: 'cash',
      amount: parseFloat(amountCollected),
      currency: booking.currency || 'INR',
      status: 'captured',
      payment_method: 'cash_on_pickup',
      recorded_by: recordedBy.id,
      metadata: {
        collector_name: recordedBy.profile?.full_name || 'Owner',
        collector_id: recordedBy.id,
        notes: notes || 'Cash collected directly during handover'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.payment_transactions.push(cashTxn);

    // Update booking payment status
    booking.payment_status = 'captured';
    booking.updated_at = new Date().toISOString();

    await logAuditEvent({
      actorId: recordedBy.id,
      action: 'RECORD_CASH_COLLECTION',
      entityType: 'booking',
      entityId: bookingId,
      newData: { transactionRef, amountCollected, collectedBy: recordedBy.id }
    });

    return cashTxn;
  }

  /**
   * Process Server-Side Refund Request with cancellation policy calculation
   */
  static async processRefund({ bookingId, reason, actorId }) {
    const booking = memoryDb.tables.bookings.find(b => b.id === bookingId);
    if (!booking) {
      throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Cancellation policy calculation:
    // If cancelled > 48h before start: 100% refund of base rent + deposit
    // If cancelled 24h-48h before start: 70% refund of base rent + 100% deposit
    // If cancelled < 24h before start: 30% refund of base rent + 100% deposit
    // (Platform fee is non-refundable if cancellation initiated by renter)
    const now = Date.now();
    const startTime = new Date(booking.start_time).getTime();
    const hoursBeforeStart = (startTime - now) / (1000 * 60 * 60);

    let refundRatio = 1.0;
    if (hoursBeforeStart < 24) {
      refundRatio = 0.3;
    } else if (hoursBeforeStart < 48) {
      refundRatio = 0.7;
    }

    const refundableBase = booking.base_rental_amount * refundRatio;
    const refundableDeposit = booking.deposit_amount || 0;
    const totalRefundAmount = Math.round((refundableBase + refundableDeposit) * 100) / 100;

    const refundId = 'ref-' + Date.now();
    const refundRef = 'REF-' + Date.now();

    const refundRecord = {
      id: refundId,
      booking_id: bookingId,
      refund_reference: refundRef,
      amount: totalRefundAmount,
      currency: booking.currency || 'INR',
      reason: reason || 'Customer requested cancellation',
      status: 'processed',
      authorized_by: actorId,
      created_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    };

    memoryDb.tables.refunds.push(refundRecord);

    booking.status = 'cancelled';
    booking.cancellation_reason = reason;
    booking.cancelled_by = actorId;
    booking.cancelled_at = new Date().toISOString();

    return refundRecord;
  }
}

