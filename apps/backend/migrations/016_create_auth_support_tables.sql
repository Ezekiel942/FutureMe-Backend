-- Migration: Create tables for password reset and token refresh
-- Created: 2026-04-21

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  token VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  token VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_password_resets_userId ON password_resets("userId");
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_expiresAt ON password_resets("expiresAt");

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens("userId");
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_unique ON refresh_tokens(token);