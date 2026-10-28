-- Aplicada en produccion por partes (MCP de Supabase) el 2026-10-28; las politicas de tablas
-- existentes se cambian con ALTER POLICY (sin borrarlas).
-- Meridian Dataroom v3: postores aislados, versiones, avisos, lectura por postor y cierre de sala.
--
-- Modelo de acceso por sala:
--   * owner/admin de la organizacion: lo ven todo, siempre (tambien con la sala cerrada).
--   * "postor": usuario que esta en algun grupo de postores de la organizacion. Solo ve las salas
--     donde tiene grupo, y dentro solo las preguntas (Q&A y chat) de su propio grupo, las carpetas
--     abiertas y las restringidas a las que se dio acceso a su grupo o a el.
--   * resto de miembros: equipo vendedor (ven todo lo no restringido y las preguntas de todos).
--   * sala cerrada o acceso caducado (de la sala o del grupo): nadie salvo owner/admin entra.

-- ---------- Tablas nuevas ----------
create table if not exists dataroom.room_groups (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references dataroom.rooms(id) on delete cascade,
  org_id uuid not null references dataroom.orgs(id) on delete cascade,
  name text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, name)
);
create table if not exists dataroom.group_members (
  group_id uuid not null references dataroom.room_groups(id) on delete cascade,
  room_id uuid not null references dataroom.rooms(id) on delete cascade,
  org_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists group_members_group_idx on dataroom.group_members (group_id);
create index if not exists group_members_org_user_idx on dataroom.group_members (org_id, user_id);
create table if not exists dataroom.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references dataroom.room_groups(id) on delete cascade,
  room_id uuid not null references dataroom.rooms(id) on delete cascade,
  org_id uuid not null,
  email text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (group_id, email)
);
create table if not exists dataroom.folder_group_access (
  folder_id uuid not null references dataroom.folders(id) on delete cascade,
  group_id uuid not null references dataroom.room_groups(id) on delete cascade,
  org_id uuid not null,
  primary key (folder_id, group_id)
);
create table if not exists dataroom.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  room_id uuid references dataroom.rooms(id) on delete cascade,
  user_id uuid not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notifications_pending_idx on dataroom.notifications (created_at) where sent_at is null;
create table if not exists dataroom.doc_reads (
  document_id uuid not null references dataroom.documents(id) on delete cascade,
  user_id uuid not null,
  room_id uuid not null,
  org_id uuid not null,
  day date not null default current_date,
  seconds int not null default 0,
  views int not null default 0,
  last_at timestamptz not null default now(),
  primary key (document_id, user_id, day)
);
create index if not exists doc_reads_room_idx on dataroom.doc_reads (room_id);

-- ---------- Columnas nuevas ----------
alter table dataroom.rooms add column if not exists access_expires_at timestamptz;
alter table dataroom.rooms add column if not exists closed_at timestamptz;
alter table dataroom.documents add column if not exists version int not null default 1;
alter table dataroom.documents add column if not exists replaces_id uuid;
alter table dataroom.documents add column if not exists superseded_by uuid;
alter table dataroom.documents add column if not exists version_note text;
alter table dataroom.questions add column if not exists group_id uuid references dataroom.room_groups(id) on delete set null;
alter table dataroom.questions add column if not exists visibility text not null default 'group';
do $$ begin
  alter table dataroom.questions add constraint questions_visibility_check check (visibility in ('group','all'));
exception when duplicate_object then null; end $$;
alter table dataroom.memberships add column if not exists notify boolean not null default true;

