-- CardScout: rules learned from the owner's decisions (9 Nov 2026). Run once, after 016.
-- learn: the owner wants CardScout to do the same next time for the same card
--        (same player, year, set and version). On by default.
-- forgotten_at: the owner removed it in Settings, so it no longer applies.
-- rules_hit: which of the owner's rules flagged the card when he decided, so CardScout can
--            tell him when he keeps going against the same rule.
alter table public.owner_decisions
  add column if not exists learn boolean not null default true,
  add column if not exists forgotten_at timestamptz,
  add column if not exists rules_hit text[] not null default '{}';
-- Which learned decision changed a verdict, if any.
alter table public.assessments
  add column if not exists learned_from uuid references public.owner_decisions(id) on delete set null;
notify pgrst, 'reload schema';
