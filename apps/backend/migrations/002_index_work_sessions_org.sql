-- Migration: ensure index on work_sessions.organizationId for tenant-scoped queries
BEGIN;

CREATE INDEX IF NOT EXISTS idx_work_sessions_organizationId ON work_sessions("organizationId");

COMMIT;
