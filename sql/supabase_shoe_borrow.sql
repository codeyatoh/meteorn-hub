-- Add borrowed columns to shoe_inventory_posts
ALTER TABLE public.shoe_inventory_posts
ADD COLUMN IF NOT EXISTS borrowed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS borrowed_by_nickname TEXT,
ADD COLUMN IF NOT EXISTS borrowed_at TIMESTAMP WITH TIME ZONE;

-- RPC for Borrowing
CREATE OR REPLACE FUNCTION public.borrow_shoe_post(p_post_id BIGINT, p_nickname TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_post RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the post and lock it for update to prevent race conditions
  SELECT * INTO v_post FROM public.shoe_inventory_posts WHERE id = p_post_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.user_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot borrow your own post';
  END IF;

  IF v_post.borrowed_by IS NOT NULL THEN
    RAISE EXCEPTION 'This post is already borrowed';
  END IF;

  -- Update the post
  UPDATE public.shoe_inventory_posts
  SET 
    borrowed_by = v_user_id,
    borrowed_by_nickname = p_nickname,
    borrowed_at = now()
  WHERE id = p_post_id;

  RETURN true;
END;
$$;

-- RPC for Returning
CREATE OR REPLACE FUNCTION public.return_shoe_post(p_post_id BIGINT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_post RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_post FROM public.shoe_inventory_posts WHERE id = p_post_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Only the owner or the borrower can return it
  IF v_post.user_id != v_user_id AND v_post.borrowed_by != v_user_id THEN
    RAISE EXCEPTION 'Not authorized to return this post';
  END IF;

  UPDATE public.shoe_inventory_posts
  SET 
    borrowed_by = NULL,
    borrowed_by_nickname = NULL,
    borrowed_at = NULL
  WHERE id = p_post_id;

  RETURN true;
END;
$$;
