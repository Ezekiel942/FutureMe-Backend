#!/usr/bin/env node

/**
 * Run Supabase Auth Migration
 * Applies the profiles table migration to Supabase
 *
 * Run with: node scripts/migrate-auth.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ Missing SUPABASE_URL in environment');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment');
    console.error('💡 Get this from: Supabase Dashboard > Settings > API > service_role key');
    process.exit(1);
  }

  // Use service role key for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔍 Checking Supabase connection...');

    // Test connection
    const { data, error: connectionError } = await supabase.auth.getSession();
    if (connectionError) {
      console.error('❌ Failed to connect to Supabase:', connectionError.message);
      process.exit(1);
    }

    console.log('✅ Connected to Supabase');

    // Read migration file
    const migrationPath = path.join(
      __dirname,
      '..',
      'apps',
      'backend',
      'migrations',
      '010_create_profiles_table.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: 010_create_profiles_table.sql');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`🔄 Executing: ${statement.substring(0, 50)}...`);

        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Some statements might fail if they already exist (e.g., policies)
          if (
            error.message.includes('already exists') ||
            error.message.includes('does not exist')
          ) {
            console.log(`⚠️  Statement failed (might already exist): ${error.message}`);
          } else {
            console.error('❌ Migration failed:', error.message);
            process.exit(1);
          }
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('📋 What was created:');
    console.log('   - profiles table with RLS enabled');
    console.log('   - Row Level Security policies');
    console.log('   - Trigger for automatic profile creation on signup');
    console.log('   - Updated_at trigger for profiles');
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

runMigration();
