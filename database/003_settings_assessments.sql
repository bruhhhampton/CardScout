-- Run ONCE, after 001 and 002. Owner settings (one row) and saved assessments.
-- Default values are PROVISIONAL: CERF weights and thresholds from Cerf's model,
-- shop limits are placeholders until Cerf confirms them.

create table public.shop_settings (
 id integer primary key default 1 check (id = 1),
 shop_name text not null default 'Cerf''s card shop' check (length(trim(shop_name)) between 1 and 80),
 staff_limit_aud numeric(10,2) not null default 150 check (staff_limit_aud between 0 and 1000000),
 max_copies integer not null default 2 check (max_copies between 1 and 1000),
 excluded_sets text not null default 'Topps Chrome' check (length(excluded_sets) <= 500),
 offer_fraction numeric(4,3) not null default 0.80 check (offer_fraction > 0 and offer_fraction <= 1),
 min_margin numeric(4,3) not null default 0.25 check (min_margin >= 0 and min_margin < 1),
 selling_costs_aud numeric(10,2) not null default 0 check (selling_costs_aud between 0 and 1000000),
 min_sales integer not null default 3 check (min_sales between 1 and 50),
 sales_window_days integer not null default 30 check (sales_window_days between 1 and 365),
 w_football integer not null default 35 check (w_football between 0 and 100),
 w_career integer not null default 20 check (w_career between 0 and 100),
 w_collector integer not null default 20 check (w_collector between 0 and 100),
 w_card integer not null default 10 check (w_card between 0 and 100),
 w_valuation integer not null default 15 check (w_valuation between 0 and 100),
 reject_football_below integer not null default 60 check (reject_football_below between 0 and 100),
 speculative_football_below integer not null default 65 check (speculative_football_below between 0 and 100),
 speculative_career_below integer not null default 50 check (speculative_career_below between 0 and 100),
 expensive_valuation_below integer not null default 40 check (expensive_valuation_below between 0 and 100),
 attractive_total_min integer not null default 75 check (attractive_total_min between 0 and 100),
 attractive_valuation_min integer not null default 60 check (attractive_valuation_min between 0 and 100),
 provisional boolean not null default true,
 updated_at timestamptz not null default now(),
 check (w_football + w_career + w_collector + w_card + w_valuation = 100)
);
alter table public.shop_settings enable row level security;
insert into public.shop_settings (id) values (1);

create table public.assessments (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 offer_id uuid not null references public.card_offers(id) on delete cascade,
 stock_count integer not null check (stock_count between 0 and 1000),
 condition text not null check (condition in ('acceptable','not_acceptable','unsure')),
 sales_count integer not null check (sales_count between 0 and 1000),
 median_sold_aud numeric(10,2) check (median_sold_aud between 0 and 1000000),
 evidence_source text not null default '' check (length(evidence_source) <= 500),
 score_football smallint not null check (score_football between 0 and 100),
 score_career smallint not null check (score_career between 0 and 100),
 score_collector smallint not null check (score_collector between 0 and 100),
 score_card smallint not null check (score_card between 0 and 100),
 score_valuation smallint not null check (score_valuation between 0 and 100),
 cerf_total numeric(5,1),
 cerf_category text,
 offer_ceiling_aud numeric(10,2),
 outcome text not null check (outcome in ('eligible','decline','counteroffer','owner_review')),
 reasons jsonb not null default '[]',
 settings_snapshot jsonb not null
);
alter table public.assessments enable row level security;

-- Latest outcome shown on the offer list.
alter table public.card_offers add column last_outcome text
 check (last_outcome in ('eligible','decline','counteroffer','owner_review'));
