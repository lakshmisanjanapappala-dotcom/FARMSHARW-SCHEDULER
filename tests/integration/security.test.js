import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../server/src/app.js';

describe('Integration — Security & Authorization Boundaries', () => {
  const adminToken = 'mock-token-a0000000-0000-0000-0000-000000000001';
  const ownerToken = 'mock-token-a0000000-0000-0000-0000-000000000002';
  const renterToken = 'mock-token-a0000000-0000-0000-0000-000000000004';

  it('prevents normal renter from accessing admin overview (HTTP 403)', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${renterToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('allows administrator to access admin overview', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.metrics);
  });

  it('prevents user from modifying equipment they do not own (HTTP 403)', async () => {
    // Renter tries to edit Gurpreet's tractor
    const res = await request(app)
      .patch('/api/equipment/e1000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ title: 'Hacked Title' });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it('prevents arbitrary manipulation of booking total amount', async () => {
    // Client sends spoofed total_amount of ₹1.00
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${renterToken}`)
      .send({
        equipmentId: 'e1000000-0000-0000-0000-000000000001',
        startTime: '2026-12-10T08:00:00+05:30',
        endTime: '2026-12-10T14:00:00+05:30', // 6 hours
        handoverMethod: 'pickup',
        total_amount: 1.00 // Spoofed
      });

    assert.equal(res.status, 201);
    // Verified that authoritative calculation was used instead of spoofed amount
    assert.ok(res.body.data.booking.total_amount > 1000);
    assert.equal(res.body.data.booking.currency, 'INR');
  });
});

