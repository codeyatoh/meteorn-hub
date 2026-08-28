-- ============================================================
-- COMPLETE PROFILES FIX
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Allow authenticated users to read any profile (for chat display names)
--    Without this, the chat cannot see other users' nicknames.
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2. Allow users to INSERT their own profile row (needed on first login)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Backfill: Sync existing auth.users nickname → profiles.full_name
--    (Copies data for any user who already completed onboarding)
INSERT INTO public.profiles (id, full_name, role)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'nickname',
    split_part(email, '@', 1)
  ) AS full_name,
  COALESCE(raw_user_meta_data->>'role', 'user') AS role
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role;

-- 4. Create trigger function: auto-sync nickname to profiles on auth.users update
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nickname',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(
          NEW.raw_user_meta_data->>'nickname',
          split_part(NEW.email, '@', 1)
        ),
        role = COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. Wire the trigger on auth.users (fires on INSERT and UPDATE)
DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
CREATE TRIGGER on_auth_user_created_or_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();
