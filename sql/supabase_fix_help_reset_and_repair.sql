-- ============================================================
-- FIX 1: Update daily cron job to also clear help_requests
-- Run this in your Supabase SQL editor (project: cperuqnulqvqaeysmrth)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Safe unschedule helper (won't error if job doesn't exist)
DO $$ BEGIN PERFORM cron.unschedule('reset-tickets-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'reset-tickets-daily',
  '0 16 * * *',
  $$
    UPDATE public.user_accounts SET tickets_done = 0;
    DELETE FROM public.help_requests WHERE status IN ('accepted', 'pending');
  $$
);


-- ============================================================
-- FIX 2: Add missing repair_tickets_used column (if missing)
-- ============================================================

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS repair_tickets_used INTEGER DEFAULT 0 NOT NULL;


-- ============================================================
-- STORAGE OPTIMIZATION: Auto-cleanup cron jobs
-- ============================================================

-- JOB 1: Delete emails older than 3 days (biggest storage risk)
DO $$ BEGIN PERFORM cron.unschedule('cleanup-old-emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cleanup-old-emails',
  '30 16 * * *',
  $$
    DELETE FROM public.yatmail_messages
    WHERE received_at < now() - INTERVAL '3 days';
  $$
);

-- JOB 2: Delete expired temp mail sessions
DO $$ BEGIN PERFORM cron.unschedule('cleanup-expired-sessions'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '35 16 * * *',
  $$
    DELETE FROM public.temp_mail_sessions
    WHERE expires_at < now() - INTERVAL '1 hour';
  $$
);

-- JOB 3: Keep ticket_logs for only last 30 days
DO $$ BEGIN PERFORM cron.unschedule('cleanup-old-ticket-logs'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cleanup-old-ticket-logs',
  '40 16 * * *',
  $$
    DELETE FROM public.ticket_logs
    WHERE created_at < now() - INTERVAL '30 days';
  $$
);

-- JOB 4: Clean up old completed/rejected help_requests
DO $$ BEGIN PERFORM cron.unschedule('cleanup-old-help-requests'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cleanup-old-help-requests',
  '45 16 * * *',
  $$
    DELETE FROM public.help_requests
    WHERE status IN ('completed', 'rejected')
      AND updated_at < now() - INTERVAL '7 days';
  $$
);

-- JOB 5: Clean up global chat messages older than 30 days
DO $$ BEGIN PERFORM cron.unschedule('cleanup-old-chats'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'cleanup-old-chats',
  '50 16 * * *',
  $$
    DELETE FROM public.global_chats
    WHERE created_at < now() - INTERVAL '30 days';
  $$
);

-- JOB 6: Weekly VACUUM to reclaim freed disk space
DO $$ BEGIN PERFORM cron.unschedule('vacuum-tables'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'vacuum-tables',
  '0 17 * * 0',  -- Every Sunday 1:00 AM PHT
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
