BEGIN;
DO $$ DECLARE conn uuid; BEGIN
 conn:=public.wa_qr_prepare('14d33095-9db2-4f7f-b667-10110c52c919','f8231746-4c7c-47cb-9ce1-d7ef120ff29f');
 IF conn<>'c9503338-e251-42ee-8dfa-c0378fab7410' THEN RAISE EXCEPTION 'duplicate connection';END IF;
 BEGIN
  PERFORM public.wa_qr_prepare('00000000-0000-4000-8000-000000000001','f8231746-4c7c-47cb-9ce1-d7ef120ff29f');
  RAISE EXCEPTION 'unassigned access allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forbidden' THEN RAISE;END IF;END;
 IF has_table_privilege('authenticated','public.wa_qr_workers','SELECT') OR has_function_privilege('authenticated','public.wa_qr_prepare(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'private worker access';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','f8231746-4c7c-47cb-9ce1-d7ef120ff29f',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.wa_tracking_connections WHERE id='c9503338-e251-42ee-8dfa-c0378fab7410')<>1 THEN RAISE EXCEPTION 'assigned connection invisible';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_connections WHERE id<>'c9503338-e251-42ee-8dfa-c0378fab7410') THEN RAISE EXCEPTION 'unrelated connection visible';END IF;
END $$;
RESET ROLE;
UPDATE public.client_assignments SET is_active=false WHERE client_id='14d33095-9db2-4f7f-b667-10110c52c919' AND user_id='f8231746-4c7c-47cb-9ce1-d7ef120ff29f';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.wa_tracking_connections WHERE id='c9503338-e251-42ee-8dfa-c0378fab7410') THEN RAISE EXCEPTION 'inactive assignment retained access';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'self-service access and isolation verified; changes rolled back' AS validation;
