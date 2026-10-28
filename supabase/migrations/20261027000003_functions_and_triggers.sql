-- ============================================================================
-- Migration: 20261027000003_functions_and_triggers.sql
-- Description: Business Triggers, Audit, Search Helpers, and Storage Setup
-- Target: Supabase PostgreSQL (Postgres 15+)
-- ============================================================================

-- Function: Auto updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- Apply updated_at trigger to appropriate tables
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_equipment_updated_at ON public.equipment;
CREATE TRIGGER set_equipment_updated_at
    BEFORE UPDATE ON public.equipment
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_equipment_pricing_updated_at ON public.equipment_pricing_rules;
CREATE TRIGGER set_equipment_pricing_updated_at
    BEFORE UPDATE ON public.equipment_pricing_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_exchange_proposals_updated_at ON public.exchange_proposals;
CREATE TRIGGER set_exchange_proposals_updated_at
    BEFORE UPDATE ON public.exchange_proposals
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER set_damage_reports_updated_at
    BEFORE UPDATE ON public.damage_reports
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_disputes_updated_at ON public.disputes;
CREATE TRIGGER set_disputes_updated_at
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Trigger: Automatically create public.profiles and default user_role on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone_number,
        preferred_language
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Kisan User'),
        NEW.email,
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Assign default 'renter' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'renter')
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Audit booking status changes automatically
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.booking_status_history (
            booking_id,
            from_status,
            to_status,
            changed_by,
            notes
        )
        VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid(),
            COALESCE(NEW.cancellation_reason, 'Status updated')
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_status_update ON public.bookings;
CREATE TRIGGER on_booking_status_update
    AFTER UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- Trigger: Ensure equipment under maintenance cannot receive new active bookings
CREATE OR REPLACE FUNCTION public.check_equipment_maintenance_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    equip_status maintenance_status_enum;
BEGIN
    SELECT maintenance_status INTO equip_status
    FROM public.equipment
    WHERE id = NEW.equipment_id;

    IF equip_status = 'under_maintenance' THEN
        RAISE EXCEPTION 'Equipment % is currently under maintenance and cannot be booked.', NEW.equipment_id;
    ELSIF equip_status = 'decommissioned' THEN
        RAISE EXCEPTION 'Equipment % is decommissioned.', NEW.equipment_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_equipment_maintenance ON public.bookings;
CREATE TRIGGER trg_check_equipment_maintenance
    BEFORE INSERT ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.check_equipment_maintenance_on_booking();

-- Spatial Distance Helper: Haversine formula in pure PostgreSQL
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
    lat1 NUMERIC, lon1 NUMERIC,
    lat2 NUMERIC, lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r CONSTANT NUMERIC := 6371.0; -- Earth mean radius in km
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat / 2.0) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * (sin(dlon / 2.0) ^ 2);
    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
    RETURN ROUND((r * c)::numeric, 2);
END;
$$;

-- Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('equipment-images', 'equipment-images', true),
    ('profile-avatars', 'profile-avatars', true),
    ('verification-documents', 'verification-documents', false),
    ('damage-report-files', 'damage-report-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for equipment-images
DROP POLICY IF EXISTS "Public Read for Equipment Images" ON storage.objects;
CREATE POLICY "Public Read for Equipment Images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'equipment-images');

DROP POLICY IF EXISTS "Authenticated users can upload equipment images" ON storage.objects;
CREATE POLICY "Authenticated users can upload equipment images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'equipment-images' AND auth.role() = 'authenticated');

-- Storage Policies for verification-documents (Private)
DROP POLICY IF EXISTS "Private verification docs viewable by owner or admin" ON storage.objects;
CREATE POLICY "Private verification docs viewable by owner or admin"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'verification-documents'
        AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
    );

DROP POLICY IF EXISTS "Owner upload verification documents" ON storage.objects;
CREATE POLICY "Owner upload verification documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'verification-documents'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage Policies for damage-report-files (Private)
DROP POLICY IF EXISTS "Damage report files viewable by auth users or admin" ON storage.objects;
CREATE POLICY "Damage report files viewable by auth users or admin"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'damage-report-files'
        AND (auth.role() = 'authenticated' OR public.is_admin())
    );

DROP POLICY IF EXISTS "Authenticated upload for damage report files" ON storage.objects;
CREATE POLICY "Authenticated upload for damage report files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'damage-report-files'
        AND auth.role() = 'authenticated'
    );

