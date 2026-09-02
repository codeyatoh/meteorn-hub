-- ============================================================
-- RPC: search_chat_profiles
-- Securely searches auth.users for nicknames or emails
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_chat_profiles(search_query text DEFAULT '')
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
  WHERE 
    search_query = '' OR
    REPLACE(COALESCE(raw_user_meta_data->>'nickname', split_part(email, '@', 1)), ' ', '') ILIKE '%' || REPLACE(search_query, ' ', '') || '%'
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_chat_profiles(text) TO authenticated;
