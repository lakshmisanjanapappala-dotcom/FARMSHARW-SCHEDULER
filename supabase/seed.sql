-- ============================================================================
-- Seed Data: Development and Demo Dataset for FarmSharw Scheduler
-- All identities and listings are synthetic and for development use only.
-- ============================================================================

-- Equipment Categories
INSERT INTO public.equipment_categories (id, slug, name, description, icon_name, display_order)
VALUES
    ('c1000000-0000-0000-0000-000000000001', 'tractors', 'Tractors', 'High and medium horsepower utility tractors for land preparation and hauling', 'tractor', 1),
    ('c1000000-0000-0000-0000-000000000002', 'rotavators', 'Rotavators', 'Rotary tillers for seedbed preparation, soil pulverization, and stubble incorporation', 'disc', 2),
    ('c1000000-0000-0000-0000-000000000003', 'harvesters', 'Harvesters & Combines', 'Self-propelled and multi-crop combine harvesters for paddy, wheat, and soybean', 'scissors', 3),
    ('c1000000-0000-0000-0000-000000000004', 'cultivators', 'Cultivators', 'Spring loaded and rigid tine cultivators for aeration and secondary tillage', 'grid', 4),
    ('c1000000-0000-0000-0000-000000000005', 'seed-drills', 'Seed Drills & Planters', 'Automatic seed-cum-fertilizer drills, happy seeders, and pneumatic planters', 'chevrons-down', 5),
    ('c1000000-0000-0000-0000-000000000006', 'sprayers', 'Boom & Power Sprayers', 'Tractor-mounted boom sprayers, electrostatic sprayers, and orchard mist blowers', 'wind', 6),
    ('c1000000-0000-0000-0000-000000000007', 'irrigation-pumps', 'Irrigation Pumps', 'High-capacity diesel and solar submersible pumps, rain-gun sprinkler sets', 'droplet', 7),
    ('c1000000-0000-0000-0000-000000000008', 'power-tillers', 'Power Tillers', 'Two-wheel walking power tillers for wet paddy puddling and horticulture plots', 'activity', 8),
    ('c1000000-0000-0000-0000-000000000009', 'ploughs', 'Ploughs (MB & Disc)', 'Hydraulic reversible mouldboard ploughs and heavy disc ploughs for deep breaking', 'anchor', 9),
    ('c1000000-0000-0000-0000-000000000010', 'trailers', 'Hydraulic Tipping Trailers', 'Single and double axle agricultural tipper trolleys with reinforced dropsides', 'truck', 10),
    ('c1000000-0000-0000-0000-000000000011', 'threshers', 'Multi-Crop Threshers', 'High output spike-tooth and axial-flow grain threshers for wheat and pulses', 'sun', 11),
    ('c1000000-0000-0000-0000-000000000012', 'other-machinery', 'Other Machinery', 'Baling machines, laser land levellers, post hole diggers, and chaff cutters', 'tool', 12)
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order;

-- Platform Settings
INSERT INTO public.platform_settings (key, value, description)
VALUES
    ('general', '{"platform_name": "FarmSharw Scheduler", "support_phone": "+91-1800-419-7890", "support_email": "sahayata@farmsharw.in", "default_currency": "INR", "timezone": "Asia/Kolkata"}'::jsonb, 'Platform identity and contact info'),
    ('pricing', '{"platform_fee_percent": 5.0, "gst_tax_percent": 18.0, "min_rental_hours": 2, "cash_on_pickup_enabled": true}'::jsonb, 'Global fee calculation parameters'),
    ('exchange', '{"auto_match_enabled": true, "max_radius_km": 50, "require_mutual_acceptance": true}'::jsonb, 'Rules governing idle-time machinery exchange'),
    ('regional_languages', '{"languages": [{"code": "en", "name": "English"}, {"code": "te", "name": "తెలుగు (Telugu)"}, {"code": "hi", "name": "हिन्दी (Hindi)"}, {"code": "ta", "name": "தமிழ் (Tamil)"}, {"code": "kn", "name": "ಕನ್ನಡ (Kannada)"}, {"code": "mr", "name": "मराठी (Marathi)"}]}'::jsonb, 'Supported regional localization configurations')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Synthetic Auth Users (Ensures public.profiles foreign key constraint is satisfied)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@farmsharw.in', crypt('AdminPass123!', gen_salt('bf')), timezone('utc'::text, now()), '{"provider":"email","providers":["email"]}', '{"full_name":"Ramesh Patel (Admin)"}', timezone('utc'::text, now()), timezone('utc'::text, now())),
    ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gurpreet.brar@example.com', crypt('OwnerPass123!', gen_salt('bf')), timezone('utc'::text, now()), '{"provider":"email","providers":["email"]}', '{"full_name":"Gurpreet Singh Brar (Owner)"}', timezone('utc'::text, now()), timezone('utc'::text, now())),
    ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'venkat.reddy@example.com', crypt('VenkatPass123!', gen_salt('bf')), timezone('utc'::text, now()), '{"provider":"email","providers":["email"]}', '{"full_name":"Venkateshwarlu Reddy (Owner & Renter)"}', timezone('utc'::text, now()), timezone('utc'::text, now())),
    ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'suresh.shinde@example.com', crypt('RenterPass123!', gen_salt('bf')), timezone('utc'::text, now()), '{"provider":"email","providers":["email"]}', '{"full_name":"Suresh Shinde (Renter)"}', timezone('utc'::text, now()), timezone('utc'::text, now()))
