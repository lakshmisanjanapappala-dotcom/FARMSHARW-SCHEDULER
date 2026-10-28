import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { BookingService } from './booking.service.js';
import { NotificationService } from './notification.service.js';

export class ExchangeService {
  /**
   * Explainable Match Score Calculator between two equipment listings
   */
  static calculateMatchScore(offeredEquipment, requestedEquipment) {
    const reasons = [];
    let score = 50; // Baseline

    // Check if both eligible
    if (!offeredEquipment.is_exchange_eligible || !requestedEquipment.is_exchange_eligible) {
      return { score: 0, eligible: false, reasons: ['One or both machines are not marked eligible for exchange'] };
    }

    // Distance calculation
    if (offeredEquipment.state === requestedEquipment.state) {
      score += 20;
      reasons.push(`Both machines located in ${offeredEquipment.state}`);
      if (offeredEquipment.district === requestedEquipment.district) {
        score += 15;
        reasons.push(`Same district (${offeredEquipment.district}) - minimal transport required`);
      }
    } else {
      reasons.push(`Inter-state exchange (${offeredEquipment.state} to ${requestedEquipment.state})`);
    }

    // Condition compatibility
    if (offeredEquipment.condition === requestedEquipment.condition) {
      score += 10;
      reasons.push(`Equal machine conditions (${offeredEquipment.condition})`);
    }

    // Complementary utility check (e.g., Tractor + Harvester / Rotavator)
    if (
      (offeredEquipment.title.toLowerCase().includes('tractor') && requestedEquipment.title.toLowerCase().includes('rotavator')) ||
      (offeredEquipment.title.toLowerCase().includes('rotavator') && requestedEquipment.title.toLowerCase().includes('tractor')) ||
      (offeredEquipment.title.toLowerCase().includes('harvester') && requestedEquipment.title.toLowerCase().includes('tractor'))
    ) {
      score += 15;
      reasons.push('Highly complementary agricultural implements for seasonal cycle');
    }

    return {
      score: Math.min(100, score),
      eligible: true,
      reasons
    };
  }

  /**
   * Propose Idle-Time Equipment Exchange
   */
  static async proposeExchange({
    proposerId,
    recipientId,
    offeredEquipmentId,
    requestedEquipmentId,
    offeredStartTime,
    offeredEndTime,
    requestedStartTime,
    requestedEndTime,
    cashAdjustmentAmount = 0,
    cashPayerId = null,
    termsAgreement = '',
    notes = ''
  }) {
    // 1. Verify equipment existence & ownership
    const offeredEquip = memoryDb.tables.equipment.find(e => e.id === offeredEquipmentId);
    if (!offeredEquip) {
      throw new AppError('Offered equipment listing does not exist', 404, 'OFFERED_EQUIPMENT_NOT_FOUND');
    }
    if (offeredEquip.owner_id !== proposerId) {
      throw new AppError('You can only offer equipment that you own', 403, 'NOT_OWNER_OF_OFFERED_EQUIPMENT');
    }

    const requestedEquip = memoryDb.tables.equipment.find(e => e.id === requestedEquipmentId);
    if (!requestedEquip) {
      throw new AppError('Requested equipment listing does not exist', 404, 'REQUESTED_EQUIPMENT_NOT_FOUND');
    }
    if (requestedEquip.owner_id === proposerId) {
      throw new AppError('Cannot create an exchange with your own equipment', 400, 'SELF_EXCHANGE_PROHIBITED');
    }

    // 2. Preliminary availability check for both machines
    const offeredConflict = BookingService.checkConflict(offeredEquipmentId, offeredStartTime, offeredEndTime);
    if (offeredConflict.hasConflict) {
      throw new AppError(`Your offered equipment is unavailable during proposed dates: ${offeredConflict.message}`, 409, 'OFFERED_EQUIPMENT_CONFLICT');
    }

    const requestedConflict = BookingService.checkConflict(requestedEquipmentId, requestedStartTime, requestedEndTime);
    if (requestedConflict.hasConflict) {
      throw new AppError(`The requested equipment is unavailable during proposed dates: ${requestedConflict.message}`, 409, 'REQUESTED_EQUIPMENT_CONFLICT');
    }

    // 3. Create Exchange Proposal
    const exchangeId = 'xch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const exchangeRef = 'FSX-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);

    const proposal = {
      id: exchangeId,
      proposal_reference: exchangeRef,
      proposer_id: proposerId,
      recipient_id: recipientId || requestedEquip.owner_id,
      status: 'proposed',
      cash_adjustment_amount: cashAdjustmentAmount,
      cash_payer_id: cashPayerId,
      terms_agreement: termsAgreement || 'Standard FarmSharw Idle-Time Equipment Exchange Agreement',
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.exchange_proposals.push(proposal);

    // Record Items
    // Item 1: Offered item (Proposer -> Recipient)
    memoryDb.tables.exchange_proposal_items.push({
      id: `xitem-${exchangeId}-1`,
      exchange_id: exchangeId,
      equipment_id: offeredEquipmentId,
      providing_user_id: proposerId,
      receiving_user_id: requestedEquip.owner_id,
      start_time: new Date(offeredStartTime).toISOString(),
      end_time: new Date(offeredEndTime).toISOString(),
      created_at: new Date().toISOString()
    });

    // Item 2: Requested item (Recipient -> Proposer)
    memoryDb.tables.exchange_proposal_items.push({
      id: `xitem-${exchangeId}-2`,
      exchange_id: exchangeId,
      equipment_id: requestedEquipmentId,
      providing_user_id: requestedEquip.owner_id,
      receiving_user_id: proposerId,
      start_time: new Date(requestedStartTime).toISOString(),
      end_time: new Date(requestedEndTime).toISOString(),
      created_at: new Date().toISOString()
    });

    // Participants tracking
    memoryDb.tables.exchange_participants.push(
      { id: `xpart-${exchangeId}-1`, exchange_id: exchangeId, user_id: proposerId, has_accepted: true, accepted_at: new Date().toISOString() },
      { id: `xpart-${exchangeId}-2`, exchange_id: exchangeId, user_id: requestedEquip.owner_id, has_accepted: false, accepted_at: null }
    );

    // Notify Recipient
    NotificationService.createNotification({
      userId: requestedEquip.owner_id,
      title: 'New Idle-Time Equipment Exchange Proposal',
      message: `Farmer proposed exchanging "${offeredEquip.title}" for your "${requestedEquip.title}". Ref: ${exchangeRef}`,
      type: 'exchange',
      linkUrl: `/exchanges.html?id=${exchangeId}`
    });

    return proposal;
  }

