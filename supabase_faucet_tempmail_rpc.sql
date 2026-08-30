CREATE OR REPLACE FUNCTION public.check_and_increment_temp_mail_quota(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_access temp_mail_access%ROWTYPE;
    v_total_donated NUMERIC;
    v_limit INTEGER;
    today_pht DATE;
BEGIN
    -- Get current date in Asia/Manila timezone
    today_pht := (now() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::DATE;

    -- Fetch total donated by user
    SELECT COALESCE(total_donated, 0) INTO v_total_donated
    FROM public.faucet_user_stats
    WHERE user_id = target_user_id;
    
    -- Determine daily limit based on donations
    IF v_total_donated >= 10 THEN
        v_limit := 10000;
    ELSIF v_total_donated >= 5 THEN
        v_limit := 2500;
    ELSIF v_total_donated >= 3 THEN
        v_limit := 1000;
    ELSIF v_total_donated >= 2 THEN
        v_limit := 500;
    ELSIF v_total_donated >= 1 THEN
        v_limit := 250;
    ELSE
        v_limit := 100;
    END IF;

    -- Fetch current access record locking the row
    SELECT * INTO v_access
    FROM temp_mail_access
    WHERE user_id = target_user_id
    FOR UPDATE;

    -- Check approval
    -- If user donated (>0), bypass the approval requirement
    IF v_total_donated = 0 THEN
        IF v_access IS NULL OR v_access.status != 'approved' THEN
            RETURN FALSE;
        END IF;
    ELSE        -- Ensure they have an access row even if they bypassed
        IF v_access IS NULL THEN
            INSERT INTO temp_mail_access (user_id, status, daily_count, last_reset_date)
            VALUES (target_user_id, 'approved', 0, today_pht)
            RETURNING * INTO v_access;
        ELSIF v_access.status != 'approved' THEN
            UPDATE temp_mail_access
            SET status = 'approved'
            WHERE user_id = target_user_id
            RETURNING * INTO v_access;
        END IF;
    END IF;

    -- If the last reset date is older than today, reset the counter
    IF v_access.last_reset_date < today_pht THEN
        v_access.daily_count := 0;
    END IF;

    -- Check if limit is reached
    IF v_access.daily_count >= v_limit THEN
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
