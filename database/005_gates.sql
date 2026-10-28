-- CardScout: Cerf's two gates from his CERF model (28 Oct 2026).
-- Adds the staff answers to each assessment. Older assessments keep these empty.
alter table public.assessments
  add column if not exists rookie_card text check (rookie_card in ('yes', 'no', 'unsure')),
  add column if not exists first_team text check (first_team in ('yes', 'no', 'unsure'));
