-- Migration: Add status column to faucet_claims
-- Run this in your Supabase SQL Editor

ALTER TABLE public.faucet_claims 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success' 
  CHECK (status IN ('processing', 'success', 'failed'));

-- Optional: Add an error_message column to capture failure reason
ALTER TABLE public.faucet_claims
ADD COLUMN IF NOT EXISTS error_message TEXT;
