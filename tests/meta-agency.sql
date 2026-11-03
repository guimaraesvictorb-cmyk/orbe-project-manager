BEGIN;
DO $$
DECLARE actor uuid; source uuid:='589481f6-3a15-4c93-b384-5d33373c20e3'; target uuid:='14d33095-9db2-4f7f-b667-10110c52c919'; source_stamp timestamptz; config_stamp timestamptz; link_stamp timestamptz;
BEGIN
 SELECT id INTO actor FROM public.profiles WHERE is_active AND role='admin' AND can_view_financials ORDER BY id LIMIT 1;
 SELECT updated_at INTO source_stamp FROM public.wa_ads_credentials WHERE client_id=source AND platform='meta';
 SELECT updated_at INTO config_stamp FROM public.orbe_meta_agency WHERE id;
 PERFORM public.orbe_meta_configure(source,source_stamp,config_stamp,actor);
 SELECT updated_at INTO config_stamp FROM public.orbe_meta_agency WHERE id;
 SELECT updated_at INTO link_stamp FROM public.orbe_meta_accounts WHERE client_id=target;
 PERFORM public.orbe_meta_map(target,'987654321','Synthetic test',source_stamp,config_stamp,link_stamp,actor);
 BEGIN
  PERFORM public.orbe_meta_map(target,'987654322','Stale test',source_stamp,config_stamp,link_stamp,actor);
  RAISE EXCEPTION 'stale mapping accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'configuration_changed' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.orbe_meta_configure(source,source_stamp-interval '1 second',config_stamp,actor);
  RAISE EXCEPTION 'rotated source accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'credentials_missing' THEN RAISE;END IF;END;
 IF has_table_privilege('authenticated','public.orbe_meta_agency','SELECT') OR has_table_privilege('authenticated','public.orbe_meta_accounts','SELECT') THEN RAISE EXCEPTION 'private registry exposed';END IF;
 IF has_function_privilege('authenticated','public.orbe_meta_configure(uuid,timestamptz,timestamptz,uuid)','EXECUTE') THEN RAISE EXCEPTION 'direct agency write exposed';END IF;
END $$;
ROLLBACK;
SELECT 'Agency registration, mapping concurrency, credential rotation and access checks passed; rolled back' AS validation;
