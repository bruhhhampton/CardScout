-- CardScout: SportsCardsPro price guide (5 Nov 2026).
-- Saves the price guide result with each AI run, and lets the owner decide whether the
-- price guide may stand in for sold sales on cheaper cards (off by default).
alter table public.agent_runs add column if not exists price_guide jsonb;
alter table public.shop_settings
  add column if not exists price_guide_as_evidence boolean not null default false,
  add column if not exists price_guide_limit_aud numeric(10,2) not null default 50 check (price_guide_limit_aud between 0 and 1000000);
