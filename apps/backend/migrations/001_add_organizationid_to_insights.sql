-- Migration: add organizationId to insights and backfill from users table
BEGIN;

ALTER TABLE IF EXISTS insights
  ADD COLUMN IF NOT EXISTS "organizationId" UUID;

-- Backfill organizationId based on the user who created the insight
UPDATE insights
SET "organizationId" = u."organizationId"
FROM users u
WHERE insights."userId" = u.id
  AND (insights."organizationId" IS NULL OR insights."organizationId" = '');

-- Add index for faster tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_insights_organizationId ON insights("organizationId");

COMMIT;
