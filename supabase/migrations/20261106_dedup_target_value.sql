-- Dedup: la misma operacion con tipo distinto (ECM vs M&A) y titulares poco parecidos
-- se colaba (caso Kabilio, 5 nov 2026). Dos reglas nuevas, sin depender del tipo ni del titular:
--  (a) mismo objetivo (target_key identico) + mismo importe y divisa, en 10 dias;
--  (b) mismo objetivo + mismo comprador (o muy parecido), en 3 dias.
CREATE OR REPLACE FUNCTION public.meridian_find_duplicate(p_headline text, p_buyer text, p_target text, p_value numeric, p_currency text, p_id bigint, p_type text)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  with cand as (
    select d.id, d.created_at,
           extensions.similarity(lower(btrim(p_headline)), lower(btrim(d.headline))) sim,
           d.buyer, d.target, d.value, d.currency, d.type,
           public.meridian_target_key(d.target) tk
    from deals d
    where d.dup_of is null
      and coalesce(d.category,'') not in ('duplicate','excluded')
      and (p_id is null or d.id <> p_id)
      and d.created_at > now() - interval '10 days'
  ),
  me as (select public.meridian_target_key(p_target) tk)
  select c.id from cand c, me
  where
    c.sim >= 0.62
    or (
      coalesce(lower(btrim(p_buyer)),'n/a') not in ('n/a','') and coalesce(lower(btrim(p_target)),'n/a') not in ('n/a','')
      and lower(btrim(c.target)) = lower(btrim(p_target))
      and (
        lower(btrim(c.buyer)) = lower(btrim(p_buyer))
        or extensions.similarity(lower(btrim(c.buyer)), lower(btrim(p_buyer))) >= 0.45
        or lower(btrim(c.buyer)) like '%'||lower(btrim(p_buyer))||'%'
        or lower(btrim(p_buyer)) like '%'||lower(btrim(c.buyer))||'%'
      )
      and (c.sim >= 0.35 or c.created_at > now() - interval '3 days')
    )
    or (
      coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency
      and c.sim >= 0.45
    )
    or (
      coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency
      and cardinality(me.tk) > 0 and me.tk = c.tk
    )
    or (
      p_type is not null
      and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and cardinality(me.tk) > 0 and cardinality(c.tk) > 0
      and (me.tk <@ c.tk or c.tk <@ me.tk)
      and c.sim >= 0.2
    )
    or (
      p_type is not null
      and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and cardinality(me.tk) > 0 and me.tk = c.tk
      and c.created_at > now() - interval '3 days'
    )
  order by c.sim desc, c.id asc
  limit 1;
$function$;
