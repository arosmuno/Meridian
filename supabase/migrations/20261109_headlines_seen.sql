-- Titulares que el editor LLM ya ha evaluado (elegidos o no). El cron los aparta 7 dias
-- para que cada pasada mire titulares nuevos en vez de reenviar los de mas peso.
create table if not exists public.headlines_seen (
  link text primary key,
  seen_at timestamptz not null default now()
);
create index if not exists headlines_seen_seen_at_idx on public.headlines_seen (seen_at);
alter table public.headlines_seen enable row level security;