-- ---------- Funciones de acceso ----------
create or replace function dataroom.is_bidder_user(p_org uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = dataroom as $$
  select exists (select 1 from dataroom.group_members gm where gm.org_id = p_org and gm.user_id = p_user)
     and not exists (select 1 from dataroom.memberships m where m.org_id = p_org and m.user_id = p_user and m.role in ('owner','admin'));
$$;

create or replace function dataroom.user_group(p_room uuid, p_user uuid) returns uuid
language sql stable security definer set search_path = dataroom as $$
  select group_id from dataroom.group_members where room_id = p_room and user_id = p_user;
$$;

-- Todo lo que hace falta saber del acceso de un usuario a una sala, en una llamada.
create or replace function dataroom.room_access(p_room uuid, p_user uuid)
returns table(role text, visible boolean, is_seller boolean, group_id uuid, group_name text, open boolean, reason text)
language plpgsql stable security definer set search_path = dataroom as $$
declare r dataroom.rooms; v_role text; v_bidder boolean; g record;
begin
  select * into r from dataroom.rooms where id = p_room;
  if r.id is null then return; end if;
  select m.role into v_role from dataroom.memberships m where m.org_id = r.org_id and m.user_id = p_user;
  if v_role is null then
    return query select null::text, false, false, null::uuid, null::text, false, 'no_member'::text; return;
  end if;
  v_bidder := dataroom.is_bidder_user(r.org_id, p_user);
  select gm.group_id, rg.name, rg.expires_at into g
    from dataroom.group_members gm join dataroom.room_groups rg on rg.id = gm.group_id
   where gm.room_id = p_room and gm.user_id = p_user;
  if v_role in ('owner','admin') then
    return query select v_role, true, true, g.group_id, g.name, true, null::text; return;
  end if;
  if v_bidder and g.group_id is null then
    return query select v_role, false, false, null::uuid, null::text, false, 'no_group'::text; return;
  end if;
  return query select v_role, true, not v_bidder, g.group_id, g.name,
    (r.status = 'active' and coalesce(r.access_expires_at > now(), true) and coalesce(g.expires_at > now(), true)),
    case when r.status <> 'active' then 'closed'
         when r.access_expires_at <= now() or g.expires_at <= now() then 'expired' end;
end $$;

create or replace function dataroom.room_open_for(p_room uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = dataroom as $$
  select coalesce((select open from dataroom.room_access(p_room, p_user)), false);
$$;
create or replace function dataroom.room_visible_for(p_room uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = dataroom as $$
  select coalesce((select visible from dataroom.room_access(p_room, p_user)), false);
$$;
create or replace function dataroom.is_seller(p_room uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = dataroom as $$
  select coalesce((select is_seller from dataroom.room_access(p_room, p_user)), false);
$$;
create or replace function dataroom.room_open(p_room uuid) returns boolean
language sql stable security definer set search_path = dataroom as $$
  select dataroom.room_open_for(p_room, auth.uid());
$$;

-- Carpetas restringidas: acceso por persona o por grupo de postores.
create or replace function dataroom.user_can_folder(p_user uuid, p_folder uuid) returns boolean
language sql stable security definer set search_path = dataroom as $$
  with recursive anc as (
    select f.id, f.parent_id, f.restricted, f.org_id from dataroom.folders f where f.id = p_folder
    union all
    select f.id, f.parent_id, f.restricted, f.org_id from dataroom.folders f join anc on f.id = anc.parent_id
  )
  select p_folder is null
    or exists (select 1 from dataroom.memberships m join dataroom.folders f on f.id = p_folder
               where m.org_id = f.org_id and m.user_id = p_user and m.role in ('owner','admin'))
    or (
      exists (select 1 from dataroom.memberships m join dataroom.folders f on f.id = p_folder
              where m.org_id = f.org_id and m.user_id = p_user)
      and not exists (
        select 1 from anc where anc.restricted
          and not exists (select 1 from dataroom.folder_access fa where fa.folder_id = anc.id and fa.user_id = p_user)
          and not exists (select 1 from dataroom.folder_group_access ga
                            join dataroom.group_members gm on gm.group_id = ga.group_id
                           where ga.folder_id = anc.id and gm.user_id = p_user))
    );
$$;

create or replace function dataroom.can_folder_row(p_org uuid, p_id uuid, p_parent uuid, p_restricted boolean) returns boolean
language sql stable security definer set search_path = dataroom as $$
  select dataroom.is_admin(p_org)
    or (
      dataroom.is_member(p_org)
      and (not p_restricted
           or exists (select 1 from dataroom.folder_access fa where fa.folder_id = p_id and fa.user_id = auth.uid())
           or exists (select 1 from dataroom.folder_group_access ga join dataroom.group_members gm on gm.group_id = ga.group_id
                      where ga.folder_id = p_id and gm.user_id = auth.uid()))
      and dataroom.can_folder(p_parent)
    );
$$;

-- El grupo de quien pregunta queda fijado en la pregunta.
create or replace function dataroom.set_question_group() returns trigger
language plpgsql security definer set search_path = dataroom as $$
begin
  new.group_id := dataroom.user_group(new.room_id, new.asked_by);
  return new;
end $$;
create or replace trigger trg_question_group before insert on dataroom.questions for each row execute function dataroom.set_question_group();

-- ---------- Politicas (RLS) ----------
alter table dataroom.room_groups enable row level security;
alter table dataroom.group_members enable row level security;
alter table dataroom.group_invites enable row level security;
alter table dataroom.folder_group_access enable row level security;
alter table dataroom.notifications enable row level security;
alter table dataroom.doc_reads enable row level security;

drop policy if exists room_groups_select on dataroom.room_groups;
create policy room_groups_select on dataroom.room_groups for select using (
  dataroom.is_admin(org_id) or exists (select 1 from dataroom.group_members gm where gm.group_id = room_groups.id and gm.user_id = auth.uid()));
drop policy if exists room_groups_admin on dataroom.room_groups;
create policy room_groups_admin on dataroom.room_groups for all using (dataroom.is_admin(org_id)) with check (dataroom.is_admin(org_id));
drop policy if exists group_members_select on dataroom.group_members;
create policy group_members_select on dataroom.group_members for select using (dataroom.is_admin(org_id) or user_id = auth.uid());
drop policy if exists group_members_admin on dataroom.group_members;
create policy group_members_admin on dataroom.group_members for all using (dataroom.is_admin(org_id)) with check (dataroom.is_admin(org_id));
drop policy if exists group_invites_admin on dataroom.group_invites;
create policy group_invites_admin on dataroom.group_invites for all using (dataroom.is_admin(org_id)) with check (dataroom.is_admin(org_id));
drop policy if exists folder_group_access_admin on dataroom.folder_group_access;
create policy folder_group_access_admin on dataroom.folder_group_access for all using (dataroom.is_admin(org_id)) with check (dataroom.is_admin(org_id));
drop policy if exists doc_reads_admin on dataroom.doc_reads;
create policy doc_reads_admin on dataroom.doc_reads for select using (dataroom.is_admin(org_id));

alter policy rooms_select on dataroom.rooms using (dataroom.is_member(org_id) and dataroom.room_visible_for(id, auth.uid()));
alter policy rooms_delete_role on dataroom.rooms using (dataroom.is_admin(org_id));
alter policy rooms_write_role on dataroom.rooms with check (dataroom.can_write(org_id) and not dataroom.is_bidder_user(org_id, auth.uid()));

alter policy folders_select on dataroom.folders using (dataroom.room_open(room_id) and dataroom.can_folder_row(org_id, id, parent_id, restricted));
alter policy folders_insert on dataroom.folders with check (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()) and dataroom.room_open(room_id) and dataroom.can_folder(parent_id));
alter policy folders_update on dataroom.folders
  using (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()) and dataroom.room_open(room_id) and dataroom.can_folder_row(org_id, id, parent_id, restricted))
  with check (dataroom.can_write(org_id) and ((restricted = false) or dataroom.is_admin(org_id)) and dataroom.can_folder(parent_id));
alter policy folders_delete on dataroom.folders using (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()) and dataroom.room_open(room_id) and dataroom.can_folder_row(org_id, id, parent_id, restricted));

alter policy documents_select on dataroom.documents using (dataroom.is_member(org_id) and dataroom.room_open(room_id) and dataroom.can_folder(folder_id));
alter policy documents_insert on dataroom.documents with check (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()) and dataroom.room_open(room_id) and dataroom.can_folder(folder_id));
alter policy documents_update on dataroom.documents
  using (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()) and dataroom.room_open(room_id) and dataroom.can_folder(folder_id))
  with check (dataroom.can_write(org_id) and dataroom.can_folder(folder_id));
