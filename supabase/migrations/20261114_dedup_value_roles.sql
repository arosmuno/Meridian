-- Dedup v3 (14 nov 2026, casos BBVA AT1 y Zona Franca): dos reglas nuevas en 3 dias con mismo
-- importe y divisa: (a) titular parecido (sim >= 0.33) y misma familia de tipo; (b) papeles
-- cambiados (el comprador de una es el objetivo de la otra). Aplicada en Supabase como
-- migracion 20261114164051 dedup_value_roles. Backtest 60 dias: Zona Franca, KKR/Gen II,
-- Platinum/Urbaser; no confunde Cellnex con Bankinter.
CREATE OR REPLACE FUNCTION public.meridian_find_duplicate(p_headline text, p_buyer text, p_target text, p_value numeric, p_currency text, p_id bigint, p_type text)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  with cand as (
    select coalesce(d.dup_of, d.id) root_id, (r.excluded_reason is null) root_visible, d.created_at,
           extensions.similarity(lower(btrim(p_headline)), lower(btrim(d.headline))) sim,
           extensions.similarity(lower(btrim(coalesce(d.buyer,''))), lower(btrim(coalesce(p_buyer,'')))) bsim,
           d.buyer, d.target, d.value, d.currency, d.type, public.meridian_target_key(d.target) tk
    from deals d join deals r on r.id = coalesce(d.dup_of, d.id)
    where coalesce(d.category,'') <> 'excluded'
      and (d.dup_of is not null or coalesce(d.category,'') <> 'duplicate')
      and coalesce(r.category,'') <> 'excluded'
      and (p_id is null or (d.id <> p_id and r.id <> p_id))
      and d.created_at > now() - interval '10 days'
  ),
  me as (
    select public.meridian_target_key(p_target) tk,
           coalesce(lower(btrim(p_buyer)),'n/a') not in ('n/a','') has_buyer,
           coalesce(lower(btrim(p_target)),'n/a') not in ('n/a','') has_target,
           coalesce(p_buyer,'') ~* '(,| and | & )' multi_buyer
  )
  select c.root_id from cand c, me
  where c.sim >= 0.62
    or (me.has_buyer and me.has_target and lower(btrim(c.target)) = lower(btrim(p_target))
      and (lower(btrim(c.buyer)) = lower(btrim(p_buyer)) or c.bsim >= 0.45
        or lower(btrim(c.buyer)) like '%'||lower(btrim(p_buyer))||'%' or lower(btrim(p_buyer)) like '%'||lower(btrim(c.buyer))||'%')
      and (c.sim >= 0.35 or c.created_at > now() - interval '3 days'))
    or (coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency and c.sim >= 0.45)
    or (coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency and cardinality(me.tk) > 0 and me.tk = c.tk)
    or (p_type is not null and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and cardinality(me.tk) > 0 and cardinality(c.tk) > 0 and (me.tk <@ c.tk or c.tk <@ me.tk) and c.sim >= 0.2)
    or (p_type is not null and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and cardinality(me.tk) > 0 and me.tk = c.tk and c.created_at > now() - interval '3 days')
    or (p_type is not null and me.multi_buyer and coalesce(c.buyer,'') ~* '(,| and | & )'
      and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and c.bsim >= 0.5 and c.created_at > now() - interval '3 days')
    or (p_type is not null and me.has_buyer and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and cardinality(me.tk) > 0 and me.tk && c.tk and c.bsim >= 0.4 and c.created_at > now() - interval '3 days')
    or (coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency
      and p_type is not null and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and c.sim >= 0.33 and c.created_at > now() - interval '3 days')
    or (coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency
      and c.created_at > now() - interval '3 days'
      and ((me.has_buyer and lower(btrim(c.target)) = lower(btrim(p_buyer)))
        or (me.has_target and lower(btrim(c.buyer)) = lower(btrim(p_target)))))
  order by c.root_visible desc, c.sim desc, c.root_id asc
  limit 1;
$function$;
