-- CardScout: defending ratings for Find players (9 Nov 2026).
-- From Luka's full Football Manager 26 community file (github.com/vfxper/fm26, downloaded 15 Oct 2026,
-- UNVERIFIED_COMMUNITY). Used only to shortlist players, never to value a card or decide a buy.
-- There are no goalkeeping ratings (handling, reflexes) in the file.

-- STEP 1: run this, then import players_defending.csv into the new players_defending_import table.
alter table public.players
  add column if not exists tackling smallint, add column if not exists marking smallint,
  add column if not exists heading smallint, add column if not exists positioning smallint,
  add column if not exists jumping smallint, add column if not exists strength smallint,
  add column if not exists stamina smallint, add column if not exists work_rate smallint,
  add column if not exists crossing smallint, add column if not exists concentration smallint;
create table if not exists public.players_defending_import (
  player_id text primary key, tackling smallint, marking smallint, heading smallint, positioning smallint,
  jumping smallint, strength smallint, stamina smallint, work_rate smallint, crossing smallint, concentration smallint
);

-- STEP 2 (after the import): copy the ratings across, check, then remove the import table.
-- update public.players p set tackling = i.tackling, marking = i.marking, heading = i.heading,
--   positioning = i.positioning, jumping = i.jumping, strength = i.strength, stamina = i.stamina,
--   work_rate = i.work_rate, crossing = i.crossing, concentration = i.concentration
-- from public.players_defending_import i where p.player_id = i.player_id;
-- select count(*) as players_with_defending from public.players where tackling is not null;
-- drop table public.players_defending_import;
-- notify pgrst, 'reload schema';
