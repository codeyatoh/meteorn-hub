-- ============================================================
-- Supabase Faucet Stats Fix
-- Run this script to resolve the "Could not fetch Faucet pool balance" error
-- ============================================================

-- Drop the old view that relied on auth.users and security_invoker
DROP VIEW IF EXISTS public.faucet_user_stats;

-- Create the new fully public view that exclusively relies on public tables
CREATE OR REPLACE VIEW public.faucet_user_stats AS
SELECT 
  COALESCE(d.user_id, c.user_id) as user_id,
  COALESCE(d.total_donated, 0) as total_donated,
  COALESCE(c.total_claimed, 0) as total_claimed,
  COALESCE(c.claims_today, 0) as claims_today
FROM (
  SELECT user_id, SUM(amount) as total_donated 
  FROM public.faucet_donations 
  GROUP BY user_id
) d
FULL OUTER JOIN (
  SELECT user_id, 
         SUM(amount) as total_claimed, 
         COUNT(*) FILTER (WHERE created_at >= current_date) as claims_today 
  FROM public.faucet_claims 
  GROUP BY user_id
) c ON d.user_id = c.user_id;

-- Grant access to the view
GRANT SELECT ON public.faucet_user_stats TO authenticated;
GRANT SELECT ON public.faucet_user_stats TO anon;
