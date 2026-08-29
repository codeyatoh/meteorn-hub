-- 1. Create faucet_donations table
CREATE TABLE IF NOT EXISTS public.faucet_donations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    sender_address TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS for faucet_donations
ALTER TABLE public.faucet_donations ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own donations
CREATE POLICY "Users can view own faucet donations" 
ON public.faucet_donations FOR SELECT 
USING (auth.uid() = user_id);

-- Allow anyone to view global donations for transparency
CREATE POLICY "Anyone can view global faucet donations" 
ON public.faucet_donations FOR SELECT 
USING (true);

-- Allow service role to insert (from our backend API)
CREATE POLICY "Service role can insert faucet donations" 
ON public.faucet_donations FOR INSERT 
WITH CHECK (true);


-- 2. Create faucet_claims table
CREATE TABLE IF NOT EXISTS public.faucet_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    wallet_address TEXT UNIQUE NOT NULL, -- Ensures 1 claim per address globally
    amount NUMERIC NOT NULL DEFAULT 0.05,
    tx_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS for faucet_claims
ALTER TABLE public.faucet_claims ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own claims
CREATE POLICY "Users can view own faucet claims" 
ON public.faucet_claims FOR SELECT 
USING (auth.uid() = user_id);

-- Allow service role to insert (from our backend API)
CREATE POLICY "Service role can insert faucet claims" 
ON public.faucet_claims FOR INSERT 
WITH CHECK (true);

-- Allow anyone to view global claims for the history table (transparency)
CREATE POLICY "Anyone can view global faucet claims"
ON public.faucet_claims FOR SELECT
USING (true);


-- 3. Create a view for easy querying of user stats
CREATE OR REPLACE VIEW public.faucet_user_stats AS
SELECT 
  u.id as user_id,
  COALESCE((SELECT SUM(amount) FROM public.faucet_donations WHERE user_id = u.id), 0) as total_donated,
  COALESCE((SELECT SUM(amount) FROM public.faucet_claims WHERE user_id = u.id), 0) as total_claimed,
  (SELECT COUNT(*) FROM public.faucet_claims WHERE user_id = u.id AND created_at >= current_date) as claims_today
FROM auth.users u;

-- Grant access to the view
GRANT SELECT ON public.faucet_user_stats TO authenticated;
