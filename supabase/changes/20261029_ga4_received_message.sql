BEGIN;
CREATE TABLE public.wa_ga4_streams (
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
 measurement_id text NOT NULL CHECK(measurement_id ~ '^G-[A-Z0-9]{6,15}$'),
 site_hostname text NOT NULL CHECK(site_hostname ~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$'),
 secret_ciphertext text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,measurement_id),UNIQUE(connection_id,site_hostname)
);
ALTER TABLE public.wa_ga4_streams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_ga4_streams FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_ga4_streams TO service_role;
CREATE TABLE public.wa_ga4_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
 measurement_id text NOT NULL,
 source_ref text NOT NULL,
 message_key text NOT NULL,
 client_id text NOT NULL CHECK(client_id ~ '^[0-9]{1,20}\.[0-9]{1,20}$'),
 session_id text NOT NULL CHECK(session_id ~ '^[0-9]{10}$'),
 clicked_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','submitted','uncertain','failed')),
 last_error text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(connection_id,measurement_id,source_ref),
 FOREIGN KEY(connection_id,measurement_id) REFERENCES public.wa_ga4_streams(connection_id,measurement_id)
);
ALTER TABLE public.wa_ga4_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_ga4_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_ga4_outbox TO service_role;
CREATE FUNCTION public.wa_ga4_queue_received() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE click_row record; ctx jsonb;
BEGIN
 IF NEW.entity<>'messages' OR (NEW.payload->>'attribution_reason') IS DISTINCT FROM 'reference_match' THEN RETURN NEW;END IF;
 SELECT * INTO click_row FROM public.wa_tracking_records WHERE connection_id=NEW.connection_id AND entity='clicks' AND entity_key=NEW.payload->>'source_ref' AND payload->>'linked_sender_id'=NEW.payload->>'contact_id';
 IF NOT FOUND THEN RETURN NEW;END IF;
 ctx:=click_row.payload->'ga_context';
 IF ctx IS NULL OR NOT EXISTS(SELECT 1 FROM public.wa_ga4_streams WHERE connection_id=NEW.connection_id AND measurement_id=ctx->>'measurement_id' AND enabled) THEN RETURN NEW;END IF;
 IF coalesce(ctx->>'client_id','') !~ '^[0-9]{1,20}\.[0-9]{1,20}$' OR coalesce(ctx->>'session_id','') !~ '^[0-9]{10}$' THEN RETURN NEW;END IF;
 IF click_row.occurred_at<to_timestamp((ctx->>'session_id')::bigint) OR NEW.occurred_at>now() OR NEW.occurred_at<click_row.occurred_at OR NEW.occurred_at<to_timestamp((ctx->>'session_id')::bigint) OR now()>to_timestamp((ctx->>'session_id')::bigint)+interval '24 hours' THEN RETURN NEW;END IF;
 INSERT INTO public.wa_ga4_outbox(connection_id,measurement_id,source_ref,message_key,client_id,session_id,clicked_at,received_at)
 VALUES(NEW.connection_id,ctx->>'measurement_id',NEW.payload->>'source_ref',NEW.entity_key,ctx->>'client_id',ctx->>'session_id',click_row.occurred_at,NEW.occurred_at)
 ON CONFLICT(connection_id,measurement_id,source_ref) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wa_ga4_queue_received() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wa_ga4_queue_received AFTER INSERT ON public.wa_tracking_records FOR EACH ROW EXECUTE FUNCTION public.wa_ga4_queue_received();
CREATE FUNCTION public.wa_ga4_claim(p_connection uuid) RETURNS SETOF public.wa_ga4_outbox LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 UPDATE public.wa_ga4_outbox SET status='uncertain',last_error='delivery_unknown',updated_at=now() WHERE connection_id=p_connection AND status='sending' AND updated_at<now()-interval '5 minutes';
 RETURN QUERY WITH candidates AS (SELECT id FROM public.wa_ga4_outbox WHERE connection_id=p_connection AND status='pending' ORDER BY received_at LIMIT 10 FOR UPDATE SKIP LOCKED)
 UPDATE public.wa_ga4_outbox o SET status='sending',updated_at=now() FROM candidates c WHERE o.id=c.id RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.wa_ga4_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ga4_claim(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