alter policy documents_delete on dataroom.documents using (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()) and dataroom.room_open(room_id) and dataroom.can_folder(folder_id));

alter policy chunks_select on dataroom.chunks using (dataroom.is_member(org_id) and dataroom.room_open(room_id)
  and dataroom.can_folder((select d.folder_id from dataroom.documents d where d.id = chunks.document_id)));
alter policy model_reviews_select on dataroom.model_reviews using (dataroom.is_member(org_id) and dataroom.room_open(room_id)
  and dataroom.can_folder((select d.folder_id from dataroom.documents d where d.id = model_reviews.document_id)));

alter policy questions_select on dataroom.questions using (dataroom.is_member(org_id) and dataroom.room_open(room_id)
  and (dataroom.is_seller(room_id, auth.uid()) or visibility = 'all' or group_id = dataroom.user_group(room_id, auth.uid())));
alter policy questions_insert on dataroom.questions with check (dataroom.is_member(org_id) and dataroom.room_open(room_id)
  and asked_by = auth.uid() and status = 'open' and answer is null);
alter policy questions_update on dataroom.questions using (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()))
  with check (dataroom.can_write(org_id) and dataroom.is_seller(room_id, auth.uid()));

alter policy sessions_select on dataroom.chat_sessions using (dataroom.is_member(org_id) and (
  user_id = auth.uid() or dataroom.is_seller(room_id, auth.uid())
  or dataroom.user_group(room_id, user_id) = dataroom.user_group(room_id, auth.uid())));
