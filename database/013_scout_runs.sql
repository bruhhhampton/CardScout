-- CardScout: "Scout for me" (9 Nov 2026). Run once in the Supabase SQL editor.
-- Each scout run: the agent's picks (players worth watching, with sources and a card), and every step it took.
create table if not exists public.scout_runs (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 status text not null check (status in ('running', 'completed', 'failed')),
 model text not null,
 picks jsonb not null default '[]',
 summary text not null default '' check (length(summary) <= 600),
 trace jsonb not null default '[]',
 searches integer not null default 0,
 input_tokens integer not null default 0,
 output_tokens integer not null default 0,
 error text
);
alter table public.scout_runs enable row level security;
notify pgrst, 'reload schema';
