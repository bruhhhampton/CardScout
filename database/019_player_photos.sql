-- CardScout: player photos (12 Nov 2026). Run once in the Supabase SQL editor.
-- When someone opens a player page, CardScout looks the player up once on API-Football.
-- A photo is kept only when exactly one profile has the same name, nationality and age
-- (within a year). The result is saved here so the same player is never looked up twice
-- (players with no certain match are checked again after 30 days).
-- Photos sit in a private storage bucket: only the CardScout server can read them.
create table if not exists public.player_photos (
  player_id text primary key,
  status text not null check (status in ('found', 'none', 'unsure', 'placeholder')),
  api_player_id integer,
  api_name text,
  photo_path text,
  photo_hash text,
  checked_at timestamptz not null default now()
);
create index if not exists player_photos_hash on public.player_photos (photo_hash);
alter table public.player_photos enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', false, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
