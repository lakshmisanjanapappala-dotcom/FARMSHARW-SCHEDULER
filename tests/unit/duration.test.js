import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from '../../server/src/services/pricing.service.js';

describe('PricingService — Duration Validation', () => {
  it('correctly calculates hour and day differences', () => {
    const start = '2026-11-05T10:00:00Z';
    const end = '2026-11-06T22:00:00Z'; // 36 hours

    const { durationHours, durationDays } = PricingService.calculateDuration(start, end);
    assert.equal(durationHours, 36);
    assert.equal(durationDays, 1.5);
  });

  it('rejects end time earlier than or equal to start time', () => {
    const start = '2026-11-05T10:00:00Z';
    const end = '2026-11-05T09:00:00Z';

    assert.throws(
      () => {
        PricingService.calculateDuration(start, end);
      },
      { code: 'INVALID_TIME_RANGE' }
    );
  });

  it('rejects unparseable timestamps', () => {
    assert.throws(
      () => {
        PricingService.calculateDuration('invalid-date', '2026-11-05T10:00:00Z');
      },
      { code: 'INVALID_DATE' }
    );
  });
});

