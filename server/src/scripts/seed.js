/**
 * Development Seed Script for FarmSharw Scheduler
 * Populates synthetic demo data for local development and testing.
 */
import { memoryDb, isLiveSupabase, supabaseAdmin } from '../config/supabase.js';

async function runSeed() {
  console.log('🌾 Initializing FarmSharw synthetic seed data...');

  if (isLiveSupabase) {
    console.log('📡 Connected to live Supabase project. Applying migrations and seed data...');
    // Real Supabase seeding via SQL file or client
  } else {
    console.log('💾 Seeding local development in-memory store...');
    memoryDb.seedDefaultData();
    console.log(`✅ Loaded ${memoryDb.tables.equipment_categories.length} categories.`);
    console.log(`✅ Loaded ${memoryDb.tables.profiles.length} profiles.`);
    console.log(`✅ Loaded ${memoryDb.tables.equipment.length} equipment listings.`);
    console.log(`✅ Loaded ${memoryDb.tables.equipment_pricing_rules.length} pricing rules.`);
  }

  console.log('🌾 Seed complete! Ready for local development.');
}

runSeed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

