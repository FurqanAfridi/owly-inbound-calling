-- ============================================================
-- 011_create_agent_schedules_junction.sql
-- Creates junction table for many-to-many relationship between agents and schedules
-- ============================================================

-- Create junction table for agent-schedule many-to-many relationship
CREATE TABLE IF NOT EXISTS public.agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.voice_agents(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.call_schedules(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, schedule_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_agent_schedules_agent_id ON public.agent_schedules(agent_id);
CREATE INDEX idx_agent_schedules_schedule_id ON public.agent_schedules(schedule_id);

-- Enable RLS
ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "agent_schedules_select_own" ON public.agent_schedules
  FOR SELECT USING (
    agent_id IN (SELECT id FROM public.voice_agents WHERE user_id = auth.uid())
  );

CREATE POLICY "agent_schedules_insert_own" ON public.agent_schedules
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM public.voice_agents WHERE user_id = auth.uid()) AND
    schedule_id IN (SELECT id FROM public.call_schedules WHERE user_id = auth.uid())
  );

CREATE POLICY "agent_schedules_delete_own" ON public.agent_schedules
  FOR DELETE USING (
    agent_id IN (SELECT id FROM public.voice_agents WHERE user_id = auth.uid())
  );

-- Note: The agent_id column in call_schedules table can remain for backward compatibility
-- but new assignments should use the junction table
