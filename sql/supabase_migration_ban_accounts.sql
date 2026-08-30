-- Migration: Add is_banned to user_accounts
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false NOT NULL;
