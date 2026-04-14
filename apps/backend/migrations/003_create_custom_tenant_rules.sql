-- Migration: create custom_tenant_rules table for tenant session settings

CREATE TABLE IF NOT EXISTS custom_tenant_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" VARCHAR NOT NULL UNIQUE,
  "minSessionLength" INT NOT NULL DEFAULT 300,
  "maxDailyHours" INT NOT NULL DEFAULT 8,
  "idleTimeout" INT NOT NULL DEFAULT 30,
  "overtimeThreshold" INT NOT NULL DEFAULT 8,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_tenant_rules_organizationId ON custom_tenant_rules("organizationId");
