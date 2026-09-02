-- ============================================================
-- Temp Email Domain Scheduling Feature
-- Adds the available_at column to temp_mail_allowed_domains
-- ============================================================

-- 1. Add the available_at column
ALTER TABLE public.temp_mail_allowed_domains
ADD COLUMN IF NOT EXISTS available_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Update the public access policy
-- Drop the old policy
DROP POLICY IF EXISTS "Anyone authenticated can view active domains" ON public.temp_mail_allowed_domains;

-- Create the new policy that allows authenticated users to see active domains, 
-- INCLUDING those scheduled for the future (so they can see the countdown timer).
CREATE POLICY "Anyone authenticated can view active domains"
  ON public.temp_mail_allowed_domains FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Note: In the user frontend, we will disable domains where available_at > now().
