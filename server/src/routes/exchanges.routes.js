import { Router } from 'express';
import { ExchangeService } from '../services/exchange.service.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createExchangeSchema, counterExchangeSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// GET /api/exchanges/match-score - Explainable match score between two machines
router.get('/exchanges/match-score', (req, res, next) => {
  try {
    const { offeredId, requestedId } = req.query;
    if (!offeredId || !requestedId) {
      throw new AppError('offeredId and requestedId query parameters are required', 400, 'MISSING_PARAMS');
    }

    const offered = memoryDb.tables.equipment.find(e => e.id === offeredId);
    const requested = memoryDb.tables.equipment.find(e => e.id === requestedId);

    if (!offered || !requested) {
      throw new AppError('One or both equipment listings could not be found', 404, 'EQUIPMENT_NOT_FOUND');
    }

    const matchAnalysis = ExchangeService.calculateMatchScore(offered, requested);

    res.json({
      success: true,
      data: matchAnalysis
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/exchanges - Propose Idle-Time Exchange
router.post('/exchanges', authenticate, validate(createExchangeSchema), async (req, res, next) => {
  try {
    const {
      offeredEquipmentId,
      requestedEquipmentId,
      offeredStartTime,
      offeredEndTime,
      requestedStartTime,
      requestedEndTime,
      cashAdjustmentAmount,
      cashPayerId,
      termsAgreement,
      notes
    } = req.body;

    const proposal = await ExchangeService.proposeExchange({
      proposerId: req.user.id,
      offeredEquipmentId,
      requestedEquipmentId,
      offeredStartTime,
      offeredEndTime,
      requestedStartTime,
      requestedEndTime,
      cashAdjustmentAmount,
      cashPayerId,
      termsAgreement,
      notes
    });

    res.status(201).json({
      success: true,
      data: { exchange: proposal }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/exchanges - List user's exchanges
router.get('/exchanges', authenticate, (req, res, next) => {
  try {
    const userId = req.user.id;
    const exchanges = memoryDb.tables.exchange_proposals.filter(
      x => x.proposer_id === userId || x.recipient_id === userId
    );

    const enriched = exchanges.map(x => {
      const items = memoryDb.tables.exchange_proposal_items.filter(item => item.exchange_id === x.id);
      const participants = memoryDb.tables.exchange_participants.filter(p => p.exchange_id === x.id);
      const proposer = memoryDb.tables.profiles.find(p => p.id === x.proposer_id);
      const recipient = memoryDb.tables.profiles.find(p => p.id === x.recipient_id);

      return {
        ...x,
        items: items.map(item => {
          const equip = memoryDb.tables.equipment.find(e => e.id === item.equipment_id);
          return {
            ...item,
            equipment: equip ? { id: equip.id, title: equip.title, image_url: '/assets/images/tractor.svg', state: equip.state, district: equip.district } : null
          };
        }),
        participants,
        proposer: proposer ? { id: proposer.id, full_name: proposer.full_name } : null,
        recipient: recipient ? { id: recipient.id, full_name: recipient.full_name } : null
      };
    });

    // Sort newest first
    enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: { exchanges: enriched }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/exchanges/:id - Exchange details
router.get('/exchanges/:id', authenticate, (req, res, next) => {
  try {
    const exchange = memoryDb.tables.exchange_proposals.find(x => x.id === req.params.id);
    if (!exchange) throw new AppError('Exchange proposal not found', 404, 'EXCHANGE_NOT_FOUND');

    if (exchange.proposer_id !== req.user.id && exchange.recipient_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden: you are not a participant in this exchange', 403, 'FORBIDDEN');
    }

    const items = memoryDb.tables.exchange_proposal_items.filter(item => item.exchange_id === exchange.id);
    const participants = memoryDb.tables.exchange_participants.filter(p => p.exchange_id === exchange.id);
    const reservations = memoryDb.tables.exchange_reservations.filter(xr => xr.exchange_id === exchange.id);
    const proposer = memoryDb.tables.profiles.find(p => p.id === exchange.proposer_id);
    const recipient = memoryDb.tables.profiles.find(p => p.id === exchange.recipient_id);

    const enrichedItems = items.map(item => {
      const equip = memoryDb.tables.equipment.find(e => e.id === item.equipment_id);
      return {
        ...item,
        equipment: equip
      };
    });

    res.json({
      success: true,
      data: {
        exchange: {
          ...exchange,
          items: enrichedItems,
          participants,
          reservations,
          proposer,
          recipient
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/exchanges/:id/counteroffer - Submit counterproposal
router.post('/exchanges/:id/counteroffer', authenticate, validate(counterExchangeSchema), async (req, res, next) => {
  try {
    const { cashAdjustmentAmount, notes } = req.body;
    const updated = await ExchangeService.submitCounteroffer(req.params.id, req.user.id, {
      cashAdjustmentAmount,
      notes
    });

    res.json({
      success: true,
      data: { exchange: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/exchanges/:id/accept - Accept exchange proposal
router.post('/exchanges/:id/accept', authenticate, async (req, res, next) => {
  try {
    const updated = await ExchangeService.acceptAndConfirm(req.params.id, req.user.id);
    res.json({
      success: true,
      data: { exchange: updated }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/exchanges/:id/reject - Reject exchange proposal
router.post('/exchanges/:id/reject', authenticate, (req, res, next) => {
  try {
    const exchange = memoryDb.tables.exchange_proposals.find(x => x.id === req.params.id);
    if (!exchange) throw new AppError('Exchange not found', 404, 'EXCHANGE_NOT_FOUND');
    if (exchange.proposer_id !== req.user.id && exchange.recipient_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    exchange.status = 'rejected';
    exchange.cancellation_reason = req.body.reason || 'Exchange declined';
    exchange.updated_at = new Date().toISOString();

    res.json({
      success: true,
      data: { exchange }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/exchanges/:id/cancel - Cancel proposal
router.post('/exchanges/:id/cancel', authenticate, (req, res, next) => {
  try {
    const exchange = memoryDb.tables.exchange_proposals.find(x => x.id === req.params.id);
    if (!exchange) throw new AppError('Exchange not found', 404, 'EXCHANGE_NOT_FOUND');
    if (exchange.proposer_id !== req.user.id && exchange.recipient_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    exchange.status = 'cancelled';
    exchange.cancellation_reason = req.body.reason || 'Cancelled by participant';
    exchange.updated_at = new Date().toISOString();

    // Release reservations if any
    memoryDb.tables.exchange_reservations
      .filter(xr => xr.exchange_id === exchange.id)
      .forEach(xr => { xr.is_active = false; });

    res.json({
      success: true,
      data: { exchange }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/exchanges/:id/confirm - Final confirmation
router.post('/exchanges/:id/confirm', authenticate, async (req, res, next) => {
  try {
    const updated = await ExchangeService.acceptAndConfirm(req.params.id, req.user.id);
    res.json({
      success: true,
      data: { exchange: updated }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

