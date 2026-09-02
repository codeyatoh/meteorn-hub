-- ============================================================
-- Supabase Faucet Compensation Reset
-- Pushes all of today's faucet claims to yesterday
-- effectively resetting everyone's daily limit to 0 for today
-- ============================================================

UPDATE public.faucet_claims
SET created_at = created_at - INTERVAL '1 day'
WHERE (created_at AT TIME ZONE 'Asia/Manila')::date >= (now() AT TIME ZONE 'Asia/Manila')::date;
