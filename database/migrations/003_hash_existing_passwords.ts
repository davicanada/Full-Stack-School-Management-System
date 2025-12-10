/**
 * Migration Script: Hash Existing Plain Text Passwords
 *
 * This script migrates all existing plain text passwords in the database
 * to secure bcrypt hashes.
 *
 * IMPORTANT: Run this script ONCE after deploying the password hashing code changes.
 *
 * Prerequisites:
 * - bcryptjs package must be installed (npm install bcryptjs)
 * - Environment variables must be set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * Usage:
 *   npx ts-node database/migrations/003_hash_existing_passwords.ts
 *
 * Or with explicit environment:
 *   NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx ts-node database/migrations/003_hash_existing_passwords.ts
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Configuration
const SALT_ROUNDS = 12;
const BATCH_SIZE = 50; // Process users in batches to avoid memory issues

// Bcrypt hash pattern
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

/**
 * Check if a string is already a bcrypt hash
 */
function isBcryptHash(str: string): boolean {
  return BCRYPT_PATTERN.test(str);
}

/**
 * Main migration function
 */
async function migratePasswords() {
  console.log('🔐 Starting password migration...\n');

  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing environment variables');
    console.error('Required:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('✅ Connected to Supabase\n');

  try {
    // Fetch all users
    console.log('📊 Fetching all users...');
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, password_hash');

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  No users found in database');
      return;
    }

    console.log(`✅ Found ${users.length} users\n`);

    // Filter users with plain text passwords (not already hashed)
    const usersToMigrate = users.filter(user => {
      if (!user.password_hash) {
        console.warn(`⚠️  User ${user.email} has no password - skipping`);
        return false;
      }
      return !isBcryptHash(user.password_hash);
    });

    console.log(`📝 Users needing migration: ${usersToMigrate.length}`);
    console.log(`✅ Users already hashed: ${users.length - usersToMigrate.length}\n`);

    if (usersToMigrate.length === 0) {
      console.log('🎉 All passwords are already hashed! Nothing to do.');
      return;
    }

    // Confirm before proceeding
    console.log('⚠️  WARNING: This will update passwords in the database');
    console.log('📋 Users to migrate:');
    usersToMigrate.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email}`);
    });
    console.log();

    // Process users in batches
    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < usersToMigrate.length; i += BATCH_SIZE) {
      const batch = usersToMigrate.slice(i, i + BATCH_SIZE);
      console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} users)...`);

      // Hash passwords in parallel within the batch
      const hashPromises = batch.map(async (user) => {
        try {
          console.log(`  🔐 Hashing password for ${user.email}...`);

          // Hash the plain text password
          const hashedPassword = await bcrypt.hash(user.password_hash, SALT_ROUNDS);

          // Update in database
          const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: hashedPassword })
            .eq('id', user.id);

          if (updateError) {
            throw updateError;
          }

          console.log(`  ✅ ${user.email} - migrated successfully`);
          return { success: true, email: user.email };

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`  ❌ ${user.email} - failed: ${errorMsg}`);
          return { success: false, email: user.email, error: errorMsg };
        }
      });

      // Wait for all promises in this batch
      const results = await Promise.all(hashPromises);

      // Count successes and failures
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          errors.push({ email: result.email, error: result.error || 'Unknown error' });
        }
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount} users`);
    console.log(`❌ Failed migrations: ${failCount} users`);
    console.log(`⏭️  Already hashed: ${users.length - usersToMigrate.length} users`);
    console.log(`📝 Total users: ${users.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`   - ${err.email}: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    if (failCount === 0) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with errors. Please review the failed users above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Dry run mode - shows what would be migrated without making changes
 */
async function dryRun() {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, password_hash');

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('ℹ️  No users found');
    return;
  }

  const toMigrate = users.filter(u => u.password_hash && !isBcryptHash(u.password_hash));
  const alreadyHashed = users.filter(u => u.password_hash && isBcryptHash(u.password_hash));
  const noPassword = users.filter(u => !u.password_hash);

  console.log('📊 Current State:');
  console.log(`   Total users: ${users.length}`);
  console.log(`   ✅ Already hashed: ${alreadyHashed.length}`);
  console.log(`   📝 Need migration: ${toMigrate.length}`);
  console.log(`   ⚠️  No password: ${noPassword.length}`);

  if (toMigrate.length > 0) {
    console.log('\n📋 Users that would be migrated:');
    toMigrate.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email}`);
    });
  }

  console.log('\n💡 To run the actual migration, use: npm run migrate:passwords');
}

// Check command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Run migration
if (isDryRun) {
  dryRun()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
} else {
  migratePasswords()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
