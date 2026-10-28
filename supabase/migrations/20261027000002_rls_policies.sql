-- ============================================================================
-- Migration: 20261027000002_rls_policies.sql
-- Description: Row Level Security (RLS) Policies and Access Control Functions
-- Target: Supabase PostgreSQL (Postgres 15+)
-- ============================================================================

-- Helper Security Functions (SECURITY DEFINER, safe search path)
CREATE OR REPLACE FUNCTION public.is_admin(lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF lookup_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = lookup_user_id AND role = 'admin'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_booking_participant(lookup_booking_id UUID, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF lookup_user_id IS NULL OR lookup_booking_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = lookup_booking_id AND (renter_id = lookup_user_id OR owner_id = lookup_user_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_exchange_participant(lookup_exchange_id UUID, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF lookup_user_id IS NULL OR lookup_exchange_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.exchange_participants
        WHERE exchange_id = lookup_exchange_id AND user_id = lookup_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.exchange_proposals
        WHERE id = lookup_exchange_id AND (proposer_id = lookup_user_id OR recipient_id = lookup_user_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(lookup_convo_id UUID, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF lookup_user_id IS NULL OR lookup_convo_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = lookup_convo_id AND user_id = lookup_user_id
    );
END;
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_blackout_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_price_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 2. USER ROLES POLICIES
DROP POLICY IF EXISTS "Users can read own roles or admins can read all" ON public.user_roles;
CREATE POLICY "Users can read own roles or admins can read all" ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can modify user roles" ON public.user_roles;
CREATE POLICY "Only admins can modify user roles" ON public.user_roles FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. USER VERIFICATIONS POLICIES
DROP POLICY IF EXISTS "Users can read own verification or admins can read all" ON public.user_verifications;
CREATE POLICY "Users can read own verification or admins can read all" ON public.user_verifications FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own verification request" ON public.user_verifications;
CREATE POLICY "Users can insert own verification request" ON public.user_verifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update verification status" ON public.user_verifications;
CREATE POLICY "Admins can update verification status" ON public.user_verifications FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. EQUIPMENT CATEGORIES POLICIES
DROP POLICY IF EXISTS "Categories are readable by everyone" ON public.equipment_categories;
CREATE POLICY "Categories are readable by everyone" ON public.equipment_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Categories can only be modified by admins" ON public.equipment_categories;
CREATE POLICY "Categories can only be modified by admins" ON public.equipment_categories FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. EQUIPMENT POLICIES
DROP POLICY IF EXISTS "Published equipment is viewable by all" ON public.equipment;
CREATE POLICY "Published equipment is viewable by all" ON public.equipment FOR SELECT
    USING (is_published = true OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners can insert their own equipment" ON public.equipment;
CREATE POLICY "Owners can insert their own equipment" ON public.equipment FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners or admins can update equipment" ON public.equipment;
CREATE POLICY "Owners or admins can update equipment" ON public.equipment FOR UPDATE
    USING (auth.uid() = owner_id OR public.is_admin())
    WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Owners or admins can delete equipment" ON public.equipment;
CREATE POLICY "Owners or admins can delete equipment" ON public.equipment FOR DELETE
    USING (auth.uid() = owner_id OR public.is_admin());

-- 6. EQUIPMENT IMAGES POLICIES
DROP POLICY IF EXISTS "Equipment images viewable by all" ON public.equipment_images;
CREATE POLICY "Equipment images viewable by all" ON public.equipment_images FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Owners can manage equipment images" ON public.equipment_images;
CREATE POLICY "Owners can manage equipment images" ON public.equipment_images FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.equipment WHERE id = equipment_id AND owner_id = auth.uid())
        OR public.is_admin()
    );

-- 7. EQUIPMENT LOCATIONS POLICIES
DROP POLICY IF EXISTS "Equipment locations viewable if authorized" ON public.equipment_locations;
CREATE POLICY "Equipment locations viewable if authorized" ON public.equipment_locations FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Owners can manage equipment locations" ON public.equipment_locations;
CREATE POLICY "Owners can manage equipment locations" ON public.equipment_locations FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.equipment WHERE id = equipment_id AND owner_id = auth.uid())
        OR public.is_admin()
    );

-- 8, 9, 10. PRICING & AVAILABILITY POLICIES
DROP POLICY IF EXISTS "Pricing rules readable by all" ON public.equipment_pricing_rules;
CREATE POLICY "Pricing rules readable by all" ON public.equipment_pricing_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners manage pricing rules" ON public.equipment_pricing_rules;
CREATE POLICY "Owners manage pricing rules" ON public.equipment_pricing_rules FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.equipment WHERE id = equipment_id AND owner_id = auth.uid())
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Availability rules readable by all" ON public.equipment_availability_rules;
CREATE POLICY "Availability rules readable by all" ON public.equipment_availability_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners manage availability rules" ON public.equipment_availability_rules;
CREATE POLICY "Owners manage availability rules" ON public.equipment_availability_rules FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.equipment WHERE id = equipment_id AND owner_id = auth.uid())
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Blackout periods readable by all" ON public.equipment_blackout_periods;
CREATE POLICY "Blackout periods readable by all" ON public.equipment_blackout_periods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners manage blackout periods" ON public.equipment_blackout_periods;
CREATE POLICY "Owners manage blackout periods" ON public.equipment_blackout_periods FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.equipment WHERE id = equipment_id AND owner_id = auth.uid())
        OR public.is_admin()
    );

