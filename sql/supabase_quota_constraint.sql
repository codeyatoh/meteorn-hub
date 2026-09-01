-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Enforce Strict Quota Limit on user_accounts
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. First, automatically fix any accounts that have already exceeded their quota
--    This ensures the CHECK constraint we add next won't fail during creation.
UPDATE public.user_accounts
   SET tickets_done = total_tickets
 WHERE tickets_done > total_tickets;

-- 2. Add a strict CHECK constraint to make it mathematically impossible
--    for the database to ever accept a value where tickets_done > total_tickets.
ALTER TABLE public.user_accounts
  ADD CONSTRAINT check_tickets_done_limit
  CHECK (tickets_done <= total_tickets);
