-- CardScout: a person can choose a player's photo (12 Nov 2026). Run once in the Supabase SQL editor.
-- When the automatic match finds nobody, or the wrong player, staff pick the right profile from a short
-- list (or "None of these"). Their choice is marked here and the automatic search never overwrites it.
alter table public.player_photos add column if not exists chosen_by_person boolean not null default false;

notify pgrst, 'reload schema';
