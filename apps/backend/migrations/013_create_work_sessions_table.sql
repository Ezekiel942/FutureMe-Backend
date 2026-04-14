-- Migration: Create work_sessions table and enable RLS for tenant isolation
CREATE TABLE IF NOT EXISTS work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  task_id UUID,
  "organizationId" UUID,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE IF EXISTS work_sessions
  ADD CONSTRAINT IF NOT EXISTS fk_work_sessions_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS work_sessions
  ADD CONSTRAINT IF NOT EXISTS fk_work_sessions_project_id
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS work_sessions
  ADD CONSTRAINT IF NOT EXISTS fk_work_sessions_task_id
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_sessions_organizationId ON work_sessions("organizationId");
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_project_id ON work_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task_id ON work_sessions(task_id);

ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select sessions in their org" ON work_sessions FOR SELECT
  USING (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can insert sessions for their org" ON work_sessions FOR INSERT
  WITH CHECK (
    ("organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can update their own sessions" ON work_sessions FOR UPDATE
  USING (
    (user_id = auth.uid() AND "organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (user_id = auth.uid() AND "organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Users can delete their own sessions" ON work_sessions FOR DELETE
  USING (
    (user_id = auth.uid() AND "organizationId" = (SELECT "organizationId" FROM public.users WHERE id = auth.uid()))
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can access all sessions" ON work_sessions FOR ALL
  USING (auth.role() = 'service_role');
