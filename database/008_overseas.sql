-- CardScout: owner-controlled overseas sales (29 Oct 2026).
-- Off by default. When on, overseas sales are converted with the owner's own rates and
-- multiplied by the owner's adjustment (for shipping, GST and so on).
alter table public.shop_settings
  add column if not exists count_overseas boolean not null default false,
  add column if not exists overseas_adjust numeric(4,3) not null default 1 check (overseas_adjust > 0 and overseas_adjust <= 1),
  add column if not exists fx_usd_aud numeric(8,4) check (fx_usd_aud > 0),
  add column if not exists fx_gbp_aud numeric(8,4) check (fx_gbp_aud > 0),
  add column if not exists fx_eur_aud numeric(8,4) check (fx_eur_aud > 0);
