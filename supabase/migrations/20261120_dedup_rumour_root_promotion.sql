-- dedup_rumour_root_promotion (aplicada en Supabase 2026-11-20, version 20261120075253)
-- Una noticia firmada/cerrada y elegible ya no se marca como duplicado de un rumor excluido.
create or replace function public.meridian_normalize_deal()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_dup bigint;
begin
  new.sector := public.meridian_canon_sector(new.sector);
  new.source := public.meridian_canon_source(new.source);
  if new.dup_of is null and coalesce(new.category,'deal') <> 'duplicate' then
    v_dup := public.meridian_find_duplicate(new.headline, new.buyer, new.target, new.value, new.currency, new.id, new.type);
    if v_dup is not null
       and new.excluded_reason is null
       and coalesce(new.status,'') ~* '^(signed|closed|completed|announced|priced)$'
       and coalesce(new.headline,'') !~* '\m(targets?|offers?|proposals?|subsidiary)\M'
       and exists (select 1 from public.deals r where r.id = v_dup and r.excluded_reason ilike 'rumou%') then
      v_dup := null;
    end if;
    if v_dup is not null then
      new.dup_of := v_dup;
      new.orig_category := coalesce(new.orig_category, new.category);
      new.category := 'duplicate';
    end if;
  end if;
  return new;
end;
$function$;
