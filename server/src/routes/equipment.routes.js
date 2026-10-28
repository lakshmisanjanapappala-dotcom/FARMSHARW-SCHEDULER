import { Router } from 'express';
import { EquipmentService } from '../services/equipment.service.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createEquipmentSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { logAuditEvent } from '../middleware/audit.js';

const router = Router();

// GET /api/equipment - Browse & Search
router.get('/equipment', optionalAuth, (req, res, next) => {
  try {
    const {
      q,
      category,
      state,
      district,
      pinCode,
      condition,
      delivery,
      exchange,
      lat,
      lng,
      radius,
      sort,
      page,
      limit,
      owner
    } = req.query;

    const results = EquipmentService.searchEquipment({
      keyword: q,
      category,
      state,
      district,
      pinCode,
      condition,
      deliveryOffered: delivery !== undefined ? delivery === 'true' : undefined,
      isExchangeEligible: exchange !== undefined ? exchange === 'true' : undefined,
      lat,
      lng,
      radiusKm: radius,
      sortBy: sort,
      page: page || 1,
      limit: limit || 12,
      ownerId: owner || null,
      includeUnpublished: Boolean(owner && req.user && req.user.id === owner)
    });

    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/categories
router.get('/equipment-categories', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: memoryDb.tables.equipment_categories.filter(c => c.is_active)
    }
  });
});

