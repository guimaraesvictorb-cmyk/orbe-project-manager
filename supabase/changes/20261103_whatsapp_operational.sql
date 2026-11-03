-- Fix QR number verification and enable the explicitly authorized LK/Octagon channels.
-- Retains existing channel RLS, private worker keys and the unrelated ORBE pilot.
BEGIN;
ALTER TABLE public.wa_qr_sessions DROP CONSTRAINT IF EXISTS wa_qr_sessions_status_check;
ALTER TABLE public.wa_qr_sessions ADD CONSTRAINT wa_qr_sessions_status_check
 CHECK(status IN ('idle','requested','connecting','qr','open','close','wrong_number','error','disconnecting'));
CREATE OR REPLACE FUNCTION public.wa_qr_verify(p_connection uuid,p_number text) RETURNS timestamptz LANGUAGE plpgsql SET search_path='' AS $$
DECLARE verified timestamptz; bound_destination text; session_status text;
BEGIN
 IF p_number !~ '^[1-9][0-9]{9,14}$' THEN RAISE EXCEPTION 'invalid_number';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wa-number:'||p_number,0));
 SELECT q.verified_at,c.destination,q.status INTO verified,bound_destination,session_status FROM public.wa_qr_sessions q JOIN public.wa_tracking_connections c ON c.id=q.connection_id WHERE c.id=p_connection AND c.provider='evolution' FOR UPDATE OF q,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing';END IF;
 IF session_status='disconnecting' THEN RAISE EXCEPTION 'disconnect_in_progress';END IF;
 IF verified IS NOT NULL AND bound_destination<>p_number THEN RAISE EXCEPTION 'number_changed';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_connections WHERE wa_tracking_connections.id<>p_connection AND wa_tracking_connections.destination=p_number AND wa_tracking_connections.enabled) THEN RAISE EXCEPTION 'number_in_use';END IF;
 verified:=coalesce(verified,now());
 UPDATE public.wa_tracking_connections SET destination=p_number WHERE id=p_connection;
 UPDATE public.wa_tracking_setups SET destination=p_number WHERE connection_id=p_connection;
 UPDATE public.wa_qr_sessions SET verified_at=verified WHERE connection_id=p_connection;
 RETURN verified;
END $$;
REVOKE ALL ON FUNCTION public.wa_qr_verify(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_qr_verify(uuid,text) TO service_role;

UPDATE public.wa_tracking_connections SET capture_mode='client',allowed_senders='{}'
 WHERE id IN ('c9503338-e251-42ee-8dfa-c0378fab7410','8fc494cd-ccf4-43b1-a82c-85be648f931e')
 AND provider='evolution' AND client_id IS NOT NULL;
NOTIFY pgrst,'reload schema';
COMMIT;