-- 11. BOOKINGS POLICIES
DROP POLICY IF EXISTS "Participants or admins can view booking" ON public.bookings;
CREATE POLICY "Participants or admins can view booking" ON public.bookings FOR SELECT
    USING (auth.uid() = renter_id OR auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Renters can create booking" ON public.bookings;
CREATE POLICY "Renters can create booking" ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() = renter_id);

DROP POLICY IF EXISTS "Participants or admins can update booking" ON public.bookings;
CREATE POLICY "Participants or admins can update booking" ON public.bookings FOR UPDATE
    USING (auth.uid() = renter_id OR auth.uid() = owner_id OR public.is_admin())
    WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id OR public.is_admin());

-- 12, 13. BOOKING HISTORY & PRICE ITEMS
DROP POLICY IF EXISTS "Booking history visible to participants" ON public.booking_status_history;
CREATE POLICY "Booking history visible to participants" ON public.booking_status_history FOR SELECT
    USING (public.is_booking_participant(booking_id) OR public.is_admin());

DROP POLICY IF EXISTS "Booking price items visible to participants" ON public.booking_price_items;
CREATE POLICY "Booking price items visible to participants" ON public.booking_price_items FOR SELECT
    USING (public.is_booking_participant(booking_id) OR public.is_admin());

-- 14, 15, 16. PAYMENTS & REFUNDS
DROP POLICY IF EXISTS "Payments visible to participants" ON public.payment_transactions;
CREATE POLICY "Payments visible to participants" ON public.payment_transactions FOR SELECT
    USING (public.is_booking_participant(booking_id) OR recorded_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Refunds visible to participants" ON public.refunds;
CREATE POLICY "Refunds visible to participants" ON public.refunds FOR SELECT
    USING (public.is_booking_participant(booking_id) OR public.is_admin());

DROP POLICY IF EXISTS "Payment webhooks only accessible by service role or admin" ON public.payment_webhook_events;
CREATE POLICY "Payment webhooks only accessible by service role or admin" ON public.payment_webhook_events FOR ALL
    USING (public.is_admin());

-- 17, 18, 19, 20. EXCHANGES POLICIES
DROP POLICY IF EXISTS "Exchange proposals visible to participants or admin" ON public.exchange_proposals;
CREATE POLICY "Exchange proposals visible to participants or admin" ON public.exchange_proposals FOR SELECT
    USING (auth.uid() = proposer_id OR auth.uid() = recipient_id OR public.is_admin());

DROP POLICY IF EXISTS "Proposer can create exchange proposal" ON public.exchange_proposals;
CREATE POLICY "Proposer can create exchange proposal" ON public.exchange_proposals FOR INSERT
    WITH CHECK (auth.uid() = proposer_id);

DROP POLICY IF EXISTS "Participants can update exchange proposal" ON public.exchange_proposals;
CREATE POLICY "Participants can update exchange proposal" ON public.exchange_proposals FOR UPDATE
    USING (auth.uid() = proposer_id OR auth.uid() = recipient_id OR public.is_admin());

DROP POLICY IF EXISTS "Exchange items viewable by participants" ON public.exchange_proposal_items;
CREATE POLICY "Exchange items viewable by participants" ON public.exchange_proposal_items FOR SELECT
    USING (public.is_exchange_participant(exchange_id) OR public.is_admin());

DROP POLICY IF EXISTS "Exchange items manageable by participants" ON public.exchange_proposal_items;
CREATE POLICY "Exchange items manageable by participants" ON public.exchange_proposal_items FOR ALL
    USING (public.is_exchange_participant(exchange_id) OR public.is_admin());

DROP POLICY IF EXISTS "Exchange participants viewable by participants" ON public.exchange_participants;
CREATE POLICY "Exchange participants viewable by participants" ON public.exchange_participants FOR SELECT
    USING (public.is_exchange_participant(exchange_id) OR public.is_admin());

DROP POLICY IF EXISTS "Exchange reservations viewable by participants" ON public.exchange_reservations;
CREATE POLICY "Exchange reservations viewable by participants" ON public.exchange_reservations FOR SELECT
    USING (public.is_exchange_participant(exchange_id) OR public.is_admin());

-- 21, 22, 23. MESSAGES POLICIES
DROP POLICY IF EXISTS "Conversations visible to participants" ON public.conversations;
CREATE POLICY "Conversations visible to participants" ON public.conversations FOR SELECT
    USING (public.is_conversation_participant(id) OR public.is_admin());

DROP POLICY IF EXISTS "Participants view conversations participants" ON public.conversation_participants;
CREATE POLICY "Participants view conversations participants" ON public.conversation_participants FOR SELECT
    USING (public.is_conversation_participant(conversation_id) OR public.is_admin());

DROP POLICY IF EXISTS "Messages readable by conversation participants" ON public.messages;
CREATE POLICY "Messages readable by conversation participants" ON public.messages FOR SELECT
    USING (public.is_conversation_participant(conversation_id) OR public.is_admin());

DROP POLICY IF EXISTS "Messages sendable by conversation participants" ON public.messages;
CREATE POLICY "Messages sendable by conversation participants" ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id AND public.is_conversation_participant(conversation_id));

