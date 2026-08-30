-- ============================================================
-- CHAT DISPLAY NAMES — Clean RPC Approach
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Drop old broken policies if they were partially created
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
DROP FUNCTION IF EXISTS public.sync_user_profile();

-- Create a SECURITY DEFINER function that reads auth.users on behalf of the caller.
-- This bypasses RLS on auth.users and returns ONLY safe display fields (nickname, role).
-- Authenticated users can call this function to look up any user's display name.
CREATE OR REPLACE FUNCTION public.get_chat_profiles(user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    id AS user_id,
    COALESCE(
      raw_user_meta_data->>'nickname',
      split_part(email, '@', 1)
    ) AS full_name,
    COALESCE(raw_user_meta_data->>'role', 'user') AS role
  FROM auth.users
  WHERE id = ANY(user_ids);
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_chat_profiles(uuid[]) TO authenticated;
