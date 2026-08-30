-- ============================================================
-- Temp Email Domains - Add Ban Status
-- ============================================================

-- Add is_banned column to temp_mail_allowed_domains
ALTER TABLE public.temp_mail_allowed_domains 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false NOT NULL;
