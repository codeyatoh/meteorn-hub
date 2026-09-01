-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add bump cooldown tracking to user_accounts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS last_bumped_at TIMESTAMPTZ DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: bump_referral_account
-- Called by the account owner to re-surface their Help Needed card.
-- Returns one of: 'bumped' | 'cooldown' | 'not_owner' | 'quota_reached' | 'not_found'
-- p_cooldown_minutes: how many minutes must pass between bumps (default 60)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bump_referral_account(
  p_account_id       BIGINT,
  p_cooldown_minutes INTEGER DEFAULT 60
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account public.user_accounts%ROWTYPE;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT * INTO v_account
    FROM public.user_accounts
   WHERE id = p_account_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Only the account owner can bump
  IF v_account.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN 'not_owner';
  END IF;

  -- Dont allow bumping a completed account
  IF v_account.tickets_done >= v_account.total_tickets THEN
    RETURN 'quota_reached';
  END IF;

  -- Enforce cooldown window
  IF v_account.last_bumped_at IS NOT NULL
     AND v_account.last_bumped_at > (now() - (p_cooldown_minutes || ' minutes')::INTERVAL) THEN
    RETURN 'cooldown';
  END IF;

  -- Update last_bumped_at timestamp
  UPDATE public.user_accounts
     SET last_bumped_at = now()
   WHERE id = p_account_id;

  RETURN 'bumped';
END;
$$;
