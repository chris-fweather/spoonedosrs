/** A quest's facts for its hover card, from the OSRS Wiki quest pages saved in lib/quest-reference.json: difficulty and
 * length, where it starts, and the skills and quests it needs. */
import questReference from './quest-reference.json' with {type: 'json'};

type Ref = {difficulty?: string; length?: string; start?: string; skills?: {skill: string; level: number; boostable?: boolean}[]; quests?: string[]};
const QUESTS = questReference.quests as Record<string, Ref>;
const BY_NAME = new Map(Object.keys(QUESTS).map(name => [name.toLowerCase(), name]));
const DIFFICULTIES = ['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster'];

export type QuestInfo = {name: string; difficulty: string | null; icon: string; length: string | null; start: string | null; skills: {skill: string; level: number}[]; quests: string[]};
/** The quest by name (any case), or null when we have no page for it. */
export function questInfo(raw: string): QuestInfo | null {
  const name = BY_NAME.get(raw.trim().toLowerCase());
  if (!name) return null;
  const q = QUESTS[name], difficulty = q.difficulty && DIFFICULTIES.includes(q.difficulty) ? q.difficulty : null;
  return {
    name, difficulty, icon: difficulty ? `/icons/tiers/${difficulty.toLowerCase()}.png` : '/ui/quest-point-icon.png',
    length: q.length?.trim() || null, start: q.start?.trim() || null,
    skills: (q.skills ?? []).map(s => ({skill: s.skill, level: s.level})), quests: q.quests ?? [],
  };
}
