import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createMaintenanceSchema } from '../validators/schemas.js';
import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// GET /api/equipment/:id/maintenance - List maintenance records
router.get('/equipment/:id/maintenance', authenticate, (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
    if (equip.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Only the owner or an administrator can view service logs', 403, 'FORBIDDEN');
    }

    const records = memoryDb.tables.maintenance_records.filter(m => m.equipment_id === equip.id);
    res.json({
      success: true,
      data: { records }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/equipment/:id/maintenance - Add service record & update status
router.post('/equipment/:id/maintenance', authenticate, validate(createMaintenanceSchema), (req, res, next) => {
  try {
    const equip = memoryDb.tables.equipment.find(e => e.id === req.params.id);
    if (!equip) throw new AppError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
    if (equip.owner_id !== req.user.id && !req.user.roles.includes('admin')) {
      throw new AppError('Forbidden: only owner can log maintenance', 403, 'FORBIDDEN');
    }

    const {
      maintenanceType,
      description,
      cost,
      serviceDate,
      nextServiceDate,
      performedBy,
      equipmentStatusAfter
    } = req.body;

    const record = {
      id: 'maint-' + Date.now(),
      equipment_id: equip.id,
      maintenance_type: maintenanceType,
      description,
      cost: cost || 0,
      service_date: serviceDate,
      next_service_date: nextServiceDate || null,
      performed_by: performedBy || 'Self / Local Workshop',
      equipment_status_after: equipmentStatusAfter,
      created_at: new Date().toISOString()
    };

    memoryDb.tables.maintenance_records.push(record);

    // Update equipment status
    equip.maintenance_status = equipmentStatusAfter;
    equip.updated_at = new Date().toISOString();

    res.status(201).json({
      success: true,
      data: {
        record,
        currentEquipmentStatus: equip.maintenance_status
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;

