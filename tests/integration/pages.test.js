import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../server/src/app.js';

describe('Integration — Static Frontend Page Serving', () => {
  const pages = [
    { path: '/', titleSnippet: 'FarmSharw Scheduler' },
    { path: '/equipment.html', titleSnippet: 'Agricultural Equipment Marketplace' },
    { path: '/equipment-details.html', titleSnippet: 'Equipment Details' },
    { path: '/how-it-works.html', titleSnippet: 'How FarmSharw Scheduler Works' },
    { path: '/pricing.html', titleSnippet: 'Pricing, Platform Fees & GST' },
    { path: '/about.html', titleSnippet: 'About FarmSharw Scheduler' },
    { path: '/faq.html', titleSnippet: 'Frequently Asked Questions' },
    { path: '/policies.html', titleSnippet: 'Platform Policies & Guidelines' },
    { path: '/login.html', titleSnippet: 'Welcome Back to FarmSharw' },
    { path: '/register.html', titleSnippet: 'Join FarmSharw Scheduler' },
    { path: '/verify-otp.html', titleSnippet: 'Verify Mobile Number' },
    { path: '/forgot-password.html', titleSnippet: 'Reset Password' },
    { path: '/dashboard.html', titleSnippet: 'Kisan Dashboard' },
    { path: '/add-equipment.html', titleSnippet: 'List Your Agricultural Equipment' },
    { path: '/edit-equipment.html', titleSnippet: 'Edit Equipment Listing' },
    { path: '/bookings.html', titleSnippet: 'Equipment Bookings Management' },
    { path: '/booking-details.html', titleSnippet: 'Booking Details' },
    { path: '/exchanges.html', titleSnippet: 'Idle-Time Equipment Exchange Hub' },
    { path: '/messages.html', titleSnippet: 'In-App Conversations' },
    { path: '/notifications.html', titleSnippet: 'Notification Center' },
    { path: '/profile.html', titleSnippet: 'Farmer Profile & Verification' },
    { path: '/maintenance.html', titleSnippet: 'Machinery Service & Maintenance History' },
    { path: '/damage-reports.html', titleSnippet: 'Damage Reports' },
    { path: '/admin.html', titleSnippet: 'Platform Operations & Moderation' },
    { path: '/404.html', titleSnippet: 'Page Not Found' },
    { path: '/403.html', titleSnippet: 'Access Forbidden' }
  ];

  for (const page of pages) {
    it(`serves ${page.path} with status 200`, async () => {
      const res = await request(app).get(page.path);
      assert.equal(res.status, 200);
      assert.ok(res.text.includes(page.titleSnippet), `Expected page to contain snippet: ${page.titleSnippet}`);
    });
  }
});

