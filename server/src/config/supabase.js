import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const isDummyConfig = !env.SUPABASE_URL || 
  env.SUPABASE_URL.includes('dummy-project') || 
  !env.SUPABASE_ANON_KEY || 
  env.SUPABASE_ANON_KEY.includes('dummy');

export const isLiveSupabase = !isDummyConfig;
export const hasRealServiceRole = isLiveSupabase && 
  env.SUPABASE_SERVICE_ROLE_KEY && 
  env.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_ANON_KEY &&
  !env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_');

// Initialize official client
export const supabasePublic = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Resilient in-memory store for dev/testing when external database is not connected
class MemoryDB {
  constructor() {
    this.tables = {
      equipment_categories: [],
      profiles: [],
      user_roles: [],
      equipment: [],
      equipment_images: [],
      equipment_pricing_rules: [],
      equipment_availability_rules: [],
      equipment_blackout_periods: [],
      bookings: [],
      booking_price_items: [],
      booking_status_history: [],
      exchange_proposals: [],
      exchange_proposal_items: [],
      exchange_participants: [],
      exchange_reservations: [],
      payment_transactions: [],
      payment_webhook_events: [],
      refunds: [],
      conversations: [],
      conversation_participants: [],
      messages: [],
      notifications: [],
      reviews: [],
      maintenance_records: [],
      damage_reports: [],
      disputes: [],
      saved_equipment: [],
      audit_logs: [],
      platform_settings: []
    };
    this.seedDefaultData();
  }

