BEGIN;
DO $$ DECLARE checked timestamptz; lk uuid:='c9503338-e251-42ee-8dfa-c0378fab7410'; oct uuid:='8fc494cd-ccf4-43b1-a82c-85be648f931e'; BEGIN
 UPDATE public.wa_qr_sessions SET verified_at=NULL,status='qr' WHERE connection_id=lk;
 checked:=public.wa_qr_verify(lk,'5511999999999');
 IF checked IS NULL THEN RAISE EXCEPTION 'number verification failed';END IF;
 BEGIN
  PERFORM public.wa_qr_verify(lk,'5511888888888');RAISE EXCEPTION 'different device accepted without disconnect';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'number_changed' THEN RAISE;END IF;END;
 UPDATE public.wa_qr_sessions SET verified_at=NULL,status='qr' WHERE connection_id=lk;
 UPDATE public.wa_tracking_connections SET destination='5511999999999',enabled=true WHERE id=oct;
 BEGIN
  PERFORM public.wa_qr_verify(lk,'5511999999999');RAISE EXCEPTION 'duplicate active number accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'number_in_use' THEN RAISE;END IF;END;
 UPDATE public.wa_qr_sessions SET status='disconnecting' WHERE connection_id=lk;
 BEGIN
  PERFORM public.wa_qr_verify(lk,'5511777777777');RAISE EXCEPTION 'disconnect bypass accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'disconnect_in_progress' THEN RAISE;END IF;END;
 IF has_function_privilege('authenticated','public.wa_qr_verify(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'verification exposed';END IF;
END $$;
ROLLBACK;
SELECT 'QR verification, device switch, duplicate number and access checks passed; rolled back' AS validation;
