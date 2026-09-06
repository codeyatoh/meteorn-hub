-- ============================================================
-- FIX: Update increment and decrement RPCs to track total_accumulated_tickets
-- Run this in your Supabase SQL editor (project: cperuqnulqvqaeysmrth)
-- ============================================================

-- 1. Fix increment RPC
CREATE OR REPLACE FUNCTION public.increment_account_ticket(p_account_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_caller_id UUID := auth.uid();
  v_is_helper BOOLEAN := false;
  v_account_name TEXT;
BEGIN
  -- Get account owner and name
  SELECT user_id, name INTO v_owner_id, v_account_name 
  FROM public.user_accounts WHERE id = p_account_id;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Check if caller is owner
  IF v_caller_id = v_owner_id THEN
    v_is_helper := true;
  ELSE
    -- Check if caller is an accepted helper
    SELECT EXISTS (
      SELECT 1 FROM public.help_requests
      WHERE account_id = p_account_id
      AND helper_id = v_caller_id
      AND status = 'accepted'
    ) INTO v_is_helper;
  END IF;

  IF NOT v_is_helper THEN
    RAISE EXCEPTION 'Unauthorized to increment tickets for this account';
  END IF;

  -- Increment both daily ticket and all-time accumulated tickets
  UPDATE public.user_accounts
  SET tickets_done = tickets_done + 1,
      total_accumulated_tickets = total_accumulated_tickets + 1
  WHERE id = p_account_id;
  
  -- Log the ticket (using caller's ID but marking it for the account)
  INSERT INTO public.ticket_logs (user_id, account_id, account_name, increment)
  VALUES (v_caller_id, p_account_id, v_account_name, 1);
END;
$$;


-- 2. Fix decrement RPC (Manual Revert)
CREATE OR REPLACE FUNCTION public.decrement_account_ticket(p_account_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_caller_id UUID := auth.uid();
  v_is_helper BOOLEAN := false;
  v_account_name TEXT;
BEGIN
  -- Get account owner and name
  SELECT user_id, name INTO v_owner_id, v_account_name 
  FROM public.user_accounts WHERE id = p_account_id;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Check if caller is owner
  IF v_caller_id = v_owner_id THEN
    v_is_helper := true;
  ELSE
    -- Check if caller is an accepted helper
    SELECT EXISTS (
      SELECT 1 FROM public.help_requests
      WHERE account_id = p_account_id
      AND helper_id = v_caller_id
      AND status = 'accepted'
    ) INTO v_is_helper;
  END IF;

  IF NOT v_is_helper THEN
    RAISE EXCEPTION 'Unauthorized to decrement tickets for this account';
  END IF;

  -- Decrement daily ticket and all-time accumulated tickets safely
  UPDATE public.user_accounts
  SET tickets_done = GREATEST(0, tickets_done - 1),
      total_accumulated_tickets = GREATEST(0, total_accumulated_tickets - 1)
  WHERE id = p_account_id AND tickets_done > 0;
  
  -- Log the revert
  INSERT INTO public.ticket_logs (user_id, account_id, account_name, increment)
  VALUES (v_caller_id, p_account_id, v_account_name, -1);
END;
$$;


-- 3. Backfill existing data
-- To fix accounts that were already grinded but didn't get their total_accumulated_tickets updated:
UPDATE public.user_accounts 
SET total_accumulated_tickets = GREATEST(total_accumulated_tickets, tickets_done)
WHERE total_accumulated_tickets < tickets_done;
