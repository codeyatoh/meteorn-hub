-- ============================================================
-- FIX 1: Update daily cron job to also clear help_requests
-- Run this in your Supabase SQL editor (project: cperuqnulqvqaeysmrth)
-- ============================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if it exists
SELECT cron.unschedule('reset-tickets-daily');

-- Recreate with the new logic that also clears help_requests
SELECT cron.schedule(
  'reset-tickets-daily',
  '0 16 * * *',  -- 12:00 AM PHT (16:00 UTC)
  $$
    -- 1. Reset daily ticket counts for all accounts
    UPDATE public.user_accounts SET tickets_done = 0;
    -- 2. Delete all accepted/pending help requests so owners must re-request daily
    DELETE FROM public.help_requests WHERE status IN ('accepted', 'pending');
  $$
);

-- Verify the job was created:
-- SELECT jobname, schedule, command FROM cron.job;


-- ============================================================
-- FIX 2: Add missing repair_tickets_used column (if missing)
-- This fixes the repair button not working
-- ============================================================

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS repair_tickets_used INTEGER DEFAULT 0 NOT NULL;

-- ============================================================
-- FIX 3: Also reset repair_tickets_used in the cron job
-- (Optional but recommended: reset repair usage daily so users get fresh repairs)
-- If you want to reset repair_tickets_used every day, uncomment the line below
-- and re-run the cron.schedule() above with it added to the $$ block:
-- UPDATE public.user_accounts SET tickets_done = 0, repair_tickets_used = 0;
-- ============================================================