  seedDefaultData() {
    // Seed categories
    this.tables.equipment_categories = [
      { id: 'c1000000-0000-0000-0000-000000000001', slug: 'tractors', name: 'Tractors', description: 'High and medium horsepower utility tractors', icon_name: 'tractor', display_order: 1, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000002', slug: 'rotavators', name: 'Rotavators', description: 'Rotary tillers for seedbed preparation', icon_name: 'disc', display_order: 2, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000003', slug: 'harvesters', name: 'Harvesters & Combines', description: 'Multi-crop combine harvesters', icon_name: 'scissors', display_order: 3, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000004', slug: 'cultivators', name: 'Cultivators', description: 'Spring loaded and rigid tine cultivators', icon_name: 'grid', display_order: 4, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000005', slug: 'seed-drills', name: 'Seed Drills & Planters', description: 'Seed-cum-fertilizer drills and happy seeders', icon_name: 'chevrons-down', display_order: 5, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000006', slug: 'sprayers', name: 'Boom & Power Sprayers', description: 'Tractor-mounted boom sprayers', icon_name: 'wind', display_order: 6, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000007', slug: 'irrigation-pumps', name: 'Irrigation Pumps', description: 'Mobile diesel & solar centrifugal pumps', icon_name: 'droplet', display_order: 7, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000008', slug: 'power-tillers', name: 'Power Tillers', description: 'Walking power tillers for wet puddling', icon_name: 'activity', display_order: 8, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000009', slug: 'ploughs', name: 'Ploughs (MB & Disc)', description: 'Reversible mouldboard & disc ploughs', icon_name: 'anchor', display_order: 9, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000010', slug: 'trailers', name: 'Hydraulic Tipping Trailers', description: 'Hydraulic tipper farm trolleys', icon_name: 'truck', display_order: 10, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000011', slug: 'threshers', name: 'Multi-Crop Threshers', description: 'Axial-flow grain threshers', icon_name: 'sun', display_order: 11, is_active: true },
      { id: 'c1000000-0000-0000-0000-000000000012', slug: 'other-machinery', name: 'Other Machinery', description: 'Laser land levellers, balers, post hole diggers', icon_name: 'tool', display_order: 12, is_active: true }
    ];

    // Seed default profiles
    this.tables.profiles = [
      { id: 'a0000000-0000-0000-0000-000000000001', full_name: 'Ramesh Patel (Admin)', phone_number: '+919876543210', phone_verified: true, email: 'admin@farmsharw.in', bio: 'Platform Admin', preferred_language: 'en', state: 'Gujarat', district: 'Mehsana', village_or_town: 'Nandasan', pin_code: '382705', latitude: 23.31, longitude: 72.39, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'a0000000-0000-0000-0000-000000000002', full_name: 'Gurpreet Singh Brar (Owner)', phone_number: '+919812345678', phone_verified: true, email: 'gurpreet.brar@example.com', bio: 'Progressive farmer operating 45 acres in Bathinda', preferred_language: 'hi', state: 'Punjab', district: 'Bathinda', village_or_town: 'Raman Mandi', pin_code: '151301', latitude: 29.98, longitude: 75.01, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'a0000000-0000-0000-0000-000000000003', full_name: 'Venkateshwarlu Reddy (Owner & Renter)', phone_number: '+919948012345', phone_verified: true, email: 'venkat.reddy@example.com', bio: 'Paddy grower in Miryalaguda', preferred_language: 'te', state: 'Telangana', district: 'Nalgonda', village_or_town: 'Miryalaguda', pin_code: '508355', latitude: 16.85, longitude: 79.56, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'a0000000-0000-0000-0000-000000000004', full_name: 'Suresh Shinde (Renter)', phone_number: '+919822334455', phone_verified: true, email: 'suresh.shinde@example.com', bio: 'Sugarcane and soybean farmer', preferred_language: 'mr', state: 'Maharashtra', district: 'Kolhapur', village_or_town: 'Shiroli', pin_code: '416122', latitude: 16.74, longitude: 74.27, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];

    // Seed roles
    this.tables.user_roles = [
      { id: 'r1', user_id: 'a0000000-0000-0000-0000-000000000001', role: 'admin' },
      { id: 'r2', user_id: 'a0000000-0000-0000-0000-000000000002', role: 'owner' },
      { id: 'r3', user_id: 'a0000000-0000-0000-0000-000000000003', role: 'owner' },
      { id: 'r4', user_id: 'a0000000-0000-0000-0000-000000000003', role: 'renter' },
      { id: 'r5', user_id: 'a0000000-0000-0000-0000-000000000004', role: 'renter' }
    ];

    // Seed equipment
    this.tables.equipment = [
      {
        id: 'e1000000-0000-0000-0000-000000000001',
        owner_id: 'a0000000-0000-0000-0000-000000000002',
        category_id: 'c1000000-0000-0000-0000-000000000001',
        title: 'Mahindra 575 DI Sarpanch 45 HP Tractor',
        slug: 'mahindra-575-di-sarpanch-45hp-bathinda',
        equipment_type: '4WD Utility Tractor',
        manufacturer: 'Mahindra & Mahindra',
        model: '575 DI Sarpanch',
        manufacture_year: 2022,
        hp_power: 45,
        description: 'Heavy-duty 4-cylinder diesel engine with advanced hydraulics, power steering, and hitch assembly. Excellent fuel economy for ploughing, trolley transport, and rotavator operations.',
        condition: 'excellent',
        specifications: { pto_speed: '540 RPM', transmission: '8 Forward + 2 Reverse', lifting_capacity: '1600 kg' },
        state: 'Punjab',
        district: 'Bathinda',
        village_or_town: 'Raman Mandi',
        pin_code: '151301',
        approximate_lat: 29.982,
        approximate_lng: 75.012,
        exact_address: 'Khasra 42/1, Bathinda-Talwandi Sabo Link Road, Raman Mandi',
        min_rental_hours: 4,
        max_rental_days: 30,
        booking_approval_policy: 'instant',
        deposit_required: true,
        deposit_amount: 2000,
        delivery_offered: true,
        delivery_fee_per_km: 25,
        max_delivery_radius_km: 30,
        is_exchange_eligible: true,
        exchange_preferences: 'Willing to exchange for Laser Land Leveller or Multi-crop Harvester during off-peak wheat season',
        maintenance_status: 'operational',
        is_published: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'e1000000-0000-0000-0000-000000000002',
        owner_id: 'a0000000-0000-0000-0000-000000000002',
        category_id: 'c1000000-0000-0000-0000-000000000002',
        title: 'Shaktiman Regular Light 7 Feet Rotavator',
        slug: 'shaktiman-regular-light-7ft-rotavator',
        equipment_type: 'Rotary Tiller 7 Ft',
        manufacturer: 'Shaktiman',
        model: 'SRL 205',
        manufacture_year: 2023,
        hp_power: null,
        description: 'Equipped with 48 boron steel L-type blades, multispeed gearbox, and depth skid adjuster. Ideal for single-pass seedbed preparation in both wet and dry soils.',
        condition: 'excellent',
        specifications: { working_width: '205 cm', number_of_blades: 48, weight: '425 kg' },
        state: 'Punjab',
        district: 'Bathinda',
        village_or_town: 'Raman Mandi',
        pin_code: '151301',
        approximate_lat: 29.981,
        approximate_lng: 75.011,
        exact_address: 'Near Grain Market, Raman Mandi',
        min_rental_hours: 2,
        max_rental_days: 14,
        booking_approval_policy: 'manual',
        deposit_required: false,
        deposit_amount: 0,
        delivery_offered: true,
        delivery_fee_per_km: 15,
        max_delivery_radius_km: 20,
        is_exchange_eligible: true,
        exchange_preferences: 'Can exchange for Happy Seeder or Cultivator',
        maintenance_status: 'operational',
        is_published: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'e1000000-0000-0000-0000-000000000003',
        owner_id: 'a0000000-0000-0000-0000-000000000003',
        category_id: 'c1000000-0000-0000-0000-000000000003',
        title: 'Preet 987 Self-Propelled Multi-Crop Combine Harvester',
        slug: 'preet-987-self-propelled-combine-harvester',
        equipment_type: 'Combine Harvester',
        manufacturer: 'Preet Agro',
        model: '987 Combine',
        manufacture_year: 2021,
        hp_power: 101,
        description: 'Heavy-duty self-propelled track harvester capable of harvesting paddy, wheat, and oilseeds even in moist delta field conditions. AC cabin with high grain tank capacity.',
        condition: 'good',
        specifications: { cutter_bar_width: '14 Feet', engine: '6 Cylinder 101 HP' },
        state: 'Telangana',
        district: 'Nalgonda',
        village_or_town: 'Miryalaguda',
        pin_code: '508355',
        approximate_lat: 16.852,
        approximate_lng: 79.562,
        exact_address: 'Plot 88, Industrial Area Road, Wadapally, Miryalaguda',
        min_rental_hours: 8,
        max_rental_days: 20,
        booking_approval_policy: 'manual',
        deposit_required: true,
        deposit_amount: 5000,
        delivery_offered: false,
        delivery_fee_per_km: 0,
        max_delivery_radius_km: 0,
        is_exchange_eligible: true,
        exchange_preferences: 'Need High HP Tractor with Disc Harrow in exchange during kharif sowing',
        maintenance_status: 'operational',
        is_published: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'e1000000-0000-0000-0000-000000000004',
        owner_id: 'a0000000-0000-0000-0000-000000000003',
        category_id: 'c1000000-0000-0000-0000-000000000007',
        title: 'Kirloskar 10 HP Mobile Diesel Irrigation Pump Set',
        slug: 'kirloskar-10hp-diesel-irrigation-pump',
        equipment_type: 'Centrifugal Water Pump',
        manufacturer: 'Kirloskar Brothers',
        model: 'DM-10 Mobile',
        manufacture_year: 2022,
        hp_power: 10,
        description: 'High discharge centrifugal water pump mounted on a heavy trolley with rubber tyres for quick canal or borewell relocation. Includes 30m delivery hose and suction foot valve.',
        condition: 'good',
        specifications: { discharge_rate: '1200 Litres/Min', head_range: '18-28 Metres' },
        state: 'Telangana',
        district: 'Nalgonda',
        village_or_town: 'Miryalaguda',
        pin_code: '508355',
        approximate_lat: 16.851,
        approximate_lng: 79.561,
        exact_address: 'Krishna River Canal Head, Miryalaguda',
        min_rental_hours: 4,
        max_rental_days: 30,
        booking_approval_policy: 'instant',
        deposit_required: false,
        deposit_amount: 0,
        delivery_offered: true,
        delivery_fee_per_km: 10,
        max_delivery_radius_km: 15,
        is_exchange_eligible: true,
        exchange_preferences: 'Open to exchange for Power Weeder or Sprayer',
        maintenance_status: 'operational',
        is_published: true,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    // Seed pricing rules
    this.tables.equipment_pricing_rules = [
      { id: 'pr1', equipment_id: 'e1000000-0000-0000-0000-000000000001', hourly_rate: 550, daily_rate: 3800, weekly_rate: 22000, seasonal_rate: 75000, currency: 'INR', minimum_charge: 1100, is_active: true },
      { id: 'pr2', equipment_id: 'e1000000-0000-0000-0000-000000000002', hourly_rate: 300, daily_rate: 2000, weekly_rate: 12000, seasonal_rate: 40000, currency: 'INR', minimum_charge: 600, is_active: true },
      { id: 'pr3', equipment_id: 'e1000000-0000-0000-0000-000000000003', hourly_rate: 2200, daily_rate: 16000, weekly_rate: 95000, seasonal_rate: 280000, currency: 'INR', minimum_charge: 4400, is_active: true },
      { id: 'pr4', equipment_id: 'e1000000-0000-0000-0000-000000000004', hourly_rate: 180, daily_rate: 1200, weekly_rate: 7000, seasonal_rate: 24000, currency: 'INR', minimum_charge: 360, is_active: true }
    ];

    // Seed equipment images
    this.tables.equipment_images = [
      { id: 'img1', equipment_id: 'e1000000-0000-0000-0000-000000000001', storage_path: 'equipment/mahindra-575.jpg', image_url: '/assets/images/tractor.svg', caption: 'Mahindra 575 DI Sarpanch', is_primary: true },
      { id: 'img2', equipment_id: 'e1000000-0000-0000-0000-000000000002', storage_path: 'equipment/rotavator-7ft.jpg', image_url: '/assets/images/rotavator.svg', caption: 'Shaktiman 7ft Rotavator', is_primary: true },
      { id: 'img3', equipment_id: 'e1000000-0000-0000-0000-000000000003', storage_path: 'equipment/preet-harvester.jpg', image_url: '/assets/images/harvester.svg', caption: 'Preet 987 Harvester', is_primary: true },
      { id: 'img4', equipment_id: 'e1000000-0000-0000-0000-000000000004', storage_path: 'equipment/kirloskar-pump.jpg', image_url: '/assets/images/pump.svg', caption: 'Kirloskar Diesel Irrigation Pump', is_primary: true }
    ];
  }
}

export const memoryDb = new MemoryDB();

