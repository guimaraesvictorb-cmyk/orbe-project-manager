BEGIN;
ALTER TABLE public.wa_tracking_connections DROP CONSTRAINT IF EXISTS wa_tracking_connections_destination_check;
ALTER TABLE public.wa_tracking_connections ADD CONSTRAINT wa_tracking_connections_destination_check CHECK(destination='' OR destination ~ '^[1-9][0-9]{9,14}$');
CREATE TABLE IF NOT EXISTS public.wa_qr_workers(id text PRIMARY KEY,token_hash text UNIQUE NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),enabled boolean NOT NULL DEFAULT true,last_seen_at timestamptz);
ALTER TABLE public.wa_qr_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_qr_workers FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_qr_workers TO service_role;
ALTER TABLE public.wa_qr_sessions ADD COLUMN IF NOT EXISTS worker_id text NOT NULL DEFAULT 'orbe-vps';
CREATE OR REPLACE FUNCTION public.wa_qr_prepare(p_client uuid,p_user uuid) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE conn uuid; title text; method text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user AND p.is_active AND (p.role='admin' OR EXISTS(SELECT 1 FROM public.client_assignments a WHERE a.client_id=p_client AND a.user_id=p_user AND a.is_active))) THEN RAISE EXCEPTION 'forbidden';END IF;
 SELECT name INTO title FROM public.clients WHERE id=p_client AND deleted_at IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'forbidden';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client::text,0));
 SELECT connection_method INTO method FROM public.wa_tracking_setups WHERE client_id=p_client FOR UPDATE;
 IF method IS NOT NULL AND method NOT IN ('qr','undecided') THEN RAISE EXCEPTION 'official_connection_exists';END IF;
 INSERT INTO public.wa_tracking_setups(client_id,owner_user_id,connection_method,system) VALUES(p_client,p_user,'qr','sheets') ON CONFLICT(client_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.wa_tracking_setups WHERE client_id=p_client AND traffic_active) THEN RAISE EXCEPTION 'forbidden';END IF;
 SELECT id INTO conn FROM public.wa_tracking_connections WHERE client_id=p_client AND provider='evolution';
 IF conn IS NULL THEN
  conn:=gen_random_uuid();
  INSERT INTO public.wa_tracking_connections(id,client_id,owner_user_id,name,provider,destination,instance,redirect_url,capture_mode)
  SELECT conn,p_client,owner_user_id,left(title||' · WhatsApp',100),'evolution','','orbe-qr-'||replace(conn::text,'-',''),'https://studio.agenciaorbe.co/api/wa-redirect?connection='||conn,'client' FROM public.wa_tracking_setups WHERE client_id=p_client;
 END IF;
 INSERT INTO public.wa_qr_sessions(connection_id) VALUES(conn) ON CONFLICT DO NOTHING;
 INSERT INTO public.wa_tracking_members(connection_id,user_id) VALUES(conn,p_user) ON CONFLICT DO NOTHING;
 UPDATE public.wa_tracking_setups SET connection_id=conn,connection_method='qr',activation_requested=true WHERE client_id=p_client;
 RETURN conn;
END $$;
REVOKE ALL ON FUNCTION public.wa_qr_prepare(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_qr_prepare(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.wa_qr_verify(p_connection uuid,p_number text) RETURNS timestamptz LANGUAGE plpgsql SET search_path='' AS $$
DECLARE verified timestamptz; destination text;
BEGIN
 IF p_number !~ '^[1-9][0-9]{9,14}$' THEN RAISE EXCEPTION 'invalid_number';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wa-number:'||p_number,0));
 SELECT q.verified_at,c.destination INTO verified,destination FROM public.wa_qr_sessions q JOIN public.wa_tracking_connections c ON c.id=q.connection_id WHERE c.id=p_connection AND c.provider='evolution' FOR UPDATE OF q,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing';END IF;
 IF verified IS NOT NULL AND destination<>p_number THEN RAISE EXCEPTION 'number_changed';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_connections WHERE id<>p_connection AND destination=p_number AND enabled) THEN RAISE EXCEPTION 'number_in_use';END IF;
 verified:=coalesce(verified,now());
 UPDATE public.wa_tracking_connections SET destination=p_number WHERE id=p_connection;
 UPDATE public.wa_tracking_setups SET destination=p_number WHERE connection_id=p_connection;
 UPDATE public.wa_qr_sessions SET verified_at=verified WHERE connection_id=p_connection;
 RETURN verified;
END $$;
REVOKE ALL ON FUNCTION public.wa_qr_verify(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_qr_verify(uuid,text) TO service_role;
-- QR team access follows current client assignment, including direct reads.
ALTER POLICY wa_connections_authorized ON public.wa_tracking_connections TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active)
 AND (owner_user_id=(SELECT auth.uid()) OR (EXISTS(SELECT 1 FROM public.wa_tracking_members m WHERE m.connection_id=id AND m.user_id=(SELECT auth.uid()))
 AND (provider<>'evolution' OR client_id IS NULL OR EXISTS(SELECT 1 FROM public.client_assignments a WHERE a.client_id=wa_tracking_connections.client_id AND a.user_id=(SELECT auth.uid()) AND a.is_active)))));
NOTIFY pgrst,'reload schema';
COMMIT;
