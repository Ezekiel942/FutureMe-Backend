-- Migration: create announcements and announcement_responses tables
BEGIN;

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "expiresAt" VARCHAR(255) NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create announcement_responses table  
CREATE TABLE IF NOT EXISTS announcement_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "announcementId" UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "isRead" BOOLEAN DEFAULT false,
  "isAcknowledged" BOOLEAN DEFAULT false,
  response TEXT NULL,
  "hasResponded" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "read_at" VARCHAR(255) NULL,
  "acknowledged_at" VARCHAR(255) NULL,
  "responded_at" VARCHAR(255) NULL
);

-- Create indexes for tenant isolation and query performance
CREATE INDEX IF NOT EXISTS idx_announcements_organizationId ON announcements("organizationId");
CREATE INDEX IF NOT EXISTS idx_announcements_createdBy ON announcements("createdBy");
CREATE INDEX IF NOT EXISTS idx_announcements_isActive ON announcements("isActive");

CREATE INDEX IF NOT EXISTS idx_announcement_responses_announcementId ON announcement_responses("announcementId");
CREATE INDEX IF NOT EXISTS idx_announcement_responses_userId ON announcement_responses("userId");
CREATE INDEX IF NOT EXISTS idx_announcement_responses_organizationId ON announcement_responses("organizationId");
CREATE INDEX IF NOT EXISTS idx_announcement_responses_user_announcement ON announcement_responses("userId", "announcementId");

COMMIT;
