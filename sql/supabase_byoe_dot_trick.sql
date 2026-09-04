ALTER TABLE public.user_gmail_connections
ADD COLUMN IF NOT EXISTS dot_trick_index INTEGER DEFAULT 0;
