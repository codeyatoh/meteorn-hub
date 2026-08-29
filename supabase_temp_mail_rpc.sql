-- Atomically increments the daily temp mail generation count for a user.
-- Prevents race conditions by locking the row during the transaction.
-- Returns true if successful, false if the daily limit is reached or user is unapproved.

CREATE OR REPLACE FUNCTION increment_temp_mail_count(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    today_pht TEXT;
    v_access RECORD;
BEGIN
    -- Get today's date in Philippine Time (PHT) formatted as YYYY-MM-DD
    today_pht := to_char(timezone('Asia/Manila', now()), 'YYYY-MM-DD');

    -- Lock the user's row for update to prevent concurrent race conditions
    SELECT * INTO v_access
    FROM temp_mail_access
    WHERE user_id = target_user_id
    FOR UPDATE;

    -- If no record exists or not approved, deny
    IF v_access IS NULL OR v_access.status != 'approved' THEN
        RETURN FALSE;
    END IF;

    -- If the last reset date is older than today, reset the counter
    IF v_access.last_reset_date < today_pht THEN
        v_access.daily_count := 0;
    END IF;

    -- Check if limit is reached
    IF v_access.daily_count >= 100 THEN
        RETURN FALSE;
    END IF;

    -- Increment and update
    UPDATE temp_mail_access
    SET 
        daily_count = v_access.daily_count + 1,
        last_reset_date = today_pht,
        updated_at = now()
    WHERE user_id = target_user_id;

    RETURN TRUE;
END;
$$;
