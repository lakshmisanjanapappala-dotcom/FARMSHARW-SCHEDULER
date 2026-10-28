import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { logAuditEvent } from '../middleware/audit.js';

export class AdminService {
  /**
   * Platform statistics derived strictly from stored data
   */
  static getPlatformOverview() {
    const totalUsers = memoryDb.tables.profiles.length;
    const totalEquipment = memoryDb.tables.equipment.length;
    const publishedEquipment = memoryDb.tables.equipment.filter(e => e.is_published).length;
    const totalBookings = memoryDb.tables.bookings.length;
    const confirmedBookings = memoryDb.tables.bookings.filter(b => ['confirmed', 'active', 'completed'].includes(b.status)).length;
    const activeExchanges = memoryDb.tables.exchange_proposals.filter(x => ['accepted', 'confirmed'].includes(x.status)).length;
    const openDisputes = memoryDb.tables.disputes.filter(d => d.status === 'opened' || d.status === 'under_review').length;
    
    // Total gross volume
    const grossRentalVolume = memoryDb.tables.bookings
      .filter(b => ['confirmed', 'active', 'completed'].includes(b.status))
      .reduce((acc, b) => acc + (b.total_amount || 0), 0);

    const platformFeesEarned = memoryDb.tables.bookings
      .filter(b => ['confirmed', 'active', 'completed'].includes(b.status))
      .reduce((acc, b) => acc + (b.platform_fee || 0), 0);

    return {
      metrics: {
        totalUsers,
        totalEquipment,
        publishedEquipment,
        totalBookings,
        confirmedBookings,
        activeExchanges,
        openDisputes,
        grossRentalVolume: Math.round(grossRentalVolume * 100) / 100,
        platformFeesEarned: Math.round(platformFeesEarned * 100) / 100,
        currency: 'INR'
      },
      recentActivity: memoryDb.tables.audit_logs.slice(-10).reverse()
    };
  }

  static moderateListing(equipmentId, { isPublished, isVerified, adminNotes, adminId }) {
    const equip = memoryDb.tables.equipment.find(e => e.id === equipmentId);
    if (!equip) {
      throw new AppError('Equipment listing not found', 404, 'EQUIPMENT_NOT_FOUND');
    }

    const oldData = { is_published: equip.is_published, is_verified: equip.is_verified };
    if (isPublished !== undefined) equip.is_published = isPublished;
    if (isVerified !== undefined) equip.is_verified = isVerified;
    equip.updated_at = new Date().toISOString();

    logAuditEvent({
      actorId: adminId,
      action: 'MODERATE_LISTING',
      entityType: 'equipment',
      entityId: equipmentId,
      oldData,
      newData: { is_published: equip.is_published, is_verified: equip.is_verified, adminNotes }
    });

    return equip;
  }

  static resolveDispute(disputeId, { status, resolutionSummary, adminNotes, adminId }) {
    const dispute = memoryDb.tables.disputes.find(d => d.id === disputeId);
    if (!dispute) {
      throw new AppError('Dispute not found', 404, 'DISPUTE_NOT_FOUND');
    }

    dispute.status = status;
    dispute.resolution_summary = resolutionSummary;
    dispute.admin_notes = adminNotes;
    dispute.resolved_by = adminId;
    dispute.resolved_at = new Date().toISOString();
    dispute.updated_at = new Date().toISOString();

    logAuditEvent({
      actorId: adminId,
      action: 'RESOLVE_DISPUTE',
      entityType: 'dispute',
      entityId: disputeId,
      newData: { status, resolutionSummary }
    });

    return dispute;
  }
}

