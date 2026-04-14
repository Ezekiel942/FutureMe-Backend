-- Migration: Create organizations table and enable tenant-safe RLS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their organization" ON organizations FOR SELECT
  USING (
    id = (SELECT "organizationId" FROM public.users WHERE id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can access all organizations" ON organizations FOR ALL
  USING (auth.role() = 'service_role');
