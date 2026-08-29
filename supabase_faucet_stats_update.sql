-- Update faucet_user_stats view to include nickname and email
CREATE OR REPLACE VIEW public.faucet_user_stats AS
SELECT 
  u.id as user_id,
  u.email as email,
  u.raw_user_meta_data->>'nickname' as nickname,
  COALESCE((SELECT SUM(amount) FROM public.faucet_donations WHERE user_id = u.id), 0) as total_donated,
  COALESCE((SELECT SUM(amount) FROM public.faucet_claims WHERE user_id = u.id), 0) as total_claimed,
  (SELECT COUNT(*) FROM public.faucet_claims WHERE user_id = u.id AND created_at >= current_date) as claims_today
FROM auth.users u;

-- Grant access to the view
GRANT SELECT ON public.faucet_user_stats TO authenticated;
GRANT SELECT ON public.faucet_user_stats TO service_role;
