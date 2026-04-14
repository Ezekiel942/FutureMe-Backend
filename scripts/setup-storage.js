#!/usr/bin/env node

/**
 * Supabase Storage Bucket Setup Script
 * Creates the 'uploads' bucket for file uploads
 *
 * Run with: node scripts/setup-storage.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function setupStorageBucket() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
  }

  // Use service role key for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const bucketName = 'uploads';

  try {
    console.log(`🔍 Checking if bucket '${bucketName}' exists...`);

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
      process.exit(1);
    }

    const bucketExists = buckets.some((bucket) => bucket.name === bucketName);

    if (bucketExists) {
      console.log(`✅ Bucket '${bucketName}' already exists`);

      // Update bucket to be public
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (updateError) {
        console.error('❌ Failed to update bucket settings:', updateError.message);
      } else {
        console.log(`✅ Bucket '${bucketName}' updated to be public`);
      }
    } else {
      console.log(`📦 Creating bucket '${bucketName}'...`);

      // Create bucket
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('❌ Failed to create bucket:', createError.message);
        process.exit(1);
      }

      console.log(`✅ Bucket '${bucketName}' created successfully`);
    }

    console.log('\n🎉 Storage setup complete!');
    console.log(`📁 Bucket: ${bucketName}`);
    console.log(`🌐 Public: true`);
    console.log(`📎 Allowed types: image/jpeg, image/png, application/pdf`);
    console.log(`📏 Max size: 5MB`);
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

setupStorageBucket();
