import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../server/src/app.js';

describe('Integration — Concurrency & Conflict Prevention', () => {
  const equipmentId = 'e1000000-0000-0000-0000-000000000002'; // Rotavator
  const tokenRenter1 = 'mock-token-a0000000-0000-0000-0000-000000000004';
  const tokenRenter2 = 'mock-token-a0000000-0000-0000-0000-000000000003';

  it('secures initial booking and blocks overlapping booking with HTTP 409', async () => {
    const bookingPayload1 = {
      equipmentId,
      startTime: '2026-11-15T09:00:00+05:30',
      endTime: '2026-11-16T18:00:00+05:30',
      handoverMethod: 'pickup',
      paymentMethod: 'cash_on_pickup'
    };

    // First booking succeeds
    const res1 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenRenter1}`)
      .send(bookingPayload1);

    assert.equal(res1.status, 201);
    assert.equal(res1.body.success, true);
    assert.ok(res1.body.data.booking.id);

    // Overlapping booking request for same equipment
    const bookingPayload2 = {
      equipmentId,
      startTime: '2026-11-16T10:00:00+05:30', // Overlaps with 09:00-18:00
      endTime: '2026-11-17T12:00:00+05:30',
      handoverMethod: 'pickup',
      paymentMethod: 'cash_on_pickup'
    };

    const res2 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokenRenter2}`)
      .send(bookingPayload2);

    // Must be blocked with 409 Conflict
    assert.equal(res2.status, 409);
    assert.equal(res2.body.success, false);
    assert.equal(res2.body.error.code, 'BOOKING_CONFLICT');
  });
});

