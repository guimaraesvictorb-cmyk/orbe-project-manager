-- Run only inside a transaction and roll back all fixtures.
DO $$
DECLARE cfg record; marker text:=upper(replace(gen_random_uuid()::text,'-','')); unknown_ref text:=upper(replace(gen_random_uuid()::text,'-','')); other uuid; msg jsonb; result jsonb; payload jsonb; cid text; initial_clicks bigint; caught boolean:=false;
BEGIN
 SELECT * INTO STRICT cfg FROM public.wa_kommo_credentials WHERE connection_id='1fd22072-6932-4122-941f-cb31c55efd66' AND enabled;
 IF has_table_privilege('anon','public.wa_campaign_markers','SELECT') OR has_table_privilege('authenticated','public.wa_campaign_markers','UPDATE') THEN RAISE EXCEPTION 'marker permissions exposed'; END IF;
 SELECT count(*) INTO initial_clicks FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='clicks';
 INSERT INTO public.wa_campaign_markers(connection_id,reference,name,utm_source,utm_medium,utm_campaign,enabled,created_at)
 VALUES(cfg.connection_id,marker,'Rollback fixture','google','cpc','rollback_fixture',true,now()-interval '1 minute');
 msg:=jsonb_build_object('id','marker-fixture-'||marker,'contact_id','marker-fixture-1','lead_id','0','text','Olá','created_at',now(),'type','text','origin','whatsapp','reference',marker);
 result:=public.wa_kommo_receive(cfg.webhook_hash,cfg.account_id,cfg.account_origin,jsonb_build_array(msg));
 SELECT r.payload INTO STRICT payload FROM public.wa_tracking_records r WHERE connection_id=cfg.connection_id AND entity='messages' AND entity_key=msg->>'id';
 IF payload->>'attribution_reason'<>'campaign_marker' OR payload->>'utm_source'<>'google' OR payload->>'gclid'<>'' THEN RAISE EXCEPTION 'marker failed or invented click id';END IF;
 result:=public.wa_kommo_receive(cfg.webhook_hash,cfg.account_id,cfg.account_origin,jsonb_build_array(msg));
 IF result->>'accepted'<>'0' THEN RAISE EXCEPTION 'replay duplicated';END IF;
 msg:=msg||jsonb_build_object('id','marker-second-'||marker,'contact_id','marker-fixture-2');
 PERFORM public.wa_kommo_receive(cfg.webhook_hash,cfg.account_id,cfg.account_origin,jsonb_build_array(msg));
 SELECT r.payload INTO STRICT payload FROM public.wa_tracking_records r WHERE connection_id=cfg.connection_id AND entity='messages' AND entity_key=msg->>'id';
 IF payload->>'attribution_reason'<>'campaign_marker' THEN RAISE EXCEPTION 'marker not reusable';END IF;
 UPDATE public.wa_campaign_markers SET enabled=false WHERE reference=marker;
 msg:=msg||jsonb_build_object('id','marker-disabled-'||marker);
 PERFORM public.wa_kommo_receive(cfg.webhook_hash,cfg.account_id,cfg.account_origin,jsonb_build_array(msg));
 SELECT r.payload INTO STRICT payload FROM public.wa_tracking_records r WHERE connection_id=cfg.connection_id AND entity='messages' AND entity_key=msg->>'id';
 IF payload->>'attribution_reason'<>'no_reference' OR payload->>'utm_source'<>'' THEN RAISE EXCEPTION 'disabled marker used';END IF;
 INSERT INTO public.wa_tracking_connections(owner_user_id,name,provider,destination,instance,redirect_url)
 SELECT owner_user_id,'Rollback fixture','kommo',destination,'fixture-'||marker,redirect_url FROM public.wa_tracking_connections WHERE id=cfg.connection_id RETURNING id INTO other;
 INSERT INTO public.wa_campaign_markers(connection_id,reference,name,utm_source,enabled,created_at) VALUES(other,unknown_ref,'Other connection','wrong',true,now()-interval '1 minute');
 msg:=msg||jsonb_build_object('id','marker-isolated-'||marker,'reference',unknown_ref);
 PERFORM public.wa_kommo_receive(cfg.webhook_hash,cfg.account_id,cfg.account_origin,jsonb_build_array(msg));
 SELECT r.payload INTO STRICT payload FROM public.wa_tracking_records r WHERE connection_id=cfg.connection_id AND entity='messages' AND entity_key=msg->>'id';
 IF payload->>'attribution_reason'<>'no_reference' THEN RAISE EXCEPTION 'cross connection marker';END IF;
 BEGIN PERFORM public.wa_kommo_receive(cfg.webhook_hash,'invalid',cfg.account_origin,jsonb_build_array(msg)); EXCEPTION WHEN OTHERS THEN caught:=true;END;
 IF NOT caught THEN RAISE EXCEPTION 'wrong account accepted';END IF;
 IF (SELECT count(*) FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='clicks')<>initial_clicks THEN RAISE EXCEPTION 'invented click';END IF;
END $$;