alter policy sessions_own_write on dataroom.chat_sessions with check (user_id = auth.uid() and dataroom.is_member(org_id) and dataroom.room_open(room_id));
alter policy messages_select on dataroom.messages using (exists (select 1 from dataroom.chat_sessions s where s.id = messages.session_id));

alter policy inv_select on dataroom.invitations using (dataroom.is_admin(org_id));
alter policy memberships_select on dataroom.memberships using (
  user_id = auth.uid() or dataroom.is_admin(org_id) or (dataroom.is_member(org_id) and not dataroom.is_bidder_user(org_id, auth.uid())));

-- ---------- RPC: equipo, postores, invitaciones ----------
-- Un postor solo ve a los owners/admins y a los de su propio grupo; el vendedor ve a todos.
create or replace function public.dataroom_list_members(p_org_id uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql security definer set search_path = dataroom, public as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from dataroom.memberships m join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id and dataroom.is_member(p_org_id)
    and (
      not dataroom.is_bidder_user(p_org_id, auth.uid())
      or m.role in ('owner','admin') or m.user_id = auth.uid()
      or exists (select 1 from dataroom.group_members a join dataroom.group_members b on a.group_id = b.group_id
                 where a.user_id = auth.uid() and b.user_id = m.user_id)
    )
  order by m.created_at;
$$;

create or replace function public.dataroom_accept_invites() returns integer
language plpgsql security definer set search_path = dataroom, public as $$
declare em text; n int := 0; r record;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null then return 0; end if;
  -- Primero los grupos: asi un postor nunca llega a entrar como si fuera del equipo vendedor.
  for r in select * from dataroom.group_invites where lower(email) = lower(em) and accepted_at is null loop
    insert into dataroom.group_members(group_id, room_id, org_id, user_id) values (r.group_id, r.room_id, r.org_id, auth.uid())
      on conflict (room_id, user_id) do update set group_id = excluded.group_id;
    update dataroom.group_invites set accepted_at = now() where id = r.id;
  end loop;
  for r in select * from dataroom.invitations where lower(email) = lower(em) and status = 'pending' loop
    begin
      insert into dataroom.memberships(org_id, user_id, role) values (r.org_id, auth.uid(), r.role) on conflict (org_id, user_id) do nothing;
      update dataroom.invitations set status = 'accepted' where id = r.id;
      n := n + 1;
    exception when others then null;
    end;
  end loop;
  return n;
end $$;

-- Anade a un grupo de postores por email (si aun no tiene cuenta, queda invitado).
create or replace function public.dataroom_add_to_group(p_group uuid, p_email text) returns text
language plpgsql security definer set search_path = dataroom, public as $$
declare g dataroom.room_groups; uid uuid; em text := lower(trim(p_email)); m_role text;
begin
  select * into g from dataroom.room_groups where id = p_group;
  if g.id is null or not dataroom.is_admin(g.org_id) then raise exception 'Solo owner/admin pueden gestionar postores'; end if;
  if em = '' or em !~ '@' then raise exception 'Email no válido'; end if;
  select id into uid from auth.users where lower(email) = em;
  if uid is not null then
    select role into m_role from dataroom.memberships where org_id = g.org_id and user_id = uid;
  end if;
  if m_role in ('owner','admin') then raise exception 'Un owner/admin no puede ser postor'; end if;
  if m_role is not null then
    insert into dataroom.group_members(group_id, room_id, org_id, user_id) values (g.id, g.room_id, g.org_id, uid)
      on conflict (room_id, user_id) do update set group_id = excluded.group_id;
    return 'added';
  end if;
  insert into dataroom.group_invites(group_id, room_id, org_id, email) values (g.id, g.room_id, g.org_id, em)
    on conflict (group_id, email) do nothing;
  insert into dataroom.invitations(org_id, email, role, invited_by) values (g.org_id, em, 'viewer', auth.uid())
    on conflict (org_id, email) do update set status = 'pending', invited_by = auth.uid();
  return 'invited';
end $$;

create or replace function public.dataroom_set_notify(p_org uuid, p_on boolean) returns void
language sql security definer set search_path = dataroom as $$
  update dataroom.memberships set notify = p_on where org_id = p_org and user_id = auth.uid();
$$;

-- Sala tal como la ve el usuario actual (para la interfaz).
create or replace function public.dataroom_my_room_access(p_room uuid)
returns table(role text, visible boolean, is_seller boolean, group_id uuid, group_name text, open boolean, reason text)
language sql stable security definer set search_path = dataroom as $$
  select * from dataroom.room_access(p_room, auth.uid());
$$;

-- ---------- RPC: lectura por documento ----------
create or replace function public.dataroom_track_read(p_document uuid, p_seconds int) returns void
language plpgsql security definer set search_path = dataroom as $$
declare d dataroom.documents; s int := greatest(0, least(coalesce(p_seconds, 0), 90));
begin
  select * into d from dataroom.documents where id = p_document;
  if d.id is null or not dataroom.is_member(d.org_id) or not dataroom.room_open(d.room_id) or not dataroom.can_folder(d.folder_id) then return; end if;
  insert into dataroom.doc_reads(document_id, user_id, room_id, org_id, seconds, views)
  values (d.id, auth.uid(), d.room_id, d.org_id, s, case when s = 0 then 1 else 0 end)
  on conflict (document_id, user_id, day) do update
    set seconds = doc_reads.seconds + excluded.seconds, views = doc_reads.views + excluded.views, last_at = now();
end $$;

-- ---------- RPC: informe por postor (solo owner/admin) ----------
create or replace function public.dataroom_bidder_report(p_room uuid)
returns table(group_id uuid, group_name text, expires_at timestamptz, members int, docs_viewed int, total_seconds int,
              views int, downloads int, qa_questions int, chat_questions int, last_activity timestamptz)
language sql stable security definer set search_path = dataroom, public as $$
  select g.id, g.name, g.expires_at,
    (select count(*)::int from dataroom.group_members gm where gm.group_id = g.id),
    (select count(distinct r.document_id)::int from dataroom.doc_reads r join dataroom.group_members gm on gm.user_id = r.user_id and gm.group_id = g.id where r.room_id = p_room),
    (select coalesce(sum(r.seconds), 0)::int from dataroom.doc_reads r join dataroom.group_members gm on gm.user_id = r.user_id and gm.group_id = g.id where r.room_id = p_room),
    (select coalesce(sum(r.views), 0)::int from dataroom.doc_reads r join dataroom.group_members gm on gm.user_id = r.user_id and gm.group_id = g.id where r.room_id = p_room),
    (select count(*)::int from dataroom.audit_log a join dataroom.group_members gm on gm.user_id = a.actor and gm.group_id = g.id where a.room_id = p_room and a.action = 'document_download'),
    (select count(*)::int from dataroom.questions q where q.room_id = p_room and q.group_id = g.id),
    (select count(*)::int from dataroom.messages m join dataroom.chat_sessions s on s.id = m.session_id join dataroom.group_members gm on gm.user_id = s.user_id and gm.group_id = g.id where s.room_id = p_room and m.role = 'user'),
    (select max(a.created_at) from dataroom.audit_log a join dataroom.group_members gm on gm.user_id = a.actor and gm.group_id = g.id where a.room_id = p_room)
  from dataroom.room_groups g
  where g.room_id = p_room and dataroom.is_admin(g.org_id)
  order by g.name;
$$;

create or replace function public.dataroom_doc_engagement(p_room uuid)
returns table(document_id uuid, group_id uuid, seconds int, views int, readers int)
language sql stable security definer set search_path = dataroom, public as $$
  select r.document_id, gm.group_id, sum(r.seconds)::int, sum(r.views)::int, count(distinct r.user_id)::int
  from dataroom.doc_reads r
  join dataroom.group_members gm on gm.user_id = r.user_id and gm.room_id = r.room_id
  join dataroom.rooms rm on rm.id = r.room_id
  where r.room_id = p_room and dataroom.is_admin(rm.org_id)
  group by r.document_id, gm.group_id;
$$;

-- ---------- RPC de servidor (service role) ----------
-- Destinatarios de un aviso: miembros con avisos activados que pueden ver esa carpeta de la sala.
create or replace function public.dataroom_room_audience(p_room uuid, p_folder uuid, p_group uuid default null, p_sellers_only boolean default false)
returns table(user_id uuid, email text)
language sql stable security definer set search_path = dataroom, public as $$
  select m.user_id, u.email::text
  from dataroom.rooms r
  join dataroom.memberships m on m.org_id = r.org_id and m.notify
  join auth.users u on u.id = m.user_id
  where r.id = p_room
    and dataroom.room_open_for(p_room, m.user_id)
    and dataroom.user_can_folder(m.user_id, p_folder)
    and (not p_sellers_only or dataroom.is_seller(p_room, m.user_id))
    and (p_group is null or dataroom.is_seller(p_room, m.user_id) or dataroom.user_group(p_room, m.user_id) = p_group);
$$;

-- Preguntas del chat que ve el usuario: las de su grupo si es postor, todas si es vendedor.
create or replace function public.dataroom_room_questions(p_room_id uuid)
returns table(message_id uuid, session_id uuid, user_id uuid, email text, content text, created_at timestamptz)
language sql stable security definer set search_path = dataroom, public as $$
  select m.id, s.id, s.user_id, u.email::text, m.content, m.created_at
  from dataroom.messages m
  join dataroom.chat_sessions s on s.id = m.session_id
  join auth.users u on u.id = s.user_id
  where s.room_id = p_room_id and m.role = 'user' and dataroom.room_open(p_room_id)
    and (dataroom.is_seller(p_room_id, auth.uid()) or s.user_id = auth.uid()
         or dataroom.user_group(p_room_id, s.user_id) = dataroom.user_group(p_room_id, auth.uid()))
  order by m.created_at desc
  limit 1000;
$$;

-- Busqueda y catalogo: sala abierta para el usuario y solo la version vigente de cada documento.
create or replace function public.search_dataroom_chunks(
  p_room_id uuid, p_user_id uuid, query_embedding vector, p_model text, p_keywords text, match_count int default 12)
returns table(id uuid, document_id uuid, document_name text, idx int, page int, content text, score float8, similarity float8)
language sql stable security definer set search_path = dataroom, public as $$
  with allowed as (
    select d.id, d.name from dataroom.documents d
    where d.room_id = p_room_id and d.superseded_by is null
      and dataroom.room_open_for(p_room_id, p_user_id)
      and dataroom.user_can_folder(p_user_id, d.folder_id)
  ),
  vec as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as r, 1 - (c.embedding <=> query_embedding) as sim
    from dataroom.chunks c join allowed a on a.id = c.document_id
    where c.room_id = p_room_id and c.embedding is not null and c.embed_model = p_model
    order by c.embedding <=> query_embedding
    limit match_count * 2
  ),
  kw as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q) desc) as r
    from dataroom.chunks c join allowed a on a.id = c.document_id,
         websearch_to_tsquery('simple', coalesce(p_keywords, '')) q
    where c.room_id = p_room_id and coalesce(p_keywords, '') <> '' and c.fts @@ q
    order by ts_rank_cd(c.fts, q) desc
    limit match_count * 2
  ),
  fused as (
    select u.id, sum(1.0 / (60 + u.r)) as score, max(u.sim) as sim
    from (select id, r, sim from vec union all select id, r, null::float8 from kw) u
    group by u.id
  )
  select c.id, c.document_id, a.name, c.idx, c.page, c.content, f.score::float8, f.sim::float8
  from fused f join dataroom.chunks c on c.id = f.id join allowed a on a.id = c.document_id
  order by f.score desc
  limit match_count;
