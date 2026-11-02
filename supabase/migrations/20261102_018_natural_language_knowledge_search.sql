-- Full sentences should rank relevant terms, rather than require every word
-- of a question to occur in the same document. RLS still applies to each CTE.
CREATE OR REPLACE FUNCTION public.search_client_knowledge(p_client_id uuid,p_query text,p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid,title text,content text,source text,source_url text,rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 WITH query AS (
  SELECT to_tsquery('portuguese',coalesce(string_agg(quote_literal(term),' | '),'')) AS terms
  FROM unnest(tsvector_to_array(to_tsvector('portuguese',left(coalesce(p_query,''),2000)))) AS term
 ), candidates AS (
  SELECT k.id,k.title,k.content,k.source,k.source_url,k.updated_at,
   k.search_vector @@ query.terms AS matched,
   ts_rank_cd(setweight(to_tsvector('portuguese',k.title),'A')||setweight(k.search_vector,'B'),query.terms,34) AS score
  FROM public.client_knowledge k CROSS JOIN query
  WHERE k.client_id=p_client_id AND k.validated
 ), ranked AS (
  SELECT candidates.*,row_number() OVER(PARTITION BY coalesce(source_url,id::text) ORDER BY score DESC,updated_at DESC,id) AS document_part
  FROM candidates WHERE matched OR NOT EXISTS(SELECT 1 FROM candidates WHERE matched)
 )
 SELECT r.id,r.title,ts_headline('portuguese',r.content,query.terms,'MaxWords=300,MinWords=60,MaxFragments=3'),r.source,r.source_url,r.score
 FROM ranked r CROSS JOIN query WHERE r.document_part<=2
 ORDER BY r.score DESC,r.updated_at DESC,r.id
 LIMIT LEAST(GREATEST(coalesce(p_limit,5),1),10);
$$;
REVOKE ALL ON FUNCTION public.search_client_knowledge(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_client_knowledge(uuid,text,integer) TO authenticated;
