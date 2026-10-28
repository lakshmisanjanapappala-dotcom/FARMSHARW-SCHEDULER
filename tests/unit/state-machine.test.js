import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BookingService } from '../../server/src/services/booking.service.js';
import { memoryDb } from '../../server/src/config/supabase.js';

describe('BookingService — Status State Machine Transitions', () => {
  const testBookingId = 'bk-test-sm-1';

  beforeEach(() => {
    // Insert mock booking in draft state
    const existingIdx = memoryDb.tables.bookings.findIndex(b => b.id === testBookingId);
    const mock = {
      id: testBookingId,
      booking_reference: 'FSB-TEST-001',
      equipment_id: 'e1000000-0000-0000-0000-000000000001',
      renter_id: 'a0000000-0000-0000-0000-000000000004',
      owner_id: 'a0000000-0000-0000-0000-000000000002',
      status: 'pending_owner',
      start_time: '2026-12-01T08:00:00Z',
      end_time: '2026-12-03T18:00:00Z',
      rental_duration_hours: 58,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      memoryDb.tables.bookings[existingIdx] = mock;
    } else {
      memoryDb.tables.bookings.push(mock);
    }
  });

  it('allows owner to transition from pending_owner to confirmed', () => {
    const updated = BookingService.transitionStatus(testBookingId, 'confirmed', 'a0000000-0000-0000-0000-000000000002');
    assert.equal(updated.status, 'confirmed');
  });

  it('forbids invalid leap from pending_owner directly to completed', () => {
    assert.throws(
      () => {
        BookingService.transitionStatus(testBookingId, 'completed', 'a0000000-0000-0000-0000-000000000002');
      },
      { code: 'INVALID_STATUS_TRANSITION' }
    );
  });

  it('allows confirmed booking to become active upon equipment handover', () => {
    BookingService.transitionStatus(testBookingId, 'confirmed', 'owner');
    const activeBooking = BookingService.transitionStatus(testBookingId, 'active', 'owner');
    assert.equal(activeBooking.status, 'active');
  });
});

