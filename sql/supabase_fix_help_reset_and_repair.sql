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


-- ============================================================
-- FIX 2: Add missing repair_tickets_used column (if missing)
-- This fixes the repair button not working
-- ============================================================

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS repair_tickets_used INTEGER DEFAULT 0 NOT NULL;


-- ============================================================
-- STORAGE OPTIMIZATION: Auto-cleanup cron jobs
-- Prevents the database from filling up over time
-- Current risk tables: yatmail_messages, ticket_logs, global_chats
-- ============================================================

-- JOB 1: Delete emails older than 3 days (biggest storage risk)
SELECT cron.unschedule('cleanup-old-emails');
SELECT cron.schedule(
  'cleanup-old-emails',
  '30 16 * * *',  -- 12:30 AM PHT daily
  $$
    DELETE FROM public.yatmail_messages
    WHERE received_at < now() - INTERVAL '3 days';
  $$
);

-- JOB 2: Delete already-expired temp mail sessions
SELECT cron.unschedule('cleanup-expired-sessions');
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '35 16 * * *',  -- 12:35 AM PHT daily
  $$
    DELETE FROM public.temp_mail_sessions
    WHERE expires_at < now() - INTERVAL '1 hour';
  $$
);

-- JOB 3: Keep ticket_logs for only last 30 days
-- (grows 1 row per credited ticket per user)
SELECT cron.unschedule('cleanup-old-ticket-logs');
SELECT cron.schedule(
  'cleanup-old-ticket-logs',
  '40 16 * * *',  -- 12:40 AM PHT daily
  $$
    DELETE FROM public.ticket_logs
    WHERE created_at < now() - INTERVAL '30 days';
  $$
);

-- JOB 4: Clean up completed/rejected help_requests older than 7 days
SELECT cron.unschedule('cleanup-old-help-requests');
SELECT cron.schedule(
  'cleanup-old-help-requests',
  '45 16 * * *',  -- 12:45 AM PHT daily
  $$
    DELETE FROM public.help_requests
    WHERE status IN ('completed', 'rejected')
      AND updated_at < now() - INTERVAL '7 days';
  $$
);

-- JOB 5: Clean up global chat messages older than 30 days
SELECT cron.unschedule('cleanup-old-chats');
SELECT cron.schedule(
  'cleanup-old-chats',
  '50 16 * * *',  -- 12:50 AM PHT daily
  $$
    DELETE FROM public.global_chats
    WHERE created_at < now() - INTERVAL '30 days';
    -- chat_reactions auto-deletes via ON DELETE CASCADE
  $$
);

-- JOB 6: Weekly VACUUM to reclaim freed disk space
-- (Postgres keeps dead rows until VACUUM runs)
SELECT cron.unschedule('vacuum-tables');
SELECT cron.schedule(
  'vacuum-tables',
  '0 17 * * 0',  -- Every Sunday at 1:00 AM PHT
  $$
    VACUUM (ANALYZE) public.yatmail_messages;
    VACUUM (ANALYZE) public.temp_mail_sessions;
    VACUUM (ANALYZE) public.ticket_logs;
    VACUUM (ANALYZE) public.help_requests;
    VACUUM (ANALYZE) public.global_chats;
  $$
);

-- Verify all scheduled jobs:
-- SELECT jobname, schedule FROM cron.job ORDER BY jobname;
