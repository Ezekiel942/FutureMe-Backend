-- Migration: create skill_graph table for user skill tracking

CREATE TABLE IF NOT EXISTS skill_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" VARCHAR NOT NULL,
  "organizationId" VARCHAR NOT NULL,
  skill VARCHAR NOT NULL,
  proficiency INTEGER NOT NULL CHECK (proficiency >= 1 AND proficiency <= 5),
  "projectCount" INTEGER NOT NULL DEFAULT 0,
  "lastUpdated" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_graph_user_id ON skill_graph("userId");
CREATE INDEX IF NOT EXISTS idx_skill_graph_organization_id ON skill_graph("organizationId");
CREATE INDEX IF NOT EXISTS idx_skill_graph_skill ON skill_graph("skill");
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_graph_user_skill ON skill_graph("userId", skill);