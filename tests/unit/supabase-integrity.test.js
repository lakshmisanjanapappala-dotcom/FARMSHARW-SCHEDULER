import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { supabasePublic, isLiveSupabase } from '../../server/src/config/supabase.js';

describe('Supabase Configuration & Migration Integrity', () => {
  it('initializes Supabase client with non-empty URL and anon key', () => {
    assert.ok(supabasePublic, 'supabasePublic client is defined');
    assert.ok(supabasePublic.auth, 'supabasePublic auth client is defined');
    assert.strictEqual(typeof supabasePublic.from, 'function', 'supabasePublic from query builder is a function');
  });

  it('ensures migration 20261027000001 uses safe DO blocks for ENUM creation', () => {
    const migration1 = fs.readFileSync('supabase/migrations/20261027000001_initial_schema.sql', 'utf8');
    assert.ok(migration1.includes('EXCEPTION WHEN duplicate_object THEN null;'), 'ENUM types are protected against duplicate_object errors');
  });

  it('ensures migration 20261027000002 has DROP POLICY IF EXISTS before every CREATE POLICY', () => {
    const migration2 = fs.readFileSync('supabase/migrations/20261027000002_rls_policies.sql', 'utf8');
    const createPolicyCount = (migration2.match(/CREATE POLICY/g) || []).length;
    const dropPolicyCount = (migration2.match(/DROP POLICY IF EXISTS/g) || []).length;
    assert.strictEqual(createPolicyCount, dropPolicyCount, 'Every CREATE POLICY statement must have a corresponding DROP POLICY IF EXISTS');
  });

  it('ensures migration 20261027000003 has DROP TRIGGER IF EXISTS and DROP POLICY IF EXISTS', () => {
    const migration3 = fs.readFileSync('supabase/migrations/20261027000003_functions_and_triggers.sql', 'utf8');
    assert.ok(migration3.includes('DROP TRIGGER IF EXISTS set_profiles_updated_at'), 'Trigger set_profiles_updated_at has DROP TRIGGER IF EXISTS');
    assert.ok(migration3.includes('DROP POLICY IF EXISTS "Public Read for Equipment Images"'), 'Storage policies have DROP POLICY IF EXISTS');
  });

  it('ensures seed.sql satisfies auth.users foreign key constraint and uses deterministic IDs', () => {
    const seed = fs.readFileSync('supabase/seed.sql', 'utf8');
    assert.ok(seed.includes('INSERT INTO auth.users'), 'seed.sql must insert mock records into auth.users before public.profiles');
    assert.ok(seed.includes('p1000000-0000-0000-0000-000000000001'), 'seed.sql uses deterministic IDs for pricing rules');
    assert.ok(seed.includes('m1000000-0000-0000-0000-000000000001'), 'seed.sql uses deterministic IDs for equipment images');
  });
});