-- 24. NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Notifications readable by owner" ON public.notifications;
CREATE POLICY "Notifications readable by owner" ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Notifications updatable by owner" ON public.notifications;
CREATE POLICY "Notifications updatable by owner" ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 25. REVIEWS POLICIES
DROP POLICY IF EXISTS "Published reviews readable by all" ON public.reviews;
CREATE POLICY "Published reviews readable by all" ON public.reviews FOR SELECT
    USING (is_visible = true OR auth.uid() = author_id OR public.is_admin());

DROP POLICY IF EXISTS "Reviews insertable by transaction participant" ON public.reviews;
CREATE POLICY "Reviews insertable by transaction participant" ON public.reviews FOR INSERT
    WITH CHECK (auth.uid() = author_id AND public.is_booking_participant(booking_id));

DROP POLICY IF EXISTS "Admins can moderate reviews" ON public.reviews;
CREATE POLICY "Admins can moderate reviews" ON public.reviews FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 26. MAINTENANCE POLICIES
DROP POLICY IF EXISTS "Equipment owners can view and manage maintenance" ON public.maintenance_records;
CREATE POLICY "Equipment owners can view and manage maintenance" ON public.maintenance_records FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.equipment WHERE id = equipment_id AND owner_id = auth.uid())
        OR public.is_admin()
    );

-- 27, 28. DAMAGE REPORTS POLICIES
DROP POLICY IF EXISTS "Damage reports viewable by booking participants or admin" ON public.damage_reports;
CREATE POLICY "Damage reports viewable by booking participants or admin" ON public.damage_reports FOR SELECT
    USING (public.is_booking_participant(booking_id) OR public.is_admin());

DROP POLICY IF EXISTS "Damage reports insertable by booking participants" ON public.damage_reports;
CREATE POLICY "Damage reports insertable by booking participants" ON public.damage_reports FOR INSERT
    WITH CHECK (public.is_booking_participant(booking_id) AND auth.uid() = reported_by);

DROP POLICY IF EXISTS "Damage report attachments viewable by participants" ON public.damage_report_attachments;
CREATE POLICY "Damage report attachments viewable by participants" ON public.damage_report_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.damage_reports dr
            WHERE dr.id = damage_report_id AND (public.is_booking_participant(dr.booking_id) OR public.is_admin())
        )
    );

-- 29. DISPUTES POLICIES
DROP POLICY IF EXISTS "Disputes viewable by involved parties or admin" ON public.disputes;
CREATE POLICY "Disputes viewable by involved parties or admin" ON public.disputes FOR SELECT
    USING (auth.uid() = opened_by OR auth.uid() = against_user_id OR public.is_admin());

DROP POLICY IF EXISTS "Disputes can be opened by participant" ON public.disputes;
CREATE POLICY "Disputes can be opened by participant" ON public.disputes FOR INSERT
    WITH CHECK (auth.uid() = opened_by);

DROP POLICY IF EXISTS "Admins can update and resolve disputes" ON public.disputes;
CREATE POLICY "Admins can update and resolve disputes" ON public.disputes FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 30. SAVED EQUIPMENT POLICIES
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.saved_equipment;
CREATE POLICY "Users can manage own bookmarks" ON public.saved_equipment FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 31. AUDIT LOGS POLICIES
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can view audit logs" ON public.audit_logs FOR SELECT
    USING (public.is_admin());

-- 32. PLATFORM SETTINGS POLICIES
DROP POLICY IF EXISTS "Platform settings readable by all" ON public.platform_settings;
CREATE POLICY "Platform settings readable by all" ON public.platform_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Only admins can update platform settings" ON public.platform_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

