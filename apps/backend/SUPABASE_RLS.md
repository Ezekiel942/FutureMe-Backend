# Supabase Row Level Security (RLS) Implementation Guide

## Overview

This guide documents the Row Level Security policies required for multi-tenant data isolation in Supabase. Every table must implement `tenant_id`-based RLS to prevent cross-tenant data leakage.

## Core Principle

**Only users can access rows where `tenant_id` matches their organization.**

---

## RLS Policy Template

All tables follow this pattern:

```sql
-- Enable RLS on table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can only see their org's data
CREATE POLICY "Users can select their org's data"
  ON table_name FOR SELECT
  USING (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Policy 2: INSERT - Users can only insert for their org
CREATE POLICY "Users can insert into their org"
  ON table_name FOR INSERT
  WITH CHECK (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Policy 3: UPDATE - Users can only update their org's data
CREATE POLICY "Users can update their org's data"
  ON table_name FOR UPDATE
  USING (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Policy 4: DELETE - Users can only delete from their org
CREATE POLICY "Users can delete from their org"
  ON table_name FOR DELETE
  USING (tenant_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Admin bypass (optional - for service roles)
CREATE POLICY "Service role can access all"
  ON table_name
  USING (auth.role() = 'service_role');
```

---

## Tables and RLS Policies

### 1. **users** table

```sql
-- Required columns: id, organization_id (as tenant_id), email, password_hash

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org members"
  ON users FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admin only: delete users"
  ON users FOR DELETE
  USING (
    COALESCE(
      (SELECT role FROM users WHERE id = auth.uid() AND organization_id = users.organization_id),
      'member'
    ) = 'admin'
  );
```

### 2. **organizations** table

```sql
-- Required columns: id, name

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can update organization"
  ON organizations FOR UPDATE
  USING (
    id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND auth.uid() IN (SELECT id FROM users WHERE organization_id = id AND role = 'admin')
  );
```

### 3. **work_sessions** table

```sql
-- Required columns: id, user_id, organization_id (as tenant_id), project_id, start_time, end_time

ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions in their org"
  ON work_sessions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create sessions in their org"
  ON work_sessions FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their sessions"
  ON work_sessions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
```

### 4. **risk_events** table

```sql
-- Required columns: id, user_id, organization_id (as tenant_id), type, severity

ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view org risk events"
  ON risk_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can create risk events"
  ON risk_events FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

### 5. **audit_logs** table

```sql
-- Required columns: id, organization_id (as tenant_id), user_id, action, entity_type, entity_id

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org audit logs"
  ON audit_logs FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND (
      auth.uid() IN (SELECT id FROM users WHERE organization_id = audit_logs.organization_id AND role IN ('admin', 'manager'))
      OR user_id = auth.uid()
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

### 6. **tasks** table

```sql
-- Required columns: id, project_id, organization_id (as tenant_id), title, status

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their org"
  ON tasks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Managers can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND auth.uid() IN (SELECT id FROM users WHERE organization_id = organization_id AND role IN ('admin', 'manager'))
  );
```

### 7. **projects** table

```sql
-- Required columns: id, organization_id (as tenant_id), name, status

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their org"
  ON projects FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Managers can manage projects"
  ON projects FOR INSERT OR UPDATE OR DELETE
  USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    AND auth.uid() IN (SELECT id FROM users WHERE organization_id = organization_id AND role IN ('admin', 'manager'))
  );
```

### 8. **analytics** table

```sql
-- Required columns: id, organization_id (as tenant_id), user_id, metric_name, value

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org analytics"
  ON analytics FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can write analytics"
  ON analytics FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

### 9. **sessions** table (JWT refresh tokens)

```sql
-- Required columns: id, user_id, organization_id (as tenant_id), token, expires_at

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their sessions"
  ON sessions FOR SELECT OR UPDATE OR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

### 10. **insights** table

```sql
-- Required columns: id, organization_id (as tenant_id), user_id, insight_type, data

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org insights"
  ON insights FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can create insights"
  ON insights FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

---

## Verification Checklist

### Setup

- [ ] All tables have `tenant_id` or `organization_id` column
- [ ] RLS enabled on all tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
- [ ] Policies enforced via `auth.uid()` (Supabase auth)
- [ ] Service role bypass for batch operations

### Testing

- [ ] User A **cannot** see User B's data (same org)

  ```sql
  -- As User A, should return empty
  SELECT * FROM work_sessions WHERE user_id = 'user-b-uid';
  ```

- [ ] User cannot access other organization's data

  ```sql
  -- As User A in Org 1, should return nothing
  SELECT * FROM work_sessions WHERE organization_id != 'org-1';
  ```

- [ ] Admins can manage all org data

  ```sql
  -- Admin should see all sessions in org
  SELECT COUNT(*) FROM work_sessions;
  ```

- [ ] Service role can bypass RLS (for migrations/backups)
  ```sql
  -- Using service_role key
  SELECT * FROM work_sessions; -- Should return all rows
  ```

### Performance

- [ ] Policy queries are fast (use indexed columns)
- [ ] `organization_id` is indexed on all tables
- [ ] `user_id` is indexed where used in policies
- [ ] Test with millions of rows

---

## Debugging RLS Issues

### Check if RLS is enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('users', 'work_sessions', 'organizations');
-- rowsecurity = 't' means enabled
```

### List all policies on a table

```sql
SELECT * FROM pg_policies WHERE tablename = 'work_sessions';
```

### Test if policy blocks access

```sql
SET ROLE authenticated;
SET app.current_user_id = 'user-123';

SELECT * FROM work_sessions; -- Should apply policy
```

### Disable RLS temporarily (development only)

```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

---

## Migration Script

Run this to set up all RLS policies at once:

```bash
# Save all RLS policies to a file
psql -h your-host -U postgres -d your-database < rls-policies.sql

# Then run with service role to verify
SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/verify-rls.js
```

---

## Best Practices

### DO

- Enforce `tenant_id` on every INSERT
- Test RLS with actual user authentication
- Use indexed columns in policy WHERE clauses
- Log access attempts via audit_logs
- Review policies monthly for changes
- Test cross-tenant access attempts
- Keep service role keys secret

### DON'T

- Bypass RLS with `auth.role() = 'authenticated'` alone
- Use user-supplied `tenant_id` directly
- Store plaintext sensitive data
- Cache RLS evaluations
- Disable RLS in production
- Mix public and private tables without clear separation

---

## Frontend Integration

When using Supabase client in frontend:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Sign in first
await supabase.auth.signInWithPassword({ email, password });

// RLS automatically applied - user only sees their org's data
const { data: sessions } = await supabase.from('work_sessions').select('*');
// Automatically filtered by tenant_id
```

---

For questions or issues with RLS setup, consult the [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security).
