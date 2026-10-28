-- ============================================================================
-- Migration: 20261027000001_initial_schema.sql
-- Description: Core Schema for FarmSharw Scheduler (Agricultural Equipment Rental & Idle-Time Exchange)
-- Target: Supabase PostgreSQL (Postgres 15+)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ENUMS (Protected against duplicate_object errors on re-run)
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('renter', 'owner', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status_enum AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE equipment_condition_enum AS ENUM ('excellent', 'good', 'fair');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE booking_approval_policy_enum AS ENUM ('instant', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE booking_status_enum AS ENUM (
        'draft',
        'pending_owner',
        'awaiting_payment',
        'confirmed',
        'active',
        'completed',
        'rejected',
        'cancelled',
        'expired',
        'disputed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE exchange_status_enum AS ENUM (
        'proposed',
        'countered',
        'accepted',
        'confirmed',
        'rejected',
        'cancelled',
        'completed',
        'disputed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM (
        'pending',
        'authorized',
        'captured',
        'failed',
        'refunded',
        'partially_refunded'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('cash_on_pickup', 'online');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE handover_method_enum AS ENUM ('pickup', 'owner_delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE maintenance_status_enum AS ENUM ('operational', 'under_maintenance', 'decommissioned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE damage_severity_enum AS ENUM ('minor', 'moderate', 'severe');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE dispute_status_enum AS ENUM ('opened', 'under_review', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT UNIQUE,
    phone_verified BOOLEAN DEFAULT FALSE,
    email TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    preferred_language TEXT DEFAULT 'en',
    state TEXT,
    district TEXT,
    taluka_or_tehsil TEXT,
    village_or_town TEXT,
    pin_code VARCHAR(10),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USER ROLES (Protected authorization table - not directly editable by clients)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role user_role_enum NOT NULL DEFAULT 'renter',
    assigned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE (user_id, role)
);

-- 3. USER VERIFICATIONS (Government ID & Farmer ID KYC)
CREATE TABLE IF NOT EXISTS public.user_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    id_type TEXT NOT NULL, -- 'aadhaar', 'voter_id', 'kisan_credit_card', 'driving_license'
    id_number_masked TEXT NOT NULL,
    document_file_path TEXT NOT NULL,
    status verification_status_enum DEFAULT 'pending' NOT NULL,
    reviewer_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. EQUIPMENT CATEGORIES
CREATE TABLE IF NOT EXISTS public.equipment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    display_order INT DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. EQUIPMENT
CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES public.equipment_categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    manufacture_year INT CHECK (manufacture_year >= 1970 AND manufacture_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    hp_power INT, -- Horsepower if applicable
    description TEXT NOT NULL,
    condition equipment_condition_enum NOT NULL DEFAULT 'good',
    specifications JSONB DEFAULT '{}'::jsonb NOT NULL,
    
    -- Location & Privacy
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    village_or_town TEXT NOT NULL,
    pin_code VARCHAR(10) NOT NULL,
    approximate_lat NUMERIC(10, 7),
    approximate_lng NUMERIC(10, 7),
    exact_address TEXT NOT NULL, -- Only shared after confirmed booking
    
    -- Rental policies
    min_rental_hours INT DEFAULT 2 NOT NULL CHECK (min_rental_hours > 0),
    max_rental_days INT DEFAULT 60 NOT NULL CHECK (max_rental_days > 0),
    booking_approval_policy booking_approval_policy_enum DEFAULT 'manual' NOT NULL,
    deposit_required BOOLEAN DEFAULT FALSE NOT NULL,
    deposit_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (deposit_amount >= 0),
    delivery_offered BOOLEAN DEFAULT FALSE NOT NULL,
    delivery_fee_per_km NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (delivery_fee_per_km >= 0),
    max_delivery_radius_km INT DEFAULT 25 NOT NULL CHECK (max_delivery_radius_km >= 0),
    
    -- Exchange Eligibility
    is_exchange_eligible BOOLEAN DEFAULT TRUE NOT NULL,
    exchange_preferences TEXT,
    
    -- Maintenance and Publication
    maintenance_status maintenance_status_enum DEFAULT 'operational' NOT NULL,
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. EQUIPMENT IMAGES
CREATE TABLE IF NOT EXISTS public.equipment_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EQUIPMENT LOCATIONS (Detailed geographic records for radius searching)
CREATE TABLE IF NOT EXISTS public.equipment_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID UNIQUE NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy_meters INT DEFAULT 100,
    landmark TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. EQUIPMENT PRICING RULES
CREATE TABLE IF NOT EXISTS public.equipment_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    hourly_rate NUMERIC(12, 2) CHECK (hourly_rate >= 0),
    daily_rate NUMERIC(12, 2) NOT NULL CHECK (daily_rate >= 0),
    weekly_rate NUMERIC(12, 2) CHECK (weekly_rate >= 0),
    seasonal_rate NUMERIC(12, 2) CHECK (seasonal_rate >= 0),
    season_name TEXT,
    season_start DATE,
    season_end DATE,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    minimum_charge NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. EQUIPMENT AVAILABILITY RULES (General recurring schedules, e.g. Mon-Sat 08:00 to 18:00)
CREATE TABLE IF NOT EXISTS public.equipment_availability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    start_time TIME DEFAULT '07:00:00' NOT NULL,
    end_time TIME DEFAULT '19:00:00' NOT NULL,
    UNIQUE (equipment_id, day_of_week)
);

-- 10. EQUIPMENT BLACKOUT PERIODS (Owner reserved or seasonal downtime)
CREATE TABLE IF NOT EXISTS public.equipment_blackout_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT blackout_period_valid_range CHECK (end_time > start_time)
);

-- 11. BOOKINGS (Unified Rental Reservations)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
    renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status booking_status_enum DEFAULT 'pending_owner' NOT NULL,
    
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    rental_duration_hours NUMERIC(8, 2) NOT NULL CHECK (rental_duration_hours > 0),
    
    handover_method handover_method_enum DEFAULT 'pickup' NOT NULL,
    delivery_address TEXT,
    delivery_distance_km NUMERIC(6, 2) DEFAULT 0,
    
    -- Authoritative Snapshot of Financials
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    base_rental_amount NUMERIC(12, 2) NOT NULL CHECK (base_rental_amount >= 0),
    delivery_fee NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (delivery_fee >= 0),
    deposit_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (deposit_amount >= 0),
    discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
    platform_fee NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (platform_fee >= 0),
    tax_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (tax_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    
    payment_method payment_method_enum DEFAULT 'cash_on_pickup' NOT NULL,
    payment_status payment_status_enum DEFAULT 'pending' NOT NULL,
    
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    
    -- Operational handover tracking
    checked_in_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    handover_notes TEXT,
    return_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT booking_time_range_valid CHECK (end_time > start_time)
);

-- PostGIS/btree_gist exclusion constraint on active bookings
-- Statuses that hold an active lock on the schedule:
-- pending_owner, awaiting_payment, confirmed, active
-- Non-blocking statuses: draft, rejected, cancelled, expired, completed
ALTER TABLE public.bookings ADD CONSTRAINT prevent_overlapping_active_bookings
    EXCLUDE USING gist (
        equipment_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    )
    WHERE (status IN ('pending_owner', 'awaiting_payment', 'confirmed', 'active'));

-- 12. BOOKING STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    from_status booking_status_enum,
    to_status booking_status_enum NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. BOOKING PRICE ITEMS (Detailed line-item audit trail)
CREATE TABLE IF NOT EXISTS public.booking_price_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'base_rent', 'delivery', 'deposit', 'platform_fee', 'gst_tax', 'discount'
    description TEXT NOT NULL,
    rate NUMERIC(12, 2) NOT NULL,
    quantity NUMERIC(8, 2) DEFAULT 1.0 NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    transaction_reference VARCHAR(64) UNIQUE NOT NULL,
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_provider TEXT DEFAULT 'mock' NOT NULL, -- 'mock', 'razorpay'
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    status payment_status_enum DEFAULT 'pending' NOT NULL,
    payment_method payment_method_enum NOT NULL,
    idempotency_key TEXT UNIQUE,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. PAYMENT WEBHOOK EVENTS (Idempotent processing)
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'processed', 'failed', 'ignored'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMPTZ
);

-- 16. REFUNDS
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
    refund_reference VARCHAR(64) UNIQUE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'processed', 'failed'
    gateway_refund_id TEXT,
    authorized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMPTZ
);

-- 17. EXCHANGE PROPOSALS (Idle-Time Equipment Exchange)
CREATE TABLE IF NOT EXISTS public.exchange_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_reference VARCHAR(20) UNIQUE NOT NULL,
    proposer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status exchange_status_enum DEFAULT 'proposed' NOT NULL,
    cash_adjustment_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    cash_payer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    terms_agreement TEXT,
    notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. EXCHANGE PROPOSAL ITEMS (Items offered and requested in the exchange)
CREATE TABLE IF NOT EXISTS public.exchange_proposal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id UUID NOT NULL REFERENCES public.exchange_proposals(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
    providing_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    receiving_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT exchange_item_range_valid CHECK (end_time > start_time)
);

-- 19. EXCHANGE PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.exchange_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id UUID NOT NULL REFERENCES public.exchange_proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    has_accepted BOOLEAN DEFAULT FALSE NOT NULL,
    accepted_at TIMESTAMPTZ,
    UNIQUE (exchange_id, user_id)
);

