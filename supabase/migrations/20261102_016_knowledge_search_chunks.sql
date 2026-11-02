BEGIN;
CREATE OR REPLACE FUNCTION public.classify_knowledge_financial_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.financial_restricted := coalesce(NEW.financial_restricted,false) OR
    (coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,'')) ~* '(R[[:space:]]*[$]|\m(BRL|USD|EUR)\M|honor[áa]rio|retainer|financeir|contrat|mensalidade da ag[êe]ncia)';
  RETURN NEW;
END;
$$;
UPDATE public.client_knowledge SET financial_restricted=financial_restricted;

CREATE OR REPLACE FUNCTION public.search_client_knowledge(p_client_id uuid,p_query text,p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid,title text,content text,source text,source_url text,rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  WITH query AS (SELECT websearch_to_tsquery('portuguese',coalesce(p_query,'')) AS terms)
  SELECT k.id,k.title,
    ts_headline('portuguese',k.content,query.terms,'MaxWords=300,MinWords=60,MaxFragments=3'),
    k.source,k.source_url,ts_rank(k.search_vector,query.terms)
  FROM public.client_knowledge k CROSS JOIN query
  WHERE k.client_id=p_client_id AND k.validated
    AND (k.search_vector @@ query.terms OR NOT EXISTS (
      SELECT 1 FROM public.client_knowledge candidate
      WHERE candidate.client_id=p_client_id AND candidate.validated AND candidate.search_vector @@ query.terms
    ))
  ORDER BY ts_rank(k.search_vector,query.terms) DESC,k.updated_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit,5),1),10);
$$;
REVOKE ALL ON FUNCTION public.search_client_knowledge(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_client_knowledge(uuid,text,integer) TO authenticated;
COMMIT;
