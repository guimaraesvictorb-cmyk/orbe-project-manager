BEGIN;
SET LOCAL ROLE service_role;
DO $$ DECLARE stamp timestamptz;
BEGIN
 IF has_table_privilege('authenticated','public.wa_ads_credentials','SELECT') OR has_table_privilege('anon','public.wa_ads_credentials','SELECT') OR has_function_privilege('authenticated','public.wa_ads_save(uuid,text,text,text,text,boolean,timestamptz,uuid,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'credential access exposed';END IF;
 PERFORM public.wa_ads_save('14d33095-9db2-4f7f-b667-10110c52c919','meta','1234567890123456','SYNTHETIC_NOT_A_CREDENTIAL','saved_unverified',false,NULL,'0d7bbe99-8f3f-4990-82ef-a0e7ffd6ce6c',NULL);
 SELECT updated_at INTO stamp FROM public.wa_ads_credentials WHERE client_id='14d33095-9db2-4f7f-b667-10110c52c919' AND platform='meta';
 BEGIN
  PERFORM public.wa_ads_save('14d33095-9db2-4f7f-b667-10110c52c919','meta','1234567890123456','SYNTHETIC_REPLACE','saved_unverified',false,NULL,'0d7bbe99-8f3f-4990-82ef-a0e7ffd6ce6c',NULL);
  RAISE EXCEPTION 'stale overwrite allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'configuration_changed' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.wa_ads_save('14d33095-9db2-4f7f-b667-10110c52c919','meta','1234567890123456','SYNTHETIC_REPLACE','saved_unverified',false,NULL,'f8231746-4c7c-47cb-9ce1-d7ef120ff29f',stamp);
  RAISE EXCEPTION 'staff credential management allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forbidden' THEN RAISE;END IF;END;
 PERFORM public.wa_ads_save('14d33095-9db2-4f7f-b667-10110c52c919','meta','1234567890123456','SYNTHETIC_REPLACE','saved_unverified',false,NULL,'0d7bbe99-8f3f-4990-82ef-a0e7ffd6ce6c',stamp);
 IF (SELECT count(*) FROM public.wa_ads_credential_audit WHERE client_id='14d33095-9db2-4f7f-b667-10110c52c919')<>2 THEN RAISE EXCEPTION 'audit incomplete';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'encrypted-store privileges, administrator restriction, concurrency and audit verified; synthetic changes rolled back' AS validation;
