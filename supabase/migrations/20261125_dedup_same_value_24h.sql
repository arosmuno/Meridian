-- dedup (2026-11-25): mismo importe + divisa + familia de tipo en 24 h y titulares minimamente parecidos (sim >= 0.2).
-- Caso: "Plural Leads $1bn Funding Round for BioNTech Founders' Cancer Start-up" vs
--       "BioNTech Founders Raise $1 Billion for New Oncology Venture" (sim 0.23, buyer N/A, target generico).
-- Backtest 60 dias: atrapa 4 duplicados visibles (bioAffinity $4m, KKR/Gen II, AIxC/FFAI, BioNTech) y 0 falsos positivos;
-- el unico falso positivo con la regla sin limite de tiempo (Cellnex vs Bankinter EUR 750m) estaba a 48 h y queda fuera.
do $mig$
declare
  v_def text;
  v_marker text := '  order by c.root_visible desc, c.sim desc, c.root_id asc';
  v_clause text := $c$    -- nuevo (2026-11-25): mismo importe/divisa/familia en 24 h con titulares minimamente parecidos
    or (coalesce(p_value,0) > 0 and c.value = p_value and c.currency is not distinct from p_currency
      and p_type is not null and public.meridian_type_family(c.type) = public.meridian_type_family(p_type)
      and public.meridian_type_family(p_type) <> 'macro'
      and c.sim >= 0.2 and c.created_at > now() - interval '24 hours')
$c$;
begin
  select pg_get_functiondef('public.meridian_find_duplicate(text,text,text,numeric,text,bigint,text)'::regprocedure) into v_def;
  if position('nuevo (2026-11-25)' in v_def) > 0 then
    return;
  end if;
  if position(v_marker in v_def) = 0 then
    raise exception 'marker not found in meridian_find_duplicate';
  end if;
  v_def := replace(v_def, v_marker, v_clause || v_marker);
  execute v_def;
end
$mig$;
