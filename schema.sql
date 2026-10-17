-- AFTERHOURS starter schema.
-- IMPORTANT: This is a development schema, not a production-secure multiplayer API.
-- Before a public launch, move privileged game actions and role/word access into
-- Supabase Edge Functions or SECURITY DEFINER RPCs, then tighten RLS policies.
create extension if not exists pgcrypto;

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  phase text not null default 'lobby' check (phase in ('lobby','reveal','clues','voting','results','closed')),
  max_players integer not null default 6 check (max_players between 3 and 100),
  imposter_count integer not null default 1 check (imposter_count >= 1),
  selected_categories text[] not null default '{}',
  image_mode boolean not null default true,
  discussion_seconds integer not null default 60,
  round_number integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(room_id, display_name)
);

create index if not exists game_players_room_idx on public.game_players(room_id);
create index if not exists game_rooms_code_idx on public.game_rooms(room_code);

alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;

-- These policies make the starter easy to test from GitHub Pages.
-- They DO NOT provide secret-role privacy or host authorization.
-- Do not deploy publicly with these policies until secure RPC/Edge Functions replace them.
create policy "dev rooms read" on public.game_rooms for select to anon, authenticated using (true);
create policy "dev rooms create" on public.game_rooms for insert to anon, authenticated with check (true);
create policy "dev rooms update" on public.game_rooms for update to anon, authenticated using (true) with check (true);
create policy "dev players read" on public.game_players for select to anon, authenticated using (true);
create policy "dev players join" on public.game_players for insert to anon, authenticated with check (true);
create policy "dev players remove" on public.game_players for delete to anon, authenticated using (true);

alter publication supabase_realtime add table public.game_rooms;
alter publication supabase_realtime add table public.game_players;