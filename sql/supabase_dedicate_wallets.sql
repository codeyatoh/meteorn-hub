-- ============================================================
-- WALLET DEDICATION - CLEAR DUPLICATES
-- Run this script in Supabase SQL Editor
-- This will ensure that a wallet address belongs to only ONE user.
-- It keeps the wallet for the oldest account (first registered) 
-- and removes it from any newer accounts that share it.
-- ============================================================

WITH duplicate_wallets AS (
    SELECT 
        id,
        LOWER(raw_user_meta_data->>'wallet_address') as wallet,
        created_at,
        ROW_NUMBER() OVER(PARTITION BY LOWER(raw_user_meta_data->>'wallet_address') ORDER BY created_at ASC) as rn
    FROM auth.users
    WHERE raw_user_meta_data->>'wallet_address' IS NOT NULL 
      AND raw_user_meta_data->>'wallet_address' != ''
)
UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'wallet_address'
FROM duplicate_wallets d
WHERE u.id = d.id 
  AND d.rn > 1;

-- If you prefer keeping the wallet key but setting it to empty string instead of removing the key:
-- UPDATE auth.users u
-- SET raw_user_meta_data = jsonb_set(u.raw_user_meta_data, '{wallet_address}', '""'::jsonb)
-- FROM duplicate_wallets d
-- WHERE u.id = d.id 
--   AND d.rn > 1;