-- 20. EXCHANGE RESERVATIONS (Enforced atomic schedule reservation)
CREATE TABLE IF NOT EXISTS public.exchange_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id UUID NOT NULL REFERENCES public.exchange_proposals(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT exchange_reservation_range_valid CHECK (end_time > start_time)
);

-- Exclusion constraint to guarantee exchange reservations do not conflict with each other
ALTER TABLE public.exchange_reservations ADD CONSTRAINT prevent_overlapping_exchange_reservations
    EXCLUDE USING gist (
        equipment_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    )
    WHERE (is_active = TRUE);

-- 21. CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    exchange_id UUID REFERENCES public.exchange_proposals(id) ON DELETE SET NULL,
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
    subject TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 22. CONVERSATION PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (conversation_id, user_id)
);

-- 23. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 24. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'booking_request', 'booking_status', 'payment', 'exchange', 'message', 'maintenance', 'dispute'
    link_url TEXT,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 25. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    is_visible BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (booking_id, author_id) -- Only one review per completed booking per participant
);

-- 26. MAINTENANCE RECORDS
CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    maintenance_type TEXT NOT NULL, -- 'routine_service', 'oil_change', 'tire_replacement', 'engine_repair', 'blade_sharpening'
    description TEXT NOT NULL,
    cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (cost >= 0),
    service_date DATE NOT NULL,
    next_service_date DATE,
    performed_by TEXT,
    equipment_status_after maintenance_status_enum DEFAULT 'operational' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 27. DAMAGE REPORTS
