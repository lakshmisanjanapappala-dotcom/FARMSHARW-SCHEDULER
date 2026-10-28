import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createDamageReportSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// POST /api/bookings/:id/damage-reports - Report damage from rental
router.post('/bookings/:id/damage-reports', authenticate, validate(createDamageReportSchema), (req, res, next) => {
  try {
    const booking = memoryDb.tables.bookings.find(b => b.id === req.params.id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

    if (booking.renter_id !== req.user.id && booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only transaction participants can submit a damage report', 403, 'FORBIDDEN');
    }

    const { severity, description, estimatedCost, attachmentUrl } = req.body;

    const reportId = 'dmg-' + Date.now();
    const damageReport = {
      id: reportId,
      booking_id: booking.id,
      reported_by: req.user.id,
      severity,
      description,
      estimated_cost: estimatedCost || 0,
      status: 'pending',
      resolution_notes: null,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.damage_reports.push(damageReport);

    if (attachmentUrl) {
      memoryDb.tables.damage_report_attachments.push({
        id: 'dmga-' + Date.now(),
        damage_report_id: reportId,
        file_path: attachmentUrl,
        file_type: 'image/jpeg',
        uploaded_at: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      data: { damageReport }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/damage-reports/:id - View damage report
router.get('/damage-reports/:id', authenticate, (req, res, next) => {
  try {
    const report = memoryDb.tables.damage_reports.find(r => r.id === req.params.id);
    if (!report) throw new AppError('Damage report not found', 404, 'NOT_FOUND');

    const booking = memoryDb.tables.bookings.find(b => b.id === report.booking_id);
    if (booking && booking.renter_id !== req.user.id && booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const attachments = memoryDb.tables.damage_report_attachments.filter(a => a.damage_report_id === report.id);

    res.json({
      success: true,
      data: {
        damageReport: {
          ...report,
          attachments
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/damage-reports/:id/resolve - Resolve damage report
router.post('/damage-reports/:id/resolve', authenticate, (req, res, next) => {
  try {
    const report = memoryDb.tables.damage_reports.find(r => r.id === req.params.id);
    if (!report) throw new AppError('Damage report not found', 404, 'NOT_FOUND');

    const booking = memoryDb.tables.bookings.find(b => b.id === report.booking_id);
    if (booking && booking.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only the equipment owner or an administrator can resolve a damage report', 403, 'FORBIDDEN');
    }

    const { resolutionNotes, status = 'resolved' } = req.body;
    report.status = status;
    report.resolution_notes = resolutionNotes || 'Resolved between parties';
    report.resolved_by = req.user.id;
    report.resolved_at = new Date().toISOString();
    report.updated_at = new Date().toISOString();

    res.json({
      success: true,
      data: { damageReport: report }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

