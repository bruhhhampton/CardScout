-- CardScout: rules from the shop visit with Cerf (7 Nov 2026). Run once in the Supabase SQL editor.
-- Cerf chooses for each rule: allow (ignore), ask (the card comes to him) or decline.
-- All start on 'ask', so nothing is declined until he chooses in Owner settings.
-- The price ($300) and sales a year (10) levels are placeholders until he confirms them.
alter table public.shop_settings
  add column if not exists base_rule text not null default 'ask' check (base_rule in ('allow','ask','decline')),
  add column if not exists maker_rule text not null default 'ask' check (maker_rule in ('allow','ask','decline')),
  add column if not exists allowed_brands text not null default 'Panini, Topps, Upper Deck' check (char_length(allowed_brands) <= 200),
  add column if not exists price_rule text not null default 'ask' check (price_rule in ('allow','ask','decline')),
  add column if not exists max_price_aud numeric(10,2) not null default 300 check (max_price_aud between 0 and 1000000),
  add column if not exists slow_rule text not null default 'ask' check (slow_rule in ('allow','ask','decline')),
  add column if not exists min_sales_per_year integer not null default 10 check (min_sales_per_year between 0 and 100000),
  add column if not exists defect_rule text not null default 'ask' check (defect_rule in ('allow','ask','decline'));

-- New condition answer staff can give: "has a defect".
alter table public.assessments drop constraint if exists assessments_condition_check;
alter table public.assessments add constraint assessments_condition_check
  check (condition in ('acceptable','not_acceptable','defect','unsure'));
