-- Enable real-time for user_accounts and income_logs
ALTER PUBLICATION supabase_realtime ADD TABLE user_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE income_logs;
