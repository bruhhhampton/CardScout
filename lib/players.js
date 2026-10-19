import 'server-only';
import { getSupabase } from './supabase-server';

// FM26 ratings shown next to an offer. Context only: never price evidence.
export const ATTRIBUTE_GROUPS = [
  { label: 'Technical', keys: ['dribbling', 'first_touch', 'technique', 'passing', 'finishing'] },
  { label: 'Mental', keys: ['decisions', 'vision', 'flair', 'anticipation', 'off_the_ball', 'composure'] },
  { label: 'Physical', keys: ['acceleration', 'pace', 'agility', 'balance'] },
];

export const ATTRIBUTE_LABELS = {
  dribbling: 'Dribbling', first_touch: 'First touch', technique: 'Technique', passing: 'Passing',
  finishing: 'Finishing', decisions: 'Decisions', vision: 'Vision', flair: 'Flair',
  anticipation: 'Anticipation', off_the_ball: 'Off the ball', composure: 'Composure',
  acceleration: 'Acceleration', pace: 'Pace', agility: 'Agility', balance: 'Balance',
};

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
  const { data, error } = await supabase.from('players').select(COLUMNS).eq('player_id', playerId).maybeSingle();
  if (error) {
    console.error('getPlayer failed:', error);
    return { player: null, error: 'Could not load the linked player.' };
  }
  return { player: data, error: null };
}
