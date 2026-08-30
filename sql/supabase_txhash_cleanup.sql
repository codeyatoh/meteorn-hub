-- ============================================================
-- FAUCET DONATIONS TX HASH CLEANUP
-- Run this script to ensure all existing tx_hashes are lowercase
-- ============================================================

-- Force all existing tx_hash values to lowercase.
-- This ensures the UNIQUE constraint on tx_hash is enforced strictly moving forward.
-- Note: If this fails because of a duplicate key violation, it means you ALREADY have 
-- duplicate donations (e.g. 0xABC and 0xabc exist). You will need to manually delete 
-- the duplicate row before running this script again.

UPDATE public.faucet_donations
SET tx_hash = LOWER(tx_hash)
WHERE tx_hash != LOWER(tx_hash);

-- Force all sender_address values to lowercase just in case
UPDATE public.faucet_donations
SET sender_address = LOWER(sender_address)
WHERE sender_address != LOWER(sender_address);
