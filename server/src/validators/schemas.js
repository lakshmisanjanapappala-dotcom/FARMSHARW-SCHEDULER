import { z } from 'zod';

export const bookingQuoteSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endTime: z.string().datetime({ offset: true }).or(z.string().min(10)),
  handoverMethod: z.enum(['pickup', 'owner_delivery']).default('pickup'),
  deliveryDistanceKm: z.coerce.number().min(0).default(0)
});

export const createBookingSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endTime: z.string().datetime({ offset: true }).or(z.string().min(10)),
  handoverMethod: z.enum(['pickup', 'owner_delivery']).default('pickup'),
  deliveryAddress: z.string().optional(),
  deliveryDistanceKm: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(['cash_on_pickup', 'online']).default('cash_on_pickup'),
  notes: z.string().max(1000).optional()
});

export const createEquipmentSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(3).max(150),
  equipmentType: z.string().min(2),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  manufactureYear: z.coerce.number().int().min(1970).max(new Date().getFullYear() + 1).optional(),
  hpPower: z.coerce.number().int().positive().optional(),
  description: z.string().min(10).max(3000),
  condition: z.enum(['excellent', 'good', 'fair']).default('good'),
  specifications: z.record(z.any()).default({}),
  state: z.string().min(2),
  district: z.string().min(2),
  villageOrTown: z.string().min(2),
  pinCode: z.string().regex(/^\d{6}$/, 'Must be a valid 6-digit Indian PIN code'),
  approximateLat: z.coerce.number().optional(),
  approximateLng: z.coerce.number().optional(),
  exactAddress: z.string().min(5),
  minRentalHours: z.coerce.number().int().min(1).default(2),
  maxRentalDays: z.coerce.number().int().min(1).default(30),
  bookingApprovalPolicy: z.enum(['instant', 'manual']).default('manual'),
  depositRequired: z.boolean().default(false),
  depositAmount: z.coerce.number().min(0).default(0),
  deliveryOffered: z.boolean().default(false),
  deliveryFeePerKm: z.coerce.number().min(0).default(0),
  maxDeliveryRadiusKm: z.coerce.number().min(0).default(20),
  isExchangeEligible: z.boolean().default(true),
  exchangePreferences: z.string().optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  dailyRate: z.coerce.number().min(1, 'Daily rate must be greater than zero'),
  weeklyRate: z.coerce.number().min(0).optional(),
  seasonalRate: z.coerce.number().min(0).optional(),
  minimumCharge: z.coerce.number().min(0).default(0)
});

export const createExchangeSchema = z.object({
  offeredEquipmentId: z.string().min(1),
  requestedEquipmentId: z.string().min(1),
  offeredStartTime: z.string().min(10),
  offeredEndTime: z.string().min(10),
  requestedStartTime: z.string().min(10),
  requestedEndTime: z.string().min(10),
  cashAdjustmentAmount: z.coerce.number().default(0),
  cashPayerId: z.string().optional(),
  termsAgreement: z.string().optional(),
  notes: z.string().optional()
});

export const counterExchangeSchema = z.object({
  cashAdjustmentAmount: z.coerce.number().optional(),
  notes: z.string().min(1, 'Notes explaining counteroffer are required')
});

export const cashPaymentSchema = z.object({
  amountCollected: z.coerce.number().positive('Collected amount must be positive'),
  notes: z.string().optional()
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(5).max(1000)
});

export const createMaintenanceSchema = z.object({
  maintenanceType: z.string().min(2),
  description: z.string().min(5),
  cost: z.coerce.number().min(0).default(0),
  serviceDate: z.string().min(10),
  nextServiceDate: z.string().optional(),
  performedBy: z.string().optional(),
  equipmentStatusAfter: z.enum(['operational', 'under_maintenance', 'decommissioned']).default('operational')
});

export const createDamageReportSchema = z.object({
  severity: z.enum(['minor', 'moderate', 'severe']).default('minor'),
  description: z.string().min(10),
  estimatedCost: z.coerce.number().min(0).default(0)
});

export const createDisputeSchema = z.object({
  bookingId: z.string().optional(),
  exchangeId: z.string().optional(),
  againstUserId: z.string().min(1),
  reason: z.string().min(10),
  desiredResolution: z.string().optional()
});

