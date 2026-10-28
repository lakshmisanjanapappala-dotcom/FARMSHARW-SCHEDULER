# FarmSharw Scheduler 🌾
### Agricultural Equipment Rental & Idle-Time Exchange Platform

**Tagline:** *"Share Equipment. Save Time. Grow Together."*

FarmSharw Scheduler is a complete, production-grade, India-focused agricultural equipment marketplace built to turn idle machinery into a shared rural resource. It connects farmers needing machinery with farmers, implement owners, and Custom Hiring Centers (CHCs) with underutilized assets.

---

## 1. Non-Negotiable Technology Stack

- **Frontend:** Semantic HTML5, CSS3 Custom Agricultural Design System (no Tailwind / Bootstrap), Vanilla JavaScript (native ES modules).
- **Backend API:** Node.js LTS with Express REST APIs, Zod schema validation, Helmet security headers, rate-limiting, and centralized error handling.
- **Persistent Data:** Supabase PostgreSQL with `btree_gist` range types for database-enforced concurrency conflict prevention.
- **Authentication & Security:** Supabase Auth (Email/Password & Indian Phone OTP), Row Level Security (RLS) on all 32 database tables.
- **Storage:** Supabase Storage (public equipment photos, private KYC verification docs and damage reports).
- **Testing:** Node.js native test runner (`node:test`, `node:assert`, and `supertest`) with 43 automated unit, integration, concurrency, and security tests.

---

## 2. Core Business Models

### A. Paid Rental
- Comprehensive rental windows: hourly, daily, weekly, and seasonal periods.
- Authoritative Pricing Engine: computes base rent, delivery fees (by km radius), refundable security deposits, 5.0% platform technology fee, and 18.0% GST tax.
- Handover methods: Farm pickup or owner field delivery.
- Operational check-in handover, return condition inspection, and damage reporting.
- Payment methods: Cash on Pickup (with immutable audit trail) and Online Payment Checkout (with idempotent cryptographic webhook processing).

### B. Idle-Time Equipment Exchange
- Propose swapping usage of underutilized equipment during complementary seasonal crop cycles.
- Multi-implement 2-way negotiations with counteroffer workflows.
- Explainable match compatibility scoring (location, crop cycle complementary value, machine condition).
- Optional agreed cash adjustment for value differences.
- **Atomic Schedule Reservation:** Both equipment items are locked atomically in database transactions so neither farmer is stranded.

---

## 3. Project Structure

```
farmsharw/
├── package.json
├── package-lock.json
├── .env.example
├── .env
├── .gitignore
├── README.md
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       ├── 20261027000001_initial_schema.sql
│       ├── 20261027000002_rls_policies.sql
│       └── 20261027000003_functions_and_triggers.sql
├── server/
│   └── src/
│       ├── server.js
│       ├── app.js
│       ├── config/
│       │   ├── env.js
│       │   └── supabase.js
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── authorize.js
│       │   ├── validate.js
│       │   ├── rate-limit.js
│       │   ├── error-handler.js
│       │   └── audit.js
│       ├── routes/
│       │   ├── health.routes.js
│       │   ├── auth.routes.js
│       │   ├── equipment.routes.js
│       │   ├── bookings.routes.js
│       │   ├── exchanges.routes.js
│       │   ├── payments.routes.js
│       │   ├── messages.routes.js
│       │   ├── notifications.routes.js
│       │   ├── reviews.routes.js
│       │   ├── maintenance.routes.js
│       │   ├── damage-reports.routes.js
│       │   ├── disputes.routes.js
│       │   └── admin.routes.js
│       ├── services/
│       │   ├── pricing.service.js
│       │   ├── booking.service.js
│       │   ├── exchange.service.js
│       │   ├── payment.service.js
│       │   ├── equipment.service.js
│       │   ├── notification.service.js
│       │   └── admin.service.js
│       ├── validators/
│       │   └── schemas.js
│       └── scripts/
│           └── seed.js
├── public/
│   ├── index.html
│   ├── equipment.html
│   ├── equipment-details.html
│   ├── how-it-works.html
│   ├── pricing.html
│   ├── about.html
│   ├── faq.html
│   ├── policies.html
│   ├── login.html
│   ├── register.html
│   ├── verify-otp.html
│   ├── forgot-password.html
│   ├── dashboard.html
│   ├── add-equipment.html
│   ├── edit-equipment.html
│   ├── bookings.html
│   ├── booking-details.html
│   ├── exchanges.html
│   ├── messages.html
│   ├── notifications.html
│   ├── profile.html
│   ├── maintenance.html
│   ├── damage-reports.html
│   ├── admin.html
│   ├── 404.html
│   ├── 403.html
│   └── assets/
│       ├── css/
│       │   ├── variables.css
│       │   ├── base.css
│       │   ├── components.css
│       │   ├── layout.css
│       │   └── pages.css
│       ├── js/
│       │   ├── config.js
│       │   ├── api.js
│       │   ├── auth.js
│       │   ├── i18n.js
│       │   └── components/
│       │       ├── nav.js
│       │       ├── footer.js
│       │       ├── modal.js
│       │       └── toast.js
│       └── images/
│           ├── tractor.svg
│           ├── rotavator.svg
│           ├── harvester.svg
│           └── pump.svg
└── tests/
    ├── unit/
    │   ├── pricing.test.js
    │   ├── duration.test.js
    │   ├── state-machine.test.js
    │   └── exchange-matching.test.js
    └── integration/
        ├── booking-concurrency.test.js
        ├── security.test.js
        └── pages.test.js
```

