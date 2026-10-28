-- CardScout: Cerf's FM role fit as 20% of football quality (29 Oct 2026).
-- score_football now holds the combined football quality; these keep its two parts.
alter table public.assessments
  add column if not exists football_real smallint check (football_real between 0 and 100),
  add column if not exists fm_fit numeric(5,2) check (fm_fit between 0 and 100),
  add column if not exists fm_role text;
