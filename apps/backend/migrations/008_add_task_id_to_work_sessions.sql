-- Migration: Add task_id to work_sessions table
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS task_id UUID;
CREATE INDEX IF NOT EXISTS idx_work_sessions_task_id ON work_sessions(task_id);