$$;

create or replace function public.dataroom_visible_docs(p_room_id uuid, p_user_id uuid)
returns table(id uuid, name text, pages int, status text, folder_id uuid)
language sql stable security definer set search_path = dataroom, public as $$
  select d.id, d.name, d.pages, d.status, d.folder_id from dataroom.documents d
  where d.room_id = p_room_id and d.superseded_by is null
    and dataroom.room_open_for(p_room_id, p_user_id)
    and dataroom.user_can_folder(p_user_id, d.folder_id)
  order by d.name;
$$;

create or replace function public.dataroom_room_access(p_room uuid, p_user uuid)
returns table(role text, visible boolean, is_seller boolean, group_id uuid, group_name text, open boolean, reason text)
language sql stable security definer set search_path = dataroom as $$
  select * from dataroom.room_access(p_room, p_user);
$$;

-- ---------- Permisos de ejecucion ----------
revoke execute on function public.dataroom_room_audience(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.dataroom_room_audience(uuid, uuid, uuid, boolean) to service_role;
revoke execute on function public.dataroom_room_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dataroom_room_access(uuid, uuid) to service_role;
revoke execute on function public.search_dataroom_chunks(uuid, uuid, vector, text, text, int) from public, anon, authenticated;
grant execute on function public.search_dataroom_chunks(uuid, uuid, vector, text, text, int) to service_role;
revoke execute on function public.dataroom_visible_docs(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dataroom_visible_docs(uuid, uuid) to service_role;
revoke execute on function public.dataroom_add_to_group(uuid, text) from public, anon;
revoke execute on function public.dataroom_set_notify(uuid, boolean) from public, anon;
revoke execute on function public.dataroom_my_room_access(uuid) from public, anon;
revoke execute on function public.dataroom_track_read(uuid, int) from public, anon;
revoke execute on function public.dataroom_bidder_report(uuid) from public, anon;
revoke execute on function public.dataroom_doc_engagement(uuid) from public, anon;
revoke execute on function public.dataroom_room_questions(uuid) from public, anon;
grant execute on function public.dataroom_add_to_group(uuid, text), public.dataroom_set_notify(uuid, boolean),
  public.dataroom_my_room_access(uuid), public.dataroom_track_read(uuid, int), public.dataroom_bidder_report(uuid),
  public.dataroom_doc_engagement(uuid), public.dataroom_room_questions(uuid) to authenticated;
grant select, insert, update, delete on dataroom.room_groups, dataroom.group_members, dataroom.group_invites,
  dataroom.folder_group_access, dataroom.doc_reads to authenticated;
grant all on dataroom.room_groups, dataroom.group_members, dataroom.group_invites, dataroom.folder_group_access,
  dataroom.notifications, dataroom.doc_reads to service_role;

-- ===================== v4 (2026-10-28 tarde): equipos, Q&A dirigido, chat privado, fin de operacion =====================
-- Aplicado en produccion como dataroom_v4_columns_helpers, dataroom_v4_policies, dataroom_v4_rpcs y
-- dataroom_v4_add_to_team_member_role (ver historial de migraciones de Supabase). Resumen:
--   * questions.to_group_id (null = equipo organizador); el Q&A lo ven el equipo que pregunta, el destinatario y los admins.
--   * chat_sessions: visibles solo dentro del mismo equipo (tambien para admins).
--   * Todos los equipos (rol member) suben documentos y crean carpetas; editar/borrar: admin o autor.
--   * rooms.retention_days / purge_at / purge_warned: operacion terminada = solo lectura hasta purge_at;
--     el cron avisa 7 y 1 dia antes y borra Storage + sala al llegar la fecha.
--   * room_groups visibles (solo el nombre) para cualquiera de la sala.
