-- =============================================
-- AI Prompts Table
-- Stores generated AI prompts that can be reused 
-- for agent creation (autofill) and other purposes
-- =============================================

-- Drop existing table if needed (uncomment for fresh install)
-- DROP TABLE IF EXISTS ai_prompts CASCADE;

CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core prompt metadata
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  system_prompt TEXT NOT NULL,
  begin_message TEXT,
  
  -- Agent configuration snapshot (used to autofill agent creation)
  agent_profile JSONB DEFAULT '{}'::jsonb,
  
  -- Prompt settings
  state_prompts JSONB DEFAULT '{}'::jsonb,
  tools_config JSONB DEFAULT '{}'::jsonb,
  
  -- Classification / filtering
  call_type TEXT,            -- Sales, Support, Booking, Billing, Complaint, Mixed
  call_goal TEXT,            -- Book Appointment, Close Sale, Qualify Lead, etc.
  tone TEXT,                 -- Friendly, Professional, Empathetic, Energetic, Strict
  status TEXT DEFAULT 'draft', -- draft, ready, archived
  
  -- Flags
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  
  -- Welcome messages (array stored as JSON for agent creation autofill)
  welcome_messages JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompts_user_id ON ai_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_active ON ai_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_status ON ai_prompts(status);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_deleted_at ON ai_prompts(deleted_at);

-- Enable RLS
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only manage their own prompts
CREATE POLICY "Users can view own prompts"
  ON ai_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON ai_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts"
  ON ai_prompts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts"
  ON ai_prompts FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_prompts_updated_at ON ai_prompts;
CREATE TRIGGER trigger_update_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_prompts_updated_at();
