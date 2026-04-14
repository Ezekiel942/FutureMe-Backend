# Database Migrations

This directory contains SQL migration scripts for FutureMe database schema updates.

## ⚠️ Important: Database Adapter Update (Feb 2026)

The project has migrated from **TypeORM + Direct PostgreSQL** to **Supabase with custom adapter**.

**What changed:**

- TypeORM DataSource replaced with Supabase client adapter
- Schema changes now managed through Supabase dashboard or migrations
- Direct PostgreSQL connections no longer attempted on startup
- DATABASE_URL is now optional (Supabase credentials take precedence)

**For new migrations:** Use Supabase migration tools or apply SQL directly.

## Prerequisites

- **Supabase project** with PostgreSQL 12+ (Recommended)
- OR **PostgreSQL 12+** for direct connection (Legacy)
- Database connection configured in `.env` via:
  - `SUPABASE_URL` + `SUPABASE_ANON_KEY` (Recommended)
  - OR `DATABASE_URL` (Legacy direct PostgreSQL connection)
- **Backup your database before running migrations**

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to your project → **SQL Editor**
3. Click **New Query**
4. Copy the migration SQL from files below
5. Execute the query
6. Verify success in **Database** → **Tables**

### Option 2: Supabase CLI

```bash
# List pending migrations
supabase migration list

# Apply migrations
supabase migration up

# Create new migration
supabase migration new <migration_name>
```

### Option 3: psql (Direct PostgreSQL Connection)

If using legacy direct PostgreSQL connection:

```bash
# From workspace root
psql $DATABASE_URL -f apps/backend/migrations/001_add_organizationid_to_insights.sql
psql $DATABASE_URL -f apps/backend/migrations/002_ensure_organizationid_on_sessions_and_audit.sql
```

### Option 4: TypeORM CLI (Legacy)

If using TypeORM with migration support enabled:

```bash
# From apps/backend directory
npm run typeorm migration:run
```

## Migration Files

### 001_add_organizationid_to_insights.sql

**Purpose:** Add tenant scoping to Insights entity

**Status:** ✅ Recommended for all deployments

**Changes:**

- Adds `organizationId` column to `insights` table
- Backfills `organizationId` from user's organization
- Creates index for faster tenant-scoped queries

**Running (Supabase):**

```sql
-- Copy this SQL into Supabase Dashboard SQL Editor
-- See file: apps/backend/migrations/001_add_organizationid_to_insights.sql
```

**Running (Direct PostgreSQL):**

```bash
psql $DATABASE_URL -f apps/backend/migrations/001_add_organizationid_to_insights.sql
```

### 002_ensure_organizationid_on_sessions_and_audit.sql

**Purpose:** Ensure tenant scoping on WorkSession and AuditEntry

**Status:** ✅ Recommended for all deployments

**Changes:**

- Adds `organizationId` column to `work_sessions` table (if missing)
- Adds `organizationId` column to `audit_entries` table (if missing)
- Backfills from user organization data
- Creates composite indexes for efficient filtering

**Running (Supabase):**

```sql
-- Copy this SQL into Supabase Dashboard SQL Editor
-- See file: apps/backend/migrations/002_ensure_organizationid_on_sessions_and_audit.sql
```

**Running (Direct PostgreSQL):**

```bash
psql $DATABASE_URL -f apps/backend/migrations/002_ensure_organizationid_on_sessions_and_audit.sql
```

## Rollback

To rollback a migration (recreate schema without the changes):

**Supabase Dashboard SQL Editor:**

```sql
-- Rollback 002
DROP INDEX IF EXISTS idx_work_sessions_organizationId;
DROP INDEX IF EXISTS idx_work_sessions_userId_organizationId;
DROP INDEX IF EXISTS idx_audit_entries_organizationId;
ALTER TABLE work_sessions DROP COLUMN "organizationId" IF EXISTS;
ALTER TABLE audit_entries DROP COLUMN "organizationId" IF EXISTS;

-- Rollback 001
DROP INDEX IF EXISTS idx_insights_organizationId;
ALTER TABLE insights DROP COLUMN "organizationId" IF EXISTS;
```

**Direct PostgreSQL:**

```bash
psql $DATABASE_URL << EOF
-- (Same SQL as above)
EOF
```

⚠️ **Warning:** Reversing migrations may cause data loss. Backup your database first!

## Verification

After running migrations, verify they succeeded:

**Supabase Dashboard:**

1. Go to **Table Editor**
2. Check tables: `insights`, `work_sessions`, `audit_entries`
3. Verify `organizationId` column exists

**Direct PostgreSQL:**

```sql
-- Check for organizationId column in insights
SELECT column_name FROM information_schema.columns
WHERE table_name = 'insights' AND column_name = 'organizationId';

-- Check for indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('insights', 'work_sessions', 'audit_entries');
```

-- Verify backfilled data
SELECT COUNT(\*) as insights_with_org FROM insights WHERE "organizationId" IS NOT NULL;

```

## Troubleshooting

### "table does not exist" error

The migration includes `IF EXISTS` guards, so this is safe. It means the table hasn't been created yet by TypeORM.

### "column already exists" error

The migration uses `ADD COLUMN IF NOT EXISTS`, so re-running is safe.

### Index creation fails

Ensure the table exists and has data before creating an index. TypeORM should create the table automatically on first run.

## Using TypeORM with Migrations

If you want full TypeORM migration support:

1. Create TypeORM migration files in `apps/backend/src/migrations/`
2. Configure TypeORM DataSource with migration path
3. Run: `npm run typeorm migration:run`

Current setup uses manual migration scripts for flexibility across databases (PostgreSQL, SQLite).

## Next Steps

After running migrations:

1. Restart the backend server: `pnpm --filter @futureme/backend dev`
2. Test endpoints with `organizationId` filtering
3. Verify audit logs are scoped by organization
4. Monitor query performance with new indexes

---

**Last Updated:** March 26, 2026
**Database Adapter:** Supabase (migrated from TypeORM, Feb 26, 2026)
```
