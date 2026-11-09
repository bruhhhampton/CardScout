-- CardScout: the owner's decisions (9 Nov 2026). Run once in the Supabase SQL editor.
-- When the owner decides a card (Buy, Don't buy or Offer $X, with a reason), it is saved
-- next to what CardScout suggested. Similar past decisions are shown on new cards and
-- given to the AI as context. Nothing is bought: this only records what the owner said.
create table if not exists public.owner_decisions (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 offer_id uuid not null references public.card_offers(id) on delete cascade,
 assessment_id uuid references public.assessments(id) on delete set null,
 decision text not null check (decision in ('buy', 'dont_buy', 'offer')),
 offer_aud numeric(10,2) check (offer_aud > 0 and offer_aud <= 1000000),
 reason text not null default '' check (length(reason) <= 300),
 suggested text check (suggested in ('eligible', 'decline', 'counteroffer', 'owner_review')),
 -- A copy of the card, so past decisions can be matched to new cards.
 player text not null default '',
 year integer,
 set_name text not null default '',
 variant text not null default '',
 asking_price_aud numeric(10,2),
 check ((decision = 'offer') = (offer_aud is not null))
);
alter table public.owner_decisions enable row level security;
create index if not exists owner_decisions_offer_idx on public.owner_decisions (offer_id, created_at desc);

-- The latest decision, shown on the offer lists.
alter table public.card_offers add column if not exists owner_decision text
 check (owner_decision in ('buy', 'dont_buy', 'offer'));

notify pgrst, 'reload schema';
