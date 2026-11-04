-- CardScout: the owner can switch off "only buy recognised rookie cards" (29 Oct 2026).
-- On by default, which is Cerf's rule from cerf.py. When off, a card that is not a rookie card
-- is judged on its CERF scores and price instead of being declined.
alter table public.shop_settings
  add column if not exists rookie_only boolean not null default true;