ON CONFLICT (id) DO NOTHING;

-- Synthetic Demo Profiles
INSERT INTO public.profiles (id, full_name, phone_number, phone_verified, email, bio, preferred_language, state, district, taluka_or_tehsil, village_or_town, pin_code, latitude, longitude)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Ramesh Patel (Admin)', '+919876543210', true, 'admin@farmsharw.in', 'Lead administrator and agricultural cooperative supervisor.', 'en', 'Gujarat', 'Mehsana', 'Kadi', 'Nandasan', '382705', 23.3100, 72.3900),
    ('a0000000-0000-0000-0000-000000000002', 'Gurpreet Singh Brar (Owner)', '+919812345678', true, 'gurpreet.brar@example.com', 'Progressive farmer operating 45 acres in Malwa belt with modern implements.', 'hi', 'Punjab', 'Bathinda', 'Talwandi Sabo', 'Raman Mandi', '151301', 29.9800, 75.0100),
    ('a0000000-0000-0000-0000-000000000003', 'Venkateshwarlu Reddy (Owner & Renter)', '+919948012345', true, 'venkat.reddy@example.com', 'Paddy and chili grower keen on machinery sharing during sowing season.', 'te', 'Telangana', 'Nalgonda', 'Miryalaguda', 'Wadapally', '508355', 16.8500, 79.5600),
    ('a0000000-0000-0000-0000-000000000004', 'Suresh Shinde (Renter)', '+919822334455', true, 'suresh.shinde@example.com', 'Sugarcane and soybean farmer looking for seasonal harvesting machinery.', 'mr', 'Maharashtra', 'Kolhapur', 'Karveer', 'Shiroli', '416122', 16.7400, 74.2700)
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    state = EXCLUDED.state,
    district = EXCLUDED.district;

-- User Roles
INSERT INTO public.user_roles (user_id, role)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin'),
    ('a0000000-0000-0000-0000-000000000002', 'owner'),
    ('a0000000-0000-0000-0000-000000000003', 'owner'),
    ('a0000000-0000-0000-0000-000000000003', 'renter'),
    ('a0000000-0000-0000-0000-000000000004', 'renter')
ON CONFLICT (user_id, role) DO NOTHING;

