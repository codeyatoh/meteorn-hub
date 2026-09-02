-- ============================================================
-- FIX UNRESTRICTED TABLES (PROFILES & YATMAIL_MESSAGES)
-- ============================================================


-- 2. YATMAIL_MESSAGES TABLE
ALTER TABLE public.yatmail_messages ENABLE ROW LEVEL SECURITY;

-- Note: The exact policy depends on your yatmail_messages table structure.
-- Usually it's linked to the user's session or email address. 
-- Assuming it has a `user_id` column:
CREATE POLICY "Users can view their own yatmail messages"
  ON public.yatmail_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own yatmail messages"
  ON public.yatmail_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own yatmail messages"
  ON public.yatmail_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());