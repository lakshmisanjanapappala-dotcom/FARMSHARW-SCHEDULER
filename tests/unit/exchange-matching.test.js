import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExchangeService } from '../../server/src/services/exchange.service.js';

describe('ExchangeService — Idle-Time Compatibility Matching', () => {
  it('returns high score and explainable reasons for complementary nearby equipment', () => {
    const offered = {
      title: 'Mahindra 575 DI Tractor',
      state: 'Punjab',
      district: 'Bathinda',
      condition: 'excellent',
      is_exchange_eligible: true
    };

    const requested = {
      title: 'Shaktiman 7ft Rotavator',
      state: 'Punjab',
      district: 'Bathinda',
      condition: 'excellent',
      is_exchange_eligible: true
    };

    const match = ExchangeService.calculateMatchScore(offered, requested);
    assert.equal(match.eligible, true);
    assert.ok(match.score >= 90);
    assert.ok(match.reasons.some(r => r.includes('Same district')));
    assert.ok(match.reasons.some(r => r.includes('complementary agricultural implements')));
  });

  it('marks exchange ineligible if one equipment opts out', () => {
    const offered = { title: 'Tractor', is_exchange_eligible: false };
    const requested = { title: 'Harvester', is_exchange_eligible: true };

    const match = ExchangeService.calculateMatchScore(offered, requested);
    assert.equal(match.eligible, false);
    assert.equal(match.score, 0);
  });
});

