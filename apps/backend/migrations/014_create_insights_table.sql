-- Migration: Create insights table and enable RLS for tenant-safe analytics
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID,
  "organizationId" UUID,
  type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(50),
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE IF EXISTS insights
  ADD CONSTRAINT IF NOT EXISTS fk_insights_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS insights
  ADD CONSTRAINT IF NOT EXISTS fk_insights_session_id
  FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insights_organizationId ON insights("organizationId");
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select insights in their org" ON insights FOR SELECT
  USING (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can insert insights for their org" ON insights FOR INSERT
  WITH CHECK (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update insights in their org" ON insights FOR UPDATE
  USING (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can delete insights in their org" ON insights FOR DELETE
  USING (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can access all insights" ON insights FOR ALL
  USING (auth.role() = 'service_role');
