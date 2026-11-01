
SET LOCAL ROLE service_role;
DO $$ DECLARE n integer; BEGIN FOR n IN 1..10 LOOP IF NOT public.wa_dashboard_access_attempt(repeat('b',64)) THEN RAISE EXCEPTION 'early_limit'; END IF; END LOOP; IF public.wa_dashboard_access_attempt(repeat('b',64)) THEN RAISE EXCEPTION 'rate_limit_missing'; END IF; END $$;
RESET ROLE;
SELECT NOT has_function_privilege('anon','public.wa_dashboard_access_attempt(text)','EXECUTE') AS anonymous_rate_rpc_blocked, NOT has_table_privilege('authenticated','public.wa_dashboard_access_attempts','SELECT') AS attempts_private;
ROLLBACK;
