-- Run after the schema inside a transaction; always ROLLBACK.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"0d7bbe99-8f3f-4990-82ef-a0e7ffd6ce6c","role":"authenticated"}',true);
INSERT INTO public.wa_bi_goals(connection_id,month,unit,target) VALUES('1fd22072-6932-4122-941f-cb31c55efd66','2099-01-01','all',123) ON CONFLICT(connection_id,month,unit) DO UPDATE SET target=123;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.wa_bi_goals WHERE month='2099-01-01' AND target=123) THEN RAISE EXCEPTION 'admin_write_failed'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"sub":"f8231746-4c7c-47cb-9ce1-d7ef120ff29f","role":"authenticated"}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.wa_bi_goals WHERE connection_id='1fd22072-6932-4122-941f-cb31c55efd66') THEN RAISE EXCEPTION 'other_client_leak'; END IF; BEGIN INSERT INTO public.wa_bi_goals(connection_id,month,unit,target) VALUES('c9503338-e251-42ee-8dfa-c0378fab7410','2099-01-01','all',1); RAISE EXCEPTION 'staff_write_allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
SELECT NOT has_table_privilege('anon','public.wa_bi_goals','SELECT') AS anonymous_blocked;
ROLLBACK;
