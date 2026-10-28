import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '../../server/src/services/pricing.service.js';

describe('PricingService — Authoritative Pricing Engine', () => {
  const sampleEquipment = {
    id: 'eq-1',
    min_rental_hours: 2,
    max_rental_days: 30,
    deposit_required: true,
    deposit_amount: 1500,
    delivery_offered: true,
    delivery_fee_per_km: 20,
    max_delivery_radius_km: 25
  };

  const samplePricingRule = {
    hourly_rate: 500,
    daily_rate: 3500,
    weekly_rate: 20000,
    seasonal_rate: 70000,
    minimum_charge: 1000
  };

  it('calculates hourly pricing correctly for short duration', () => {
    const start = '2026-11-01T08:00:00+05:30';
    const end = '2026-11-01T12:00:00+05:30'; // 4 hours

    const quote = PricingService.calculateQuote({
      equipment: sampleEquipment,
      pricingRule: samplePricingRule,
      startTime: start,
      endTime: end,
      handoverMethod: 'pickup'
    });

    assert.equal(quote.durationHours, 4);
    assert.equal(quote.baseRentalAmount, 2000); // 4 * 500
    assert.equal(quote.depositAmount, 1500);
    assert.equal(quote.platformFee, 100); // 5% of 2000
    assert.equal(quote.taxAmount, 18); // 18% of 100 platform fee
    assert.equal(quote.totalAmount, 3618); // 2000 + 1500 + 100 + 18
  });

  it('enforces minimum rental duration', () => {
    const start = '2026-11-01T08:00:00+05:30';
    const end = '2026-11-01T09:00:00+05:30'; // 1 hour (less than min 2 hours)

    assert.throws(
      () => {
        PricingService.calculateQuote({
          equipment: sampleEquipment,
          pricingRule: samplePricingRule,
          startTime: start,
          endTime: end
        });
      },
      { code: 'MINIMUM_DURATION_NOT_MET' }
    );
  });

  it('calculates weekly rate with daily remainder and delivery charge', () => {
    const start = '2026-11-01T08:00:00+05:30';
    const end = '2026-11-10T08:00:00+05:30'; // 9 days = 1 week + 2 days

    const quote = PricingService.calculateQuote({
      equipment: sampleEquipment,
      pricingRule: samplePricingRule,
      startTime: start,
      endTime: end,
      handoverMethod: 'owner_delivery',
      deliveryDistanceKm: 15
    });

    // 1 week (20000) + 2 days (7000) = 27000 base rent
    assert.equal(quote.baseRentalAmount, 27000);
    assert.equal(quote.deliveryFee, 300); // 15 km * 20
    assert.equal(quote.depositAmount, 1500);
    assert.equal(quote.platformFee, 1350); // 5% of 27000
    // Taxable services: platform fee (1350) + delivery (300) = 1650. 18% = 297
    assert.equal(quote.taxAmount, 297);
    assert.equal(quote.totalAmount, 30447); // 27000 + 300 + 1500 + 1350 + 297
  });

  it('rejects delivery distance exceeding maximum radius', () => {
    const start = '2026-11-01T08:00:00+05:30';
    const end = '2026-11-02T08:00:00+05:30';

    assert.throws(
      () => {
        PricingService.calculateQuote({
          equipment: sampleEquipment,
          pricingRule: samplePricingRule,
          startTime: start,
          endTime: end,
          handoverMethod: 'owner_delivery',
          deliveryDistanceKm: 30 // exceeds max 25 km
        });
      },
      { code: 'DELIVERY_RADIUS_EXCEEDED' }
    );
  });
});

