import 'server-only';
import { getSupabase } from './supabase-server';

// FM26 ratings shown next to an offer. Context only: never price evidence.
export const ATTRIBUTE_GROUPS = [
  { label: 'Technical', keys: ['dribbling', 'first_touch', 'technique', 'passing', 'finishing'] },
  { label: 'Mental', keys: ['decisions', 'vision', 'flair', 'anticipation', 'off_the_ball', 'composure'] },
  { label: 'Physical', keys: ['acceleration', 'pace', 'agility', 'balance'] },
];
// Added 9 Nov 2026 from Luka's full file (database/015). Shown only once they are in the database.
export const DEFENDING_GROUP = { label: 'Defending', keys: ['tackling', 'marking', 'heading', 'positioning', 'jumping', 'strength', 'stamina', 'work_rate', 'crossing', 'concentration'] };

export const ATTRIBUTE_LABELS = {
  dribbling: 'Dribbling', first_touch: 'First touch', technique: 'Technique', passing: 'Passing',
  finishing: 'Finishing', decisions: 'Decisions', vision: 'Vision', flair: 'Flair',
  anticipation: 'Anticipation', off_the_ball: 'Off the ball', composure: 'Composure',
  acceleration: 'Acceleration', pace: 'Pace', agility: 'Agility', balance: 'Balance',
  tackling: 'Tackling', marking: 'Marking', heading: 'Heading', positioning: 'Positioning', jumping: 'Jumping reach',
  strength: 'Strength', stamina: 'Stamina', work_rate: 'Work rate', crossing: 'Crossing', concentration: 'Concentration',
};
const DEFENDING_COLUMNS = DEFENDING_GROUP.keys.join(', ');
const missingColumn = (error) => /column|tackling|heading|marking/i.test(`${error?.message} ${error?.details ?? ''}`);

const COLUMNS =
  'player_id, name, position, nationality, club_snapshot, age_snapshot, data_status, source, ' +
  ATTRIBUTE_GROUPS.flatMap((g) => g.keys).join(', ');

export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

// Escape characters that have special meaning in a SQL LIKE pattern.
function likeEscape(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Returns { players, error }. Search is by name, case-insensitive, up to 10 results.
export async function searchPlayers(query) {
  const q = (query ?? '').trim().slice(0, 60);
  if (q.length < 2) return { players: [], error: null };
  const supabase = getSupabase();
  if (!supabase) return { players: [], error: 'The server is not connected to the database.' };
  const { data, error } = await supabase
    .from('players')
    .select('player_id, name, position, club_snapshot, age_snapshot')
    .ilike('name', `%${likeEscape(q)}%`)
    .order('name')
    .limit(10);
  if (error) {
    console.error('searchPlayers failed:', error);
    return { players: [], error: 'Could not search players. Check the server terminal for details.' };
  }
  return { players: data ?? [], error: null };
}

export async function getPlayer(playerId) {
  if (!PLAYER_ID_PATTERN.test(playerId ?? '')) return { player: null, error: null };
  const supabase = getSupabase();
  if (!supabase) return { player: null, error: 'The server is not connected to the database.' };
  let { data, error } = await supabase.from('players').select(`${COLUMNS}, ${DEFENDING_COLUMNS}`).eq('player_id', playerId).maybeSingle();
  // Before database/015 is run, read the attacking ratings only.
  if (error && missingColumn(error)) ({ data, error } = await supabase.from('players').select(COLUMNS).eq('player_id', playerId).maybeSingle());
  if (error) {
    console.error('getPlayer failed:', error);
    return { player: null, error: 'Could not load the linked player.' };
  }
  return { player: data, error: null };
}

const plain = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Returns the one FM player whose name exactly matches the card's player, or null if there is
// none or more than one (then staff pick from the list as before).
export async function findExactPlayer(name) {
  const { players } = await searchPlayers(name);
  const same = (players ?? []).filter((p) => plain(p.name) === plain(name));
  return same.length === 1 ? same[0] : null;
}

const FIND_COLUMNS = 'player_id, name, position, nationality, club_snapshot, age_snapshot, pace, acceleration, finishing, dribbling';
const FIND_DEFENDING = 'tackling, heading, marking';

// Find players by position, age, ratings, nationality and club. Up to 30, best first.
// Returns { players, error }. Game ratings are for finding candidates only.
export async function findPlayers(f) {
  const supabase = getSupabase();
  if (!supabase) return { players: [], error: 'The server is not connected to the database.' };
  const { POSITIONS } = await import('./find-players.mjs');
  const usesDefending = f.minTackling || f.minHeading || ['tackling', 'heading', 'marking'].includes(f.sort);
  const run = (cols) => build(supabase.from('players').select(cols), f, POSITIONS);
  let { data, error } = await run(`${FIND_COLUMNS}, ${FIND_DEFENDING}`);
  if (error && missingColumn(error)) {
    if (usesDefending) return { players: [], error: 'Defending ratings are not loaded yet. Run database/015 in Supabase first.' };
    ({ data, error } = await run(FIND_COLUMNS));
  }
  if (error) {
    console.error('findPlayers failed:', error);
    return { players: [], error: 'Could not search players. Try fewer filters.' };
  }
  return { players: data ?? [], error: null };
}

function build(q, f, POSITIONS) {
  if (f.position) q = q.filter('position', 'imatch', POSITIONS[f.position].re);
  if (f.maxAge) q = q.lte('age_snapshot', f.maxAge);
  if (f.minPace) q = q.gte('pace', f.minPace);
  if (f.minFinishing) q = q.gte('finishing', f.minFinishing);
  if (f.minTackling) q = q.gte('tackling', f.minTackling);
  if (f.minHeading) q = q.gte('heading', f.minHeading);
  if (f.nationality) q = q.ilike('nationality', `%${likeEscape(f.nationality)}%`);
  if (f.club) q = q.ilike('club_snapshot', `%${likeEscape(f.club)}%`);
  q = f.sort === 'age_snapshot'
    ? q.order('age_snapshot', { ascending: true }).order('pace', { ascending: false })
    : q.order(f.sort, { ascending: false }).order('age_snapshot', { ascending: true });
  return q.limit(30);
}
