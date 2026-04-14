-- Migration: ensure organizationId is present on work_sessions and audit_entries
BEGIN;

-- Add organizationId to work_sessions if not present
ALTER TABLE IF EXISTS work_sessions
  ADD COLUMN IF NOT EXISTS "organizationId" UUID;

-- Backfill organizationId for work_sessions based on user's organization
UPDATE work_sessions
SET "organizationId" = u."organizationId"
FROM users u
WHERE work_sessions."userId" = u.id
  AND (work_sessions."organizationId" IS NULL OR work_sessions."organizationId" = '');

-- Add index for faster tenant-scoped queries on sessions
CREATE INDEX IF NOT EXISTS idx_work_sessions_organizationId ON work_sessions("organizationId");
CREATE INDEX IF NOT EXISTS idx_work_sessions_userId_organizationId ON work_sessions("userId", "organizationId");

-- Add organizationId to audit_entries if not present
ALTER TABLE IF EXISTS audit_entries
  ADD COLUMN IF NOT EXISTS "organizationId" UUID;

-- Backfill organizationId for audit_entries based on user's organization
UPDATE audit_entries
SET "organizationId" = u."organizationId"
FROM users u
WHERE audit_entries."userId" = u.id
  AND (audit_entries."organizationId" IS NULL OR audit_entries."organizationId" = '');

-- Add index for faster tenant-scoped audit queries
CREATE INDEX IF NOT EXISTS idx_audit_entries_organizationId ON audit_entries("organizationId");

COMMIT;