-- Synthetic Equipment
INSERT INTO public.equipment (
    id, owner_id, category_id, title, slug, equipment_type, manufacturer, model,
    manufacture_year, hp_power, description, condition, specifications,
    state, district, village_or_town, pin_code, approximate_lat, approximate_lng, exact_address,
    min_rental_hours, max_rental_days, booking_approval_policy, deposit_required, deposit_amount,
    delivery_offered, delivery_fee_per_km, max_delivery_radius_km, is_exchange_eligible, exchange_preferences,
    maintenance_status, is_published, is_verified
)
VALUES
    (
        'e1000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000002',
        'c1000000-0000-0000-0000-000000000001',
        'Mahindra 575 DI Sarpanch 45 HP Tractor',
        'mahindra-575-di-sarpanch-45hp-bathinda',
        '4WD Utility Tractor',
        'Mahindra & Mahindra',
        '575 DI Sarpanch',
        2022,
        45,
        'Heavy-duty 4-cylinder diesel engine with advanced hydraulics, power steering, and hitch assembly. Excellent fuel economy for ploughing, trolley transport, and rotavator operations.',
        'excellent',
        '{"pto_speed": "540 RPM", "transmission": "8 Forward + 2 Reverse", "lifting_capacity": "1600 kg", "fuel_tank": "47 Liters"}'::jsonb,
        'Punjab', 'Bathinda', 'Raman Mandi', '151301', 29.9820, 75.0120, 'Khasra 42/1, Bathinda-Talwandi Sabo Link Road, Raman Mandi',
        4, 30, 'instant', true, 2000.00,
        true, 25.00, 30, true, 'Willing to exchange for Laser Land Leveller or Multi-crop Harvester during off-peak wheat season',
        'operational', true, true
    ),
    (
        'e1000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000002',
        'c1000000-0000-0000-0000-000000000002',
        'Shaktiman Regular Light 7 Feet Rotavator',
        'shaktiman-regular-light-7ft-rotavator',
        'Rotary Tiller 7 Ft',
        'Shaktiman',
        'SRL 205',
        2023,
        NULL,
        'Equipped with 48 boron steel L-type blades, multispeed gearbox, and depth skid adjuster. Ideal for single-pass seedbed preparation in both wet and dry soils.',
        'excellent',
        '{"working_width": "205 cm", "number_of_blades": 48, "gearbox": "Multi Speed 540/1000", "weight": "425 kg"}'::jsonb,
        'Punjab', 'Bathinda', 'Raman Mandi', '151301', 29.9810, 75.0110, 'Near Grain Market, Raman Mandi',
        2, 14, 'manual', false, 0.00,
        true, 15.00, 20, true, 'Can exchange for Happy Seeder or Cultivator',
        'operational', true, true
    ),
    (
        'e1000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000003',
        'c1000000-0000-0000-0000-000000000003',
        'Preet 987 Self-Propelled Multi-Crop Combine Harvester',
        'preet-987-self-propelled-combine-harvester',
        'Combine Harvester',
        'Preet Agro',
        '987 Combine',
        2021,
        101,
        'Heavy-duty self-propelled track harvester capable of harvesting paddy, wheat, and oilseeds even in moist delta field conditions. AC cabin with high grain tank capacity.',
        'good',
        '{"cutter_bar_width": "14 Feet", "engine": "6 Cylinder 101 HP", "grain_tank": "2.4 Cubic Metres", "threshing_drum": "Peg Tooth"}'::jsonb,
        'Telangana', 'Nalgonda', 'Miryalaguda', '508355', 16.8520, 79.5620, 'Plot 88, Industrial Area Road, Wadapally, Miryalaguda',
        8, 20, 'manual', true, 5000.00,
        false, 0.00, 0, true, 'Need High HP Tractor with Disc Harrow in exchange during kharif sowing',
        'operational', true, true
    ),
    (
        'e1000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000003',
        'c1000000-0000-0000-0000-000000000007',
        'Kirloskar 10 HP Mobile Diesel Irrigation Pump Set',
        'kirloskar-10hp-diesel-irrigation-pump',
        'Centrifugal Water Pump',
        'Kirloskar Brothers',
        'DM-10 Mobile',
        2022,
        10,
        'High discharge centrifugal water pump mounted on a heavy trolley with rubber tyres for quick canal or borewell relocation. Includes 30m delivery hose and suction foot valve.',
        'good',
        '{"discharge_rate": "1200 Litres/Min", "head_range": "18-28 Metres", "fuel_consumption": "1.2 L/hr", "suction_pipe": "3 Inch"}'::jsonb,
        'Telangana', 'Nalgonda', 'Miryalaguda', '508355', 16.8510, 79.5610, 'Krishna River Canal Head, Miryalaguda',
        4, 30, 'instant', false, 0.00,
        true, 10.00, 15, true, 'Open to exchange for Power Weeder or Sprayer',
        'operational', true, true
    )
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_published = EXCLUDED.is_published;

-- Synthetic Pricing Rules (Explicit deterministic IDs for idempotent seeding)
INSERT INTO public.equipment_pricing_rules (id, equipment_id, hourly_rate, daily_rate, weekly_rate, seasonal_rate, currency, minimum_charge)
VALUES
    ('p1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 550.00, 3800.00, 22000.00, 75000.00, 'INR', 1100.00),
    ('p1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 300.00, 2000.00, 12000.00, 40000.00, 'INR', 600.00),
    ('p1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 2200.00, 16000.00, 95000.00, 280000.00, 'INR', 4400.00),
    ('p1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 180.00, 1200.00, 7000.00, 24000.00, 'INR', 360.00)
ON CONFLICT (id) DO UPDATE SET
    hourly_rate = EXCLUDED.hourly_rate,
    daily_rate = EXCLUDED.daily_rate,
    weekly_rate = EXCLUDED.weekly_rate,
    seasonal_rate = EXCLUDED.seasonal_rate;

-- Synthetic Images (Explicit deterministic IDs for idempotent seeding)
INSERT INTO public.equipment_images (id, equipment_id, storage_path, image_url, caption, is_primary, display_order)
VALUES
    ('m1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'equipment/mahindra-575.jpg', '/assets/images/tractor.svg', 'Mahindra 575 DI front three-quarter view', true, 1),
    ('m1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002', 'equipment/rotavator-7ft.jpg', '/assets/images/rotavator.svg', 'Shaktiman regular light 7ft rotavator with PTO shaft', true, 1),
    ('m1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003', 'equipment/preet-harvester.jpg', '/assets/images/harvester.svg', 'Preet 987 combine harvester in operation', true, 1),
    ('m1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', 'equipment/kirloskar-pump.jpg', '/assets/images/pump.svg', 'Kirloskar mobile diesel pump trolley', true, 1)
ON CONFLICT (id) DO UPDATE SET
    image_url = EXCLUDED.image_url,
    caption = EXCLUDED.caption;

