-- Explicit, manual imports from the vault selected by the user. No credential
-- for Obsidian, background access to local files or changes to the vault.
ALTER TABLE public.client_knowledge DROP CONSTRAINT IF EXISTS client_knowledge_source_check;
ALTER TABLE public.client_knowledge ADD CONSTRAINT client_knowledge_source_check
 CHECK(source IN ('manual','ai_suggested','web','drive','obsidian'));
CREATE OR REPLACE FUNCTION public.import_obsidian_notes(p_client_id uuid,p_vault text,p_notes jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE note jsonb; note_path text; body text; restricted boolean; imported integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND role IN ('admin','coordenador')) THEN RAISE EXCEPTION 'Importação disponível para administradores e coordenadores.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Cliente indisponível.' USING ERRCODE='42501'; END IF;
 IF p_vault IS NULL OR length(trim(p_vault)) NOT BETWEEN 1 AND 100 OR p_vault ~ '[[:cntrl:]/\\]' OR p_notes IS NULL OR jsonb_typeof(p_notes)<>'array' OR jsonb_array_length(p_notes) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Seleção de notas inválida.'; END IF;
 FOR note IN SELECT value FROM jsonb_array_elements(p_notes) LOOP
  note_path:=note->>'path'; body:=note->>'content';
  IF note_path IS NULL OR length(note_path)>400 OR note_path !~ '\.md$' OR note_path ~ '(^|[/\\])\.' OR note_path ~* '(acesso|senha|password|credencial|credential|token|secret|chave|login|base de clientes|takeout|folha de pagamento|holerite|recursos humanos|documentos pessoais)' OR body IS NULL OR length(trim(body))=0 OR octet_length(body)>200000 THEN RAISE EXCEPTION 'Nota inválida ou restrita. Nenhuma nota deste lote foi importada.'; END IF;
  IF body ~ '(-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-(ant-|proj-|svcacct-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})' OR body ~* '(senha|password|token|api[_ -]?key|secret|chave)[[:space:]:=]+[^[:space:]]{8,}' OR (SELECT count(*) FROM regexp_matches(body,'[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+','g'))>15 OR (SELECT count(*) FROM regexp_matches(body,'(\+?[0-9]{2}[ .-]?)?\(?[0-9]{2}\)?[ .-]?[0-9]{4,5}[ .-]?[0-9]{4}','g'))>15 THEN RAISE EXCEPTION 'Conteúdo restrito detectado. Nenhuma nota deste lote foi importada.'; END IF;
  restricted:=(note_path||' '||body) ~* '(R[[:space:]]*[$]|\m(BRL|USD|EUR)\M|honor[áa]rio|retainer|financeir|contrat|mensalidade da ag[êe]ncia)';
  INSERT INTO public.client_knowledge(client_id,title,content,source,source_ref,financial_restricted,validated,created_by,updated_at)
   VALUES(p_client_id,'Obsidian / '||trim(p_vault)||' / '||note_path,body,'obsidian','obsidian:'||md5(trim(p_vault)||E'\n'||note_path),restricted,true,auth.uid(),now())
   ON CONFLICT(client_id,source_ref) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,financial_restricted=EXCLUDED.financial_restricted,validated=true,updated_at=now();
  imported:=imported+1;
 END LOOP;
 RETURN imported;
END $$;
REVOKE ALL ON FUNCTION public.import_obsidian_notes(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_obsidian_notes(uuid,text,jsonb) TO authenticated;
