-- Migration: Create subscriptions table for billing
-- Created: 2026-04-21

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  plan VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "endedAt" VARCHAR(255),
  metadata JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_organizationId ON subscriptions("organizationId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);