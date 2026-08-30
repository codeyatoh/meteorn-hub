-- ============================================================
-- WALLET ADDRESS VALIDATION RPCs
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Function to check if a single wallet address is used by any user (case-insensitive) other than the provided exclude_user_id
CREATE OR REPLACE FUNCTION public.check_wallet_in_use(check_wallet text, exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE 
      LOWER(raw_user_meta_data->>'wallet_address') = LOWER(check_wallet)
      AND (exclude_user_id IS NULL OR id != exclude_user_id)
  );
$$;

-- Function to check if ANY wallet address in an array is used by any user (case-insensitive) other than the provided exclude_user_id
CREATE OR REPLACE FUNCTION public.check_wallets_in_use(check_wallets text[], exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  wallet text;
BEGIN
  -- Convert array to lowercase for comparison
  FOREACH wallet IN ARRAY check_wallets
  LOOP
    IF EXISTS (
      SELECT 1
      FROM auth.users
      WHERE 
        LOWER(raw_user_meta_data->>'wallet_address') = LOWER(wallet)
        AND (exclude_user_id IS NULL OR id != exclude_user_id)
    ) THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- Grant execute permission to authenticated and anon users (for APIs using service_role or anon)
GRANT EXECUTE ON FUNCTION public.check_wallet_in_use(text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_wallets_in_use(text[], uuid) TO anon, authenticated, service_role;
