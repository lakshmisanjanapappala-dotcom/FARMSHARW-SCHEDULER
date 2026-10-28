import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { AdminService } from '../services/admin.service.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Protect all admin routes: require authentication AND 'admin' role
router.use(authenticate, authorize('admin'));

// GET /api/admin/overview - Platform metrics and dashboard overview
router.get('/admin/overview', (req, res) => {
  const data = AdminService.getPlatformOverview();
  res.json({
    success: true,
    data
  });
});

// GET /api/admin/users - User directory
router.get('/admin/users', (req, res) => {
  const users = memoryDb.tables.profiles.map(p => {
    const roles = memoryDb.tables.user_roles.filter(r => r.user_id === p.id).map(r => r.role);
    const verification = memoryDb.tables.user_verifications.filter(v => v.user_id === p.id).slice(-1)[0] || null;
    return {
      ...p,
      roles,
      verificationStatus: verification ? verification.status : 'unverified'
    };
  });

  res.json({
    success: true,
    data: { users }
  });
});

// PATCH /api/admin/users/:id/status - Moderate user or update role
router.patch('/admin/users/:id/status', (req, res, next) => {
  try {
    const profile = memoryDb.tables.profiles.find(p => p.id === req.params.id);
    if (!profile) throw new AppError('User not found', 404, 'NOT_FOUND');

    const { role, phoneVerified } = req.body;
    if (role) {
      const existingRole = memoryDb.tables.user_roles.find(r => r.user_id === profile.id && r.role === role);
      if (!existingRole) {
        memoryDb.tables.user_roles.push({ id: 'r-' + Date.now(), user_id: profile.id, role });
      }
    }

    if (phoneVerified !== undefined) {
      profile.phone_verified = Boolean(phoneVerified);
    }
    profile.updated_at = new Date().toISOString();

    res.json({
      success: true,
      data: { profile }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/listings - Equipment listings moderation queue
router.get('/admin/listings', (req, res) => {
  const listings = memoryDb.tables.equipment.map(e => {
    const owner = memoryDb.tables.profiles.find(p => p.id === e.owner_id);
    const category = memoryDb.tables.equipment_categories.find(c => c.id === e.category_id);
    return {
      ...e,
      owner_name: owner?.full_name || 'Owner',
      category_name: category?.name || 'Category'
    };
  });

  res.json({
    success: true,
    data: { listings }
  });
});

// POST /api/admin/listings/:id/moderate - Moderate listing
router.post('/admin/listings/:id/moderate', (req, res, next) => {
  try {
    const { isPublished, isVerified, adminNotes } = req.body;
    const updated = AdminService.moderateListing(req.params.id, {
      isPublished,
      isVerified,
      adminNotes,
      adminId: req.user.id
    });

    res.json({
      success: true,
      data: { equipment: updated }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/disputes - Open disputes queue
router.get('/admin/disputes', (req, res) => {
  const disputes = memoryDb.tables.disputes.map(d => {
    const openedBy = memoryDb.tables.profiles.find(p => p.id === d.opened_by);
    const againstUser = memoryDb.tables.profiles.find(p => p.id === d.against_user_id);
    return {
      ...d,
      opened_by_name: openedBy?.full_name || 'User',
      against_user_name: againstUser?.full_name || 'User'
    };
  });

  res.json({
    success: true,
    data: { disputes }
  });
});

// POST /api/admin/disputes/:id/resolve - Admin resolution of dispute
router.post('/admin/disputes/:id/resolve', (req, res, next) => {
  try {
    const { status, resolutionSummary, adminNotes } = req.body;
    const updated = AdminService.resolveDispute(req.params.id, {
      status: status || 'resolved',
      resolutionSummary,
      adminNotes,
      adminId: req.user.id
    });

    res.json({
      success: true,
      data: { dispute: updated }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs - Security and operation logs
router.get('/admin/audit-logs', (req, res) => {
  const logs = [...memoryDb.tables.audit_logs].reverse().slice(0, 100);
  res.json({
    success: true,
    data: { logs }
  });
});

export default router;