CREATE TABLE IF NOT EXISTS public.damage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    severity damage_severity_enum DEFAULT 'minor' NOT NULL,
    description TEXT NOT NULL,
    estimated_cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (estimated_cost >= 0),
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'investigating', 'resolved'
    resolution_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 28. DAMAGE REPORT ATTACHMENTS
CREATE TABLE IF NOT EXISTS public.damage_report_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    damage_report_id UUID NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 29. DISPUTES
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_reference VARCHAR(20) UNIQUE NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    exchange_id UUID REFERENCES public.exchange_proposals(id) ON DELETE SET NULL,
    opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    against_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    desired_resolution TEXT,
    status dispute_status_enum DEFAULT 'opened' NOT NULL,
    admin_notes TEXT,
    resolution_summary TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 30. SAVED EQUIPMENT (Bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, equipment_id)
);

-- 31. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 32. PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_owner ON public.equipment(owner_id);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON public.equipment(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON public.equipment(state, district, pin_code);
CREATE INDEX IF NOT EXISTS idx_equipment_published ON public.equipment(is_published);
CREATE INDEX IF NOT EXISTS idx_bookings_equipment ON public.bookings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_renter ON public.bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_exchange_proposer ON public.exchange_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS idx_exchange_recipient ON public.exchange_proposals(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_equipment ON public.reviews(equipment_id);

