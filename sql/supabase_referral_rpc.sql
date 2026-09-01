-- -----------------------------------------------------------------------------
-- RPC: increment_referral_tickets
-- Atomically increments tickets_done on user_accounts.
-- Returns 'incremented' if successful, 'quota_reached' if already at/over quota.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_referral_tickets(BIGINT);

CREATE OR REPLACE FUNCTION public.increment_referral_tickets(target_account_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_done     INTEGER;
  v_total    INTEGER;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT tickets_done, total_tickets
    INTO v_done, v_total
    FROM public.user_accounts
   WHERE id = target_account_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Already at or past quota
  IF v_done >= v_total THEN
    RETURN 'quota_reached';
  END IF;

  -- Safe to increment
  UPDATE public.user_accounts
     SET tickets_done = v_done + 1,
         total_accumulated_tickets = total_accumulated_tickets + 1
   WHERE id = target_account_id;

  RETURN 'incremented';
END;
$$;
