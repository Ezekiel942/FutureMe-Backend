-- Migration: Create public users table for application tenant membership and auth linking
-- This table is intentionally public and references Supabase auth.users.
-- It is created with UUID primary key and tenant-aware columns.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  "organizationId" UUID,
  "avatarUrl" TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  metadata JSONB
);

ALTER TABLE IF EXISTS public.users
  ADD CONSTRAINT IF NOT EXISTS fk_users_auth_user_id
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_organizationId ON public.users("organizationId");
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own record" ON public.users FOR SELECT
  USING (id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own record" ON public.users FOR INSERT
  WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own record" ON public.users FOR UPDATE
  USING (id = auth.uid() OR auth.role() = 'service_role')
  WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their own record" ON public.users FOR DELETE
  USING (id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "Service role can access all users" ON public.users FOR ALL
  USING (auth.role() = 'service_role');
