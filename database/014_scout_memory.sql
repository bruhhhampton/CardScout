-- CardScout: the scout's memory (9 Nov 2026). Run once in the Supabase SQL editor.
-- Players the owner marked "Not for us". The scout never suggests them again.
-- (Its search history is already kept in scout_runs.trace.)
create table if not exists public.scout_skips (
 player_id text primary key,
 name text not null default '',
 created_at timestamptz not null default now()
);
alter table public.scout_skips enable row level security;
notify pgrst, 'reload schema';