// GET /api/equipment/:id - Single Equipment Details
router.get('/equipment/:id', optionalAuth, (req, res, next) => {
  try {
    const item = EquipmentService.getEquipmentById(req.params.id, req.user?.id);
    res.json({
      success: true,
      data: { equipment: item }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment - Create Equipment Listing
router.post('/equipment', authenticate, validate(createEquipmentSchema), (req, res, next) => {
  try {
    const data = req.body;
    const equipId = 'e-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

    const newEquipment = {
      id: equipId,
      owner_id: req.user.id,
      category_id: data.categoryId,
      title: data.title,
      slug,
      equipment_type: data.equipmentType,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      manufacture_year: data.manufactureYear || null,
      hp_power: data.hpPower || null,
      description: data.description,
      condition: data.condition,
      specifications: data.specifications || {},
      state: data.state,
      district: data.district,
      village_or_town: data.villageOrTown,
      pin_code: data.pinCode,
      approximate_lat: data.approximateLat || null,
      approximate_lng: data.approximateLng || null,
      exact_address: data.exactAddress,
      min_rental_hours: data.minRentalHours,
      max_rental_days: data.maxRentalDays,
      booking_approval_policy: data.bookingApprovalPolicy,
      deposit_required: data.depositRequired,
      deposit_amount: data.depositAmount,
      delivery_offered: data.deliveryOffered,
      delivery_fee_per_km: data.deliveryFeePerKm,
      max_delivery_radius_km: data.maxDeliveryRadiusKm,
      is_exchange_eligible: data.isExchangeEligible,
      exchange_preferences: data.exchangePreferences || null,
      maintenance_status: 'operational',
      is_published: true,
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.equipment.push(newEquipment);

    // Create pricing rule
    const pricingRule = {
      id: 'pr-' + Date.now(),
      equipment_id: equipId,
      hourly_rate: data.hourlyRate || null,
      daily_rate: data.dailyRate,
      weekly_rate: data.weeklyRate || null,
      seasonal_rate: data.seasonalRate || null,
      currency: 'INR',
      minimum_charge: data.minimumCharge || 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryDb.tables.equipment_pricing_rules.push(pricingRule);

    // Update user role to include owner if not present
    if (!req.user.roles.includes('owner')) {
      req.user.roles.push('owner');
      memoryDb.tables.user_roles.push({
        id: 'r-' + Date.now(),
        user_id: req.user.id,
        role: 'owner'
      });
    }

    logAuditEvent({
      actorId: req.user.id,
      action: 'CREATE_EQUIPMENT',
      entityType: 'equipment',
      entityId: equipId,
      newData: newEquipment
    });

    res.status(201).json({
      success: true,
      data: {
        equipment: {
          ...newEquipment,
          pricing: pricingRule
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/equipment/:id - Update Equipment Listing
router.patch('/api/equipment/:id', authenticate, (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment listing not found', 404, 'EQUIPMENT_NOT_FOUND');
    if (equip.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Unauthorized: only the owner or an administrator can edit this listing', 403, 'FORBIDDEN');
    }

    const updates = req.body;
    const allowedFields = [
      'title', 'description', 'condition', 'minRentalHours', 'maxRentalDays',
      'bookingApprovalPolicy', 'depositRequired', 'depositAmount',
      'deliveryOffered', 'deliveryFeePerKm', 'maxDeliveryRadiusKm',
      'isExchangeEligible', 'exchangePreferences', 'isPublished', 'maintenanceStatus'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        const dbKey = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        equip[dbKey] = updates[field];
      }
    });

    equip.updated_at = new Date().toISOString();

    res.json({
      success: true,
      data: { equipment: equip }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/equipment/:id - Safe Archival / Deletion
router.delete('/equipment/:id', authenticate, (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment listing not found', 404, 'EQUIPMENT_NOT_FOUND');
    if (equip.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden: only owner can delete listing', 403, 'FORBIDDEN');
    }

    // Check if there are active bookings
    const hasActiveBookings = memoryDb.tables.bookings.some(
      b => b.equipment_id === equip.id && ['confirmed', 'active'].includes(b.status)
    );
    if (hasActiveBookings) {
      throw new AppError('Cannot delete equipment with active or confirmed bookings', 400, 'ACTIVE_BOOKINGS_EXIST');
    }

    // Soft delete / unpublish
    equip.is_published = false;
    equip.updated_at = new Date().toISOString();

    res.json({
      success: true,
      data: { message: 'Equipment listing successfully archived' }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/images - Add photo
router.post('/equipment/:id/images', authenticate, (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
    if (equip.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const { imageUrl, caption, isPrimary } = req.body;
    if (!imageUrl) throw new AppError('Image URL is required', 400, 'MISSING_IMAGE_URL');

    const imageRecord = {
      id: 'img-' + Date.now(),
      equipment_id: equip.id,
      storage_path: `equipment/${equip.id}/${Date.now()}.jpg`,
      image_url: imageUrl,
      caption: caption || equip.title,
      is_primary: Boolean(isPrimary),
      display_order: 1,
      created_at: new Date().toISOString()
    };

    memoryDb.tables.equipment_images.push(imageRecord);

    res.status(201).json({
      success: true,
      data: { image: imageRecord }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id/availability - Availability & Blackouts Calendar
router.get('/equipment/:id/availability', (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');

    const activeBookings = memoryDb.tables.bookings
      .filter(b => b.equipment_id === equip.id && ['pending_owner', 'awaiting_payment', 'confirmed', 'active'].includes(b.status))
      .map(b => ({
        id: b.id,
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status
      }));

    const exchangeReservations = memoryDb.tables.exchange_reservations
      .filter(xr => xr.equipment_id === equip.id && xr.is_active)
      .map(xr => ({
        id: xr.id,
        startTime: xr.start_time,
        endTime: xr.end_time,
        type: 'exchange_reservation'
      }));

    const blackouts = memoryDb.tables.equipment_blackout_periods
      .filter(bp => bp.equipment_id === equip.id)
      .map(bp => ({
        id: bp.id,
        startTime: bp.start_time,
        endTime: bp.end_time,
        reason: bp.reason
      }));

    res.json({
      success: true,
      data: {
        equipmentId: equip.id,
        maintenanceStatus: equip.maintenance_status,
        bookedIntervals: [...activeBookings, ...exchangeReservations],
        blackouts
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/blackout-periods - Set blackout
router.post('/equipment/:id/blackout-periods', authenticate, (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
    if (equip.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const { startTime, endTime, reason } = req.body;
    if (!startTime || !endTime) throw new AppError('startTime and endTime are required', 400, 'MISSING_PARAMS');

    const blackout = {
      id: 'bp-' + Date.now(),
      equipment_id: equip.id,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      reason: reason || 'Owner unavailable period',
      created_at: new Date().toISOString()
    };

    memoryDb.tables.equipment_blackout_periods.push(blackout);

    res.status(201).json({
      success: true,
      data: { blackout }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

