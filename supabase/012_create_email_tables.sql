-- Create user_emails table for storing user email addresses with SMTP configuration
CREATE TABLE IF NOT EXISTS public.user_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  smtp_password text, -- Encrypted SMTP password/app password
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT user_emails_email_user_unique UNIQUE (email, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON public.user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_email ON public.user_emails(email);
CREATE INDEX IF NOT EXISTS idx_user_emails_user_primary ON public.user_emails(user_id, is_primary) WHERE is_primary = true;

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_emails
-- Users can only see/manage their own emails
DROP POLICY IF EXISTS "user_emails_select_own" ON public.user_emails;
CREATE POLICY "user_emails_select_own" ON public.user_emails
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_emails_insert_own" ON public.user_emails;
CREATE POLICY "user_emails_insert_own" ON public.user_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_emails_update_own" ON public.user_emails;
CREATE POLICY "user_emails_update_own" ON public.user_emails
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_emails_delete_own" ON public.user_emails;
CREATE POLICY "user_emails_delete_own" ON public.user_emails
  FOR DELETE USING (auth.uid() = user_id);

-- Create email_templates table for storing reusable email templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  accent_color text NOT NULL DEFAULT '#4F46E5',
  design_style text NOT NULL DEFAULT 'modern', -- modern, classic, minimal, newsletter, corporate
  company_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON public.email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_user_default ON public.email_templates(user_id, is_default) WHERE is_default = true AND deleted_at IS NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
-- Users can only see/manage their own templates
DROP POLICY IF EXISTS "email_templates_select_own" ON public.email_templates;
CREATE POLICY "email_templates_select_own" ON public.email_templates
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "email_templates_insert_own" ON public.email_templates;
CREATE POLICY "email_templates_insert_own" ON public.email_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "email_templates_update_own" ON public.email_templates;
CREATE POLICY "email_templates_update_own" ON public.email_templates
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "email_templates_delete_own" ON public.email_templates;
CREATE POLICY "email_templates_delete_own" ON public.email_templates
  FOR UPDATE USING (auth.uid() = user_id); -- Soft delete via deleted_at (UPDATE sets deleted_at)

-- Create email_logs table for storing email sending history
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  to_email text NOT NULL,
  to_phone_number text, -- Optional phone number associated with recipient
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at timestamptz, -- When email was actually sent
  error_message text, -- Error message if status is 'failed'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_status ON public.email_logs(user_id, status) WHERE deleted_at IS NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
-- Users can only see their own email logs
DROP POLICY IF EXISTS "email_logs_select_own" ON public.email_logs;
CREATE POLICY "email_logs_select_own" ON public.email_logs
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "email_logs_insert_own" ON public.email_logs;
CREATE POLICY "email_logs_insert_own" ON public.email_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "email_logs_update_own" ON public.email_logs;
CREATE POLICY "email_logs_update_own" ON public.email_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_emails_updated_at ON public.user_emails;
CREATE TRIGGER update_user_emails_updated_at
  BEFORE UPDATE ON public.user_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_logs_updated_at ON public.email_logs;
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
