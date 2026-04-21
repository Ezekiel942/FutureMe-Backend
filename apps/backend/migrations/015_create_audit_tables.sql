-- Migration: Create audit tables for tracking user actions
-- Created: 2026-04-21

CREATE TABLE IF NOT EXISTS audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR(255),
  "organizationId" VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  "targetId" VARCHAR(255),
  "ipAddress" VARCHAR(255),
  "userAgent" VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  "resourceType" VARCHAR(255),
  "resourceId" VARCHAR(255),
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_entries_userId ON audit_entries("userId");
CREATE INDEX IF NOT EXISTS idx_audit_entries_organizationId ON audit_entries("organizationId");
CREATE INDEX IF NOT EXISTS idx_audit_entries_action ON audit_entries(action);
CREATE INDEX IF NOT EXISTS idx_audit_entries_created_at ON audit_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actorId ON audit_logs("actorId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resourceType ON audit_logs("resourceType");
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);