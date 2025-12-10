# Password Migration Guide

## Overview

This guide explains how to migrate existing plain text passwords to secure bcrypt hashes.

## Prerequisites

1. ✅ bcrypt package installed (`npm install bcrypt`)
2. ✅ ts-node installed (`npm install -D ts-node`)
3. ✅ Environment variables configured (`.env.local`)

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **Important**: Use the **SERVICE ROLE KEY**, not the anon key, as this migration needs to bypass RLS.

## Migration Steps

### Step 1: Dry Run (Recommended)

First, run a dry-run to see what would be migrated without making any changes:

```bash
npm run migrate:passwords:dry-run
```

This will show you:
- Total number of users
- How many already have hashed passwords
- How many need migration
- List of users that would be migrated

### Step 2: Run the Migration

Once you've reviewed the dry-run output, run the actual migration:

```bash
npm run migrate:passwords
```

The script will:
1. Connect to your Supabase database
2. Fetch all users
3. Identify users with plain text passwords
4. Hash their passwords using bcrypt (12 rounds)
5. Update the database
6. Show a summary of the results

### Step 3: Verify

After migration, verify that:
1. Users can still log in with their existing passwords
2. New users are created with hashed passwords
3. No users have plain text passwords remaining

You can run the dry-run again to confirm:

```bash
npm run migrate:passwords:dry-run
```

Should show: "Need migration: 0"

## Example Output

### Dry Run

```
🔍 DRY RUN MODE - No changes will be made

📊 Current State:
   Total users: 10
   ✅ Already hashed: 0
   📝 Need migration: 10
   ⚠️  No password: 0

📋 Users that would be migrated:
   1. admin@escola.com
   2. professor@escola.com
   ...

💡 To run the actual migration, use: npm run migrate:passwords
```

### Actual Migration

```
🔐 Starting password migration...

✅ Connected to Supabase

📊 Found 10 users

📝 Users needing migration: 10
✅ Users already hashed: 0

⚠️  WARNING: This will update passwords in the database
📋 Users to migrate:
   1. admin@escola.com
   2. professor@escola.com
   ...

🔄 Processing batch 1 (10 users)...
  🔐 Hashing password for admin@escola.com...
  ✅ admin@escola.com - migrated successfully
  ...

============================================================
📊 MIGRATION SUMMARY
============================================================
✅ Successfully migrated: 10 users
❌ Failed migrations: 0 users
⏭️  Already hashed: 0 users
📝 Total users: 10

============================================================
🎉 Migration completed successfully!
```

## Troubleshooting

### Error: "Missing environment variables"

Make sure you have `.env.local` file with the required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Error: "Failed to fetch users"

- Check that your Supabase URL is correct
- Verify the service role key is valid
- Ensure your database is accessible

### Error: "Failed to update user X"

- Check database connection
- Verify RLS policies allow updates with service role key
- Check if the user still exists in the database

## Rollback

⚠️ **Important**: There is no automatic rollback for this migration!

The script doesn't keep a backup of old passwords. However:
- The old passwords are still the same value (e.g., "senha123")
- If a user has trouble logging in, an admin can always approve a new access request

For production, consider:
1. Taking a database backup before migration
2. Running in a staging environment first
3. Migrating users in batches during low-traffic periods

## Security Notes

1. **Service Role Key**: This key has full database access. Keep it secure and never commit it to version control.

2. **Password Visibility**: The script logs user emails but never logs passwords (plain text or hashed).

3. **Backward Compatibility**: The login page (`app/page.tsx`) supports both plain text and hashed passwords during the migration period. After migration is complete and verified, you can remove the backward compatibility code.

4. **Default Password**: All new users are created with the password "senha123" (now hashed). Consider implementing a "reset password" feature for production.

## Next Steps

After successful migration:

1. ✅ All existing passwords are now hashed
2. ✅ New users will be created with hashed passwords
3. ✅ Login works with bcrypt verification
4. 🔜 Remove backward compatibility code from login (optional)
5. 🔜 Implement password reset feature
6. 🔜 Add password change functionality
7. 🔜 Consider implementing Supabase Auth or JWT

## Questions?

Check the main project documentation or the `PRODUCTION_CHECKLIST.md` file for more information on the password security improvements.
