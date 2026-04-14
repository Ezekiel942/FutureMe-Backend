-- Migration: Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID,
  owner_id UUID,
  status VARCHAR(50) DEFAULT 'planning' NOT NULL,
  start_date TIMESTAMP,
  target_end_date TIMESTAMP,
  actual_end_date TIMESTAMP,
  budget INTEGER DEFAULT 0,
  estimated_hours INTEGER DEFAULT 0,
  team_size INTEGER,
  team_members JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
