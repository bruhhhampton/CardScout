-- CardScout: one click prepares the AI draft and the verdict; a person confirms it (29 Oct 2026).
-- Older assessments were submitted by a person, so they count as confirmed.
alter table public.assessments
  add column if not exists prepared_by text not null default 'staff' check (prepared_by in ('staff', 'cardscout')),
  add column if not exists confirmed boolean not null default true,
  add column if not exists confirmed_at timestamptz;
