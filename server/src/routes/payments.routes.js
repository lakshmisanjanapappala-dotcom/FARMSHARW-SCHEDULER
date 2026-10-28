import { Router } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cashPaymentSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// POST /api/payments/checkout - Initiate checkout
router.post('/payments/checkout', authenticate, async (req, res, next) => {
  try {
    const { bookingId, successUrl, cancelUrl } = req.body;
    if (!bookingId) throw new AppError('bookingId is required', 400, 'MISSING_BOOKING_ID');

    const session = await PaymentService.createCheckoutSession({
      bookingId,
      userId: req.user.id,
      successUrl,
      cancelUrl
    });

    res.json({
      success: true,
      data: session
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook/:provider - Webhook listener
router.post('/payments/webhook/:provider', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const signature = req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'] || '';
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const result = await PaymentService.processWebhook(provider, signature, rawBody, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id - Get payment details
router.get('/payments/:id', authenticate, (req, res, next) => {
  try {
    const txn = memoryDb.tables.payment_transactions.find(
      t => t.id === req.params.id || t.transaction_reference === req.params.id
    );
    if (!txn) throw new AppError('Payment transaction not found', 404, 'NOT_FOUND');

    res.json({
      success: true,
      data: { payment: txn }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id/payments - Get payments for a booking
router.get('/bookings/:id/payments', authenticate, (req, res) => {
  const payments = memoryDb.tables.payment_transactions.filter(pt => pt.booking_id === req.params.id);
  res.json({
    success: true,
    data: { payments }
  });
});

// POST /api/bookings/:id/cash-payment-record - Record physical cash collection
router.post('/bookings/:id/cash-payment-record', authenticate, validate(cashPaymentSchema), async (req, res, next) => {
  try {
    const { amountCollected, notes } = req.body;
    const cashTxn = await PaymentService.recordCashPayment({
      bookingId: req.params.id,
      amountCollected,
      recordedBy: req.user,
      notes
    });

    res.status(201).json({
      success: true,
      data: { transaction: cashTxn }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/refunds - Submit refund request
router.post('/refunds', authenticate, async (req, res, next) => {
  try {
    const { bookingId, reason } = req.body;
    if (!bookingId) throw new AppError('bookingId is required', 400, 'MISSING_BOOKING_ID');

    const refund = await PaymentService.processRefund({
      bookingId,
      reason,
      actorId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: { refund }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/refunds/:id - Get refund details
router.get('/refunds/:id', authenticate, (req, res, next) => {
  try {
    const refund = memoryDb.tables.refunds.find(r => r.id === req.params.id || r.refund_reference === req.params.id);
    if (!refund) throw new AppError('Refund record not found', 404, 'NOT_FOUND');

    res.json({
      success: true,
      data: { refund }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

