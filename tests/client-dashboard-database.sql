
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM 1 FROM public.wa_dashboard_links; RAISE EXCEPTION 'read_not_denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
SELECT NOT has_table_privilege('anon','public.wa_dashboard_links','SELECT') AS anonymous_cannot_read_tokens, NOT has_table_privilege('authenticated','public.wa_dashboard_links','INSERT') AS users_cannot_mint_links;
ROLLBACK;
