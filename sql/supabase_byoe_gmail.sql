-- ============================================================
-- Bring Your Own Email (BYOE) Temp Mail Feature
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_gmail_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gmail_address TEXT NOT NULL,
  app_password_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, gmail_address)
);

-- Enable RLS
ALTER TABLE public.user_gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections"
  ON public.user_gmail_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
  ON public.user_gmail_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON public.user_gmail_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON public.user_gmail_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.user_gmail_connections FOR ALL
  USING (auth.role() = 'service_role');

-- Add reference to temp_mail_sessions
ALTER TABLE public.temp_mail_sessions
ADD COLUMN IF NOT EXISTS byoe_connection_id UUID REFERENCES public.user_gmail_connections(id) ON DELETE CASCADE;