  /**
   * Submit Counteroffer
   */
  static async submitCounteroffer(exchangeId, actorId, { cashAdjustmentAmount, notes, newDates }) {
    const exchange = memoryDb.tables.exchange_proposals.find(x => x.id === exchangeId);
    if (!exchange) {
      throw new AppError('Exchange proposal not found', 404, 'EXCHANGE_NOT_FOUND');
    }

    if (exchange.proposer_id !== actorId && exchange.recipient_id !== actorId) {
      throw new AppError('Unauthorized: you are not a participant in this exchange', 403, 'FORBIDDEN');
    }

    if (!['proposed', 'countered'].includes(exchange.status)) {
      throw new AppError(`Cannot counteroffer an exchange in "${exchange.status}" state`, 400, 'INVALID_EXCHANGE_STATE');
    }

    exchange.status = 'countered';
    if (cashAdjustmentAmount !== undefined) exchange.cash_adjustment_amount = cashAdjustmentAmount;
    if (notes) exchange.notes = (exchange.notes ? exchange.notes + '\n\n' : '') + `[Counteroffer by ${actorId}]: ${notes}`;
    exchange.updated_at = new Date().toISOString();

    // Reset acceptance
    memoryDb.tables.exchange_participants
      .filter(p => p.exchange_id === exchangeId)
      .forEach(p => {
        p.has_accepted = (p.user_id === actorId);
        p.accepted_at = (p.user_id === actorId) ? new Date().toISOString() : null;
      });

    const otherUserId = exchange.proposer_id === actorId ? exchange.recipient_id : exchange.proposer_id;
    NotificationService.createNotification({
      userId: otherUserId,
      title: 'Exchange Counteroffer Received',
      message: `A counteroffer was made on exchange proposal ${exchange.proposal_reference}`,
      type: 'exchange',
      linkUrl: `/exchanges.html?id=${exchangeId}`
    });

    return exchange;
  }

  /**
   * Accept Exchange and atomically secure schedule reservations for all machines
   */
  static async acceptAndConfirm(exchangeId, actorId) {
    const exchange = memoryDb.tables.exchange_proposals.find(x => x.id === exchangeId);
    if (!exchange) {
      throw new AppError('Exchange proposal not found', 404, 'EXCHANGE_NOT_FOUND');
    }

    const participant = memoryDb.tables.exchange_participants.find(p => p.exchange_id === exchangeId && p.user_id === actorId);
    if (!participant) {
      throw new AppError('You are not a participant in this exchange', 403, 'FORBIDDEN');
    }

    participant.has_accepted = true;
    participant.accepted_at = new Date().toISOString();

    const allParticipants = memoryDb.tables.exchange_participants.filter(p => p.exchange_id === exchangeId);
    const allAccepted = allParticipants.every(p => p.has_accepted);

    if (allAccepted) {
      // 1. ATOMIC SCHEDULE SECURING: Verify no conflicts arose during negotiation
      const items = memoryDb.tables.exchange_proposal_items.filter(item => item.exchange_id === exchangeId);

      for (const item of items) {
        const conflict = BookingService.checkConflict(item.equipment_id, item.start_time, item.end_time);
        if (conflict.hasConflict) {
          throw new AppError(
            `Unable to confirm exchange: Equipment "${item.equipment_id}" schedule conflict: ${conflict.message}`,
            409,
            'EXCHANGE_SCHEDULE_CONFLICT'
          );
        }
      }

      // 2. Lock both schedules atomically in exchange_reservations
      items.forEach(item => {
        memoryDb.tables.exchange_reservations.push({
          id: `xres-${exchangeId}-${item.equipment_id}`,
          exchange_id: exchangeId,
          equipment_id: item.equipment_id,
          start_time: item.start_time,
          end_time: item.end_time,
          is_active: true,
          created_at: new Date().toISOString()
        });
      });

      exchange.status = 'confirmed';
      exchange.updated_at = new Date().toISOString();

      allParticipants.forEach(p => {
        NotificationService.createNotification({
          userId: p.user_id,
          title: 'Idle-Time Exchange Confirmed!',
          message: `Both parties accepted exchange agreement ${exchange.proposal_reference}. Equipment schedules are now locked.`,
          type: 'exchange',
          linkUrl: `/exchanges.html?id=${exchangeId}`
        });
      });
    } else {
      exchange.status = 'accepted';
      exchange.updated_at = new Date().toISOString();
    }

    return exchange;
  }
}

