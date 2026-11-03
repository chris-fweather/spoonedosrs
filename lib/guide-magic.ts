/** Prayers and spells for their hover cards in guides: the level each needs, what it does in one line, what unlocks it
 * (a quest, a spellbook, a prayer scroll, a minigame) and, for spells, the runes one cast takes. The values come from
 * the OSRS Wiki (lib/guide-magic.json notes how). Teleport spells with a landing spot keep their travel card
 * (lib/guide-travel); every other prayer and spell a guide can name (lib/guide-references) is described here. */
import data from './guide-magic.json';
import {guideItemImage,guideItems} from './guides';

export type Spellbook = 'standard' | 'ancient' | 'lunar' | 'arceuus';
type Entry = {level: number; effect: string; book?: string; runes?: (string | number)[][]; skills?: (string | number)[][]; quests?: string[]; items?: string[]; unlock?: string};
export type GuideMagic = {
  kind: 'prayer' | 'spell';
  name: string;
  level: number;
  /** What it does, in one short line. */
  effect: string;
  book?: Spellbook;
  /** One cast's runes: [item id, amount]. */
  runes?: [string, number][];
  /** Other skill levels it needs: [skill, level]. */
  skills?: [string, number][];
  quests?: string[];
  /** Items it needs: a prayer scroll to read, a staff to cast with. */
  items?: string[];
  /** Anything else that unlocks it (a minigame, a training ground). */
  unlock?: string;
};

const PRAYERS = data.prayers as Record<string, Entry>, SPELLS = data.spells as Record<string, Entry>;
export const SPELLBOOK_NAMES: Record<Spellbook, string> = {standard: 'Standard spellbook', ancient: 'Ancient Magicks', lunar: 'Lunar spellbook', arceuus: 'Arceuus spellbook'};

/** A prayer or spell by name (any case), or null when there is no card for it. */
export function guideMagic(kind: 'prayer' | 'spell', name: string): GuideMagic | null {
  const list = kind === 'prayer' ? PRAYERS : SPELLS, key = Object.keys(list).find(k => k.toLowerCase() === name.trim().toLowerCase());
  if (!key) return null;
  const e = list[key];
  return {
    kind, name: key, level: e.level, effect: e.effect,
    ...(e.book ? {book: e.book as Spellbook} : {}),
    ...(e.runes ? {runes: e.runes.map(([id, n]) => [String(id), Number(n)] as [string, number])} : {}),
    ...(e.skills ? {skills: e.skills.map(([s, l]) => [String(s), Number(l)] as [string, number])} : {}),
    ...(e.quests ? {quests: e.quests} : {}),
    ...(e.items ? {items: e.items} : {}),
    ...(e.unlock ? {unlock: e.unlock} : {}),
  };
}
/** Every prayer and spell with a card, for tests. */
export const guideMagicNames = (kind: 'prayer' | 'spell') => Object.keys(kind === 'prayer' ? PRAYERS : SPELLS);

export type MagicNeed = {key: string; icon: string; text: string};
/** What a prayer or spell needs, one line each like a guide's requirements: "94 Magic", "Ancient Magicks", the quest,
 * the item, other skills ("70 Defence"), then anything else ("Knight Waves Training Grounds"). */
export function magicNeeds(m: GuideMagic): MagicNeed[] {
  const skill = m.kind === 'prayer' ? 'Prayer' : 'Magic';
  return [
    {key: 'level', icon: `/icons/skills/${skill.toLowerCase()}.png`, text: `${m.level} ${skill}`},
    ...(m.skills ?? []).map(([s, l]) => ({key: 's' + s, icon: `/icons/skills/${s.toLowerCase()}.png`, text: `${l} ${s}`})),
    ...(m.book && m.book !== 'standard' ? [{key: 'book', icon: `/icons/game/spellbook-${m.book}.png`, text: SPELLBOOK_NAMES[m.book]}] : []),
    ...(m.quests ?? []).map(q => ({key: 'q' + q, icon: '/ui/quest-point-icon.png', text: q})),
    ...(m.items ?? []).map(id => ({key: 'i' + id, icon: guideItemImage(id) ?? '/ui/collection-log-icon.png', text: guideItems[id] ?? 'Unknown item'})),
    ...(m.unlock ? [{key: 'u', icon: '/icons/game/minigame.png', text: m.unlock}] : []),
  ];
}
export type MagicRune = {id: string; name: string; amount: number; icon: string};
/** One cast's runes with their names and icons, in the spellbook's order. */
export function magicRunes(m: GuideMagic): MagicRune[] {
  return (m.runes ?? []).map(([id, amount]) => ({id, amount, name: guideItems[id] ?? 'Rune', icon: guideItemImage(id) ?? `/items/${id}.png`}));
}