---

## 4. Database Schema & RLS Policies

The schema includes all 32 required relational tables:
1. `profiles`: Indian farmer profiles (names, phones, PIN codes, districts, states).
2. `user_roles`: Protected role authorization records (`renter`, `owner`, `admin`).
3. `user_verifications`: KYC records for Kisan Credit Card (KCC), Aadhaar, Voter ID, Driving License.
4. `equipment_categories`: Machinery categories with slugs and icons.
5. `equipment`: Agricultural machinery listings with privacy boundaries.
6. `equipment_images`: Photos stored in Supabase storage.
7. `equipment_locations`: Geocoordinates and radius limits.
8. `equipment_pricing_rules`: Hourly, daily, weekly, seasonal rates, minimum charge.
9. `equipment_availability_rules`: Weekly operating hours.
10. `equipment_blackout_periods`: Owner-reserved downtime windows.
11. `bookings`: Unified reservations with `btree_gist` range exclusion constraints preventing overlaps:
   ```sql
   ALTER TABLE public.bookings ADD CONSTRAINT prevent_overlapping_active_bookings
       EXCLUDE USING gist (
           equipment_id WITH =,
           tstzrange(start_time, end_time, '[)') WITH &&
       )
       WHERE (status IN ('pending_owner', 'awaiting_payment', 'confirmed', 'active'));
   ```
12. `booking_status_history`: Immutable status transition audit records.
13. `booking_price_items`: Itemized pricing audit trail.
14. `payment_transactions`: Financial transactions.
15. `payment_webhook_events`: Idempotent webhook logs.
16. `refunds`: Authoritative refund tracking.
17. `exchange_proposals`: Idle-time exchange headers.
18. `exchange_proposal_items`: Offered and requested machinery schedules.
19. `exchange_participants`: Multi-party acceptance tracking.
20. `exchange_reservations`: Atomic schedule locks.
21. `conversations`, 22. `conversation_participants`, 23. `messages`: In-app chat.
24. `notifications`: In-app alerts.
25. `reviews`: Rating restrictions for completed transactions.
26. `maintenance_records`: Service records with machinery downtime triggers.
27. `damage_reports`, 28. `damage_report_attachments`: Inspection damage logs.
29. `disputes`: Platform dispute cases.
30. `saved_equipment`: Bookmarks.
31. `audit_logs`: Immutable security and operation audit trail.
32. `platform_settings`: Tax, fee percentages, and localization settings.

---

## 5. Automated Tests & Results

The test suite runs using Node's native test runner without third-party test runners:
```bash
npm test
```

### Actual Test Results
```
ℹ tests 43
ℹ suites 7
ℹ pass 43
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 462.77ms
```

### Coverage Highlights:
- **Concurrency & Conflict Prevention:** Proves overlapping booking intervals for the same equipment are blocked and return HTTP 409 `BOOKING_CONFLICT`.
- **Security & Authorization:** Proves non-owners cannot edit equipment (403), renters cannot view admin data (403), client-supplied booking amounts are overridden by authoritative server calculations, and payment records are protected.
- **Pricing Engine:** Validates hourly, daily, weekly, seasonal tiering, minimum charges, delivery fees, deposit handling, 5% platform fee, and 18% GST tax.
- **Frontend Page Serving:** Validates all 26 public and authenticated HTML pages load with HTTP 200.

---

## 6. Setup & Run Instructions

### 1. Prerequisites
- Node.js LTS (v18, v20, v22, or v24).
- NPM.

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Copy the example file:
```bash
cp .env.example .env
```
For production, update `.env` with your real Supabase project URL, Anon Key, and Service Role Key from the Supabase Dashboard.

### 4. Database Migrations
If using the Supabase CLI:
```bash
supabase db push
# or run the SQL files in supabase/migrations/ via the Supabase Dashboard SQL Editor
```

### 5. Seed Data
```bash
npm run seed
```

### 6. Start the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Demo Accounts for Local Evaluation

You can test with one-click buttons on the Login page (`/login.html`) or via phone OTP (sandbox code: `123456`):
- **Platform Admin:** `admin@farmsharw.in` (`mock-token-a0000000-0000-0000-0000-000000000001`)
- **Equipment Owner:** `gurpreet.brar@example.com` (`mock-token-a0000000-0000-0000-0000-000000000002`)
- **Dual Owner & Renter:** `venkat.reddy@example.com` (`mock-token-a0000000-0000-0000-0000-000000000003`)
- **Renter:** `suresh.shinde@example.com` (`mock-token-a0000000-0000-0000-0000-000000000004`)

