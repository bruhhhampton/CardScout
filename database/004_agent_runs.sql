-- Run ONCE, after 003. Stores each AI draft run with its full trace.
create table public.agent_runs (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 offer_id uuid not null references public.card_offers(id) on delete cascade,
 status text not null check (status in ('completed','failed')),
 model text not null,
 staff_notes text not null default '' check (length(staff_notes) <= 4000),
 draft jsonb,              -- scores with reasons and sources, questions for staff
 sales jsonb not null default '[]',   -- every sale the agent recorded, with accepted/rejected and why
 sales_count integer,      -- counted by the server, not the AI
 median_sold_aud numeric(10,2),       -- calculated by the server, not the AI
 trace jsonb not null default '[]',   -- every search and tool call, in order
 searches integer not null default 0,
 input_tokens integer not null default 0,
 output_tokens integer not null default 0,
 error text
);
alter table public.agent_runs enable row level security;

alter table public.assessments add column agent_run_id uuid references public.agent_runs(id);
