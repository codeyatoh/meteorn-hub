-- ============================================================
-- Temp Email Access & Limits
-- ============================================================

CREATE TABLE IF NOT EXISTS public.temp_mail_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'none', -- 'none', 'pending', 'approved', 'rejected'
  daily_count INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.temp_mail_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access
CREATE POLICY "Users can view their own access"
  ON public.temp_mail_access FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own request
CREATE POLICY "Users can insert their own request"
  ON public.temp_mail_access FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access on access table"
  ON public.temp_mail_access FOR ALL
  USING (auth.role() = 'service_role');
