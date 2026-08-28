-- 1. Revert the permissive RLS policy that caused the data leak
DROP POLICY IF EXISTS "Authenticated users can view any user name for chat" ON public.user_accounts;

-- 2. Create a secure view for public profiles exposing only non-sensitive data.
-- SECURITY DEFINER allows the view to read auth.users on behalf of the user,
-- safely exposing only the id, nickname, and role.
CREATE OR REPLACE VIEW public.profiles 
WITH (security_invoker = false)
AS
SELECT
  id AS user_id,
  raw_user_meta_data->>'nickname' AS nickname,
  raw_user_meta_data->>'role' AS role
FROM auth.users;

-- Ensure only authenticated users can read this view
REVOKE ALL ON public.profiles FROM PUBLIC;
GRANT SELECT ON public.profiles TO authenticated;
