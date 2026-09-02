-- ============================================================
-- GLOBAL CHATS: ADD EDIT SUPPORT
-- ============================================================

-- 1. Add is_edited column
ALTER TABLE public.global_chats
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- 2. Add UPDATE policy
-- Users can only update their own messages (e.g. text content and is_edited flag)
CREATE POLICY "Users can update their own chats" 
  ON public.global_chats FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
