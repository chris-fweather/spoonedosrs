import type {Appearance} from './appearance';
import type {Presentation,Donation} from './presentation';
import type {Journal} from './model';
import type {CommunityStats} from './community';
import type {PublicStaff,StaffRole} from './staff-policy';
import wearRaw from './wearables.json' with {type: 'json'};
import seed from './catalogue.json' with {type:'json'};
import {MAX_CAPE,SKILL_CAPES,capeNeedKey,capeVariantUnlocks,wearableUnlocks} from './item-variants';
import {CUSTOM_WEARABLES,staffWearables} from './custom-wearables';

/** Equipment slots a worn model can occupy. */
export const EQUIP_SLOTS = ['head', 'cape', 'neck', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', 'ammo'] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];
export type Equipped = Record<EquipSlot, string | null>;
/** `effect`: a site-made extra the character viewer draws with the model (embers falling from a cape's hem). */
export type WearItem = {name: string; slot: EquipSlot; wear: number[]; blocks: EquipSlot[]; file: string; flow?: number[]; effect?: 'embers'};
export type WearKit = {id: number; file: string; hide: number; part?: number};
export type WearPet = {name: string; file: string; npc: number; fly: boolean};
type Manifest = {kits: WearKit[]; items: Record<string, WearItem>; pets: Record<string, WearPet>; missingPets?: string[]};
/** The game's worn items, plus the site's own (lib/custom-wearables.ts). */
export const wearables = {...wearRaw, items: {...(wearRaw as Manifest).items, ...CUSTOM_WEARABLES}} as Manifest;
/** Who is choosing: a staff rank can unlock the site's own items (lib/custom-wearables.ts staffWearables). */
/** `allMarks`: any emblem may be pinned (the owner on dev, lib/environment.ts devPreviewsAll). */
export type ItemAccess = {staffRole?: StaffRole | null; allMarks?: boolean};

export function emptyEquipped(): Equipped {
  return {head: null, cape: null, neck: null, weapon: null, body: null, shield: null, legs: null, hands: null, feet: null, ring: null, ammo: null};
}

/** Put an owned item into its slot and clear anything that item occupies. */
export function equipItem(current: Equipped, slot: EquipSlot, itemId: string | null): Equipped {
  const next: Equipped = {...current, [slot]: itemId};
  if (!itemId) return next;
  const item = wearables.items[itemId];
  if (!item || item.slot !== slot) return current;
  for (const block of item.blocks) next[block] = null;
  for (const other of EQUIP_SLOTS) {
    if (other === slot || !next[other]) continue;
    const worn = wearables.items[next[other]];
    if (worn && (worn.blocks.includes(slot) || worn.slot === slot)) next[other] = null;
  }
  return next;
}

export function equippedIds(equipped: Equipped): string[] {
  return EQUIP_SLOTS.flatMap(slot => equipped[slot] ? [equipped[slot]] : []);
}

/** Unique collection-log items. Milestones are shares of this count. */
/** Unique collection log items in the game (OSRS Wiki, with The Fractured Archive): the collection log emblems are shares of it.
 * Changing it renames the milestone emblems: migrate saved pins (drizzle/0043_clog_emblems_1734.sql). */
export const CLOG_UNIQUE = 1734;
export const DONATOR_TITLE = 'the Generous';

/** Render a server-authorised donor suffix. */
export function displayTitle(name: string, title: string | null): string | null {
  return title === DONATOR_TITLE ? DONATOR_TITLE : null;
}

/** Pets that hover or fly in game. Everyone else stands. */
const FLYING = new Set([
  'Pet chaos elemental',
  'Pet Penance Queen',
  "Pet Kree'arra",
  'Prince Black Dragon',
  'Pet Smoke Devil',
  'Pet Kraken',
  'Pet dark core',
  'Phoenix',
  'Vorki',
  'Quetzin',
  'Rift guardian',
  'Tiny tempor',
  'Wisp',
  "Lil'viathan",
  "Tumeken's guardian",
  'Little Nightmare',
  'Huberte',
  'Gull',
  "Lil' Creator",
  'Noon',
  'Bran',
]);

const MAX_SKILLS = ['Attack', 'Hitpoints', 'Mining', 'Strength', 'Agility', 'Smithing', 'Defence', 'Herblore', 'Fishing', 'Ranged', 'Thieving', 'Cooking', 'Prayer', 'Crafting', 'Firemaking', 'Magic', 'Fletching', 'Woodcutting', 'Runecraft', 'Slayer', 'Farming', 'Construction', 'Hunter', 'Sailing'];

export type Mark = {id: string; name: string; detail: string; short: string; img: string};
export type FlairChoice = {companionPet: string | null; displayPiece: string | null; equipped: Equipped; pinnedMark: string | null; title: string | null};
export type StoredFlair = FlairChoice & Partial<Presentation> & {supporter?:boolean;details?:import('./profile-privacy').ProfileDetails; appearance?:Appearance; donation?:Donation; ownerShowcase?:boolean; /** Linked and proven through the RuneLite plugin by the same Discord account (lib/verified-profile.ts). */ verified?:boolean; canEdit: boolean; visibility?: 'public'|'private'; showcase?: {badge:Mark|null; pet:{id:string;name:string}|null; achievementTitle:string|null}; staff?: PublicStaff | null;
 /** Squire before the name of someone not on staff (staff carry theirs in staff.displayPrefix). */ namePrefix?: import('./name-prefix').NamePrefix | null;
 /** The prefix this person has earned, for the profile editor. */ earnedPrefix?: import('./name-prefix').NamePrefix | null;
 /** The donation title this name has earned, shown or not, so the profile editor can offer to show or hide it. */ earnedTitle?: string | null};

export function petFloats(name: string): boolean {
  return FLYING.has(name);
}

/** Collection log emblems use the HD book from the icon pack, like the combat task emblems. */
const CLOG_EMBLEM = '/icons/navigation/collection-log.png';

/** Shares of the log with an emblem; the 25/50/75/90/100 steps also set the silver to legendary tiers. */
const CLOG_PCTS = [1, 5, 10, 20, 25, 40, 50, 60, 75, 90, 100];
const clogCount = (pct: number) => pct === 100 ? CLOG_UNIQUE : Math.round(CLOG_UNIQUE * pct / 100);
/** Emblem id of the collection log milestone at this share of the log. */
export const clogMarkId = (pct: number) => `clog-${clogCount(pct)}`;

export function clogMilestones(): {id: string; count: number; name: string; short: string; detail: string}[] {
  const steps = CLOG_PCTS.map(pct => ({
    pct,
    count: clogCount(pct),
  }));
  return steps.map(step => ({
    id: `clog-${step.count}`,
    count: step.count,
    name: step.pct === 100 ? 'Collection log complete' : `${step.count.toLocaleString()} logged`,
    short: step.pct === 100 ? 'Full' : `${step.pct}%`,
    detail: step.pct === 100
      ? `All ${CLOG_UNIQUE.toLocaleString()} unique collection log items`
      : `${step.pct}% of ${CLOG_UNIQUE.toLocaleString()} unique collection log items`,
  }));
}

export function isMaxed(journal: Journal): boolean {
  return MAX_SKILLS.every(name => (journal.hiscores.skills.find(skill => skill.name === name)?.level ?? 0) >= 99);
}

function collectionMarks(journal: Journal): Mark[] {
  const marks: Mark[] = [];
  const total = journal.pets.length;
  const pets = journal.pets.filter(pet => pet.obtained).length;
  if (total >= 10 && pets >= 10) marks.push({id: 'pets-10', name: '10 pets', detail: `10/${total} pets obtained`, short: `10/${total}`, img: '/brand/rocky-mascot.webp'});
  if (total >= 50 && pets >= 50) marks.push({id: 'pets-50', name: '50 pets', detail: `50/${total} pets obtained`, short: `50/${total}`, img: '/brand/rocky-mascot.webp'});
  if (isMaxed(journal)) marks.push({id: 'max-cape', name: 'Max cape', detail: 'Every skill is 99', short: '99', img: '/items/13280.png'});
  const logged = journal.log?.obtained ?? 0;
  for (const step of clogMilestones()) {
    if (logged >= step.count) marks.push({id: step.id, name: step.name, detail: step.detail, short: step.short, img: CLOG_EMBLEM});
  }
  return marks;
}

export type Badge = Mark & {unlocked: boolean; completed: number; total: number};
export function badgeCatalogue(journal: Journal): Badge[] {
  const earned = collectionMarks(journal);
  const pets = journal.pets.filter(p => p.obtained).length;
  const logged = journal.log?.obtained ?? 0;
  const marks: Badge[] = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60].map(count => ({id: `pets-${count}`, name: `${count} ${count === 1 ? 'pet' : 'pets'}`, detail: `Collect ${count} different ${count === 1 ? 'pet' : 'pets'}`, short: String(count), img: '/brand/rocky-mascot.webp', completed: pets, total: count, unlocked: pets >= count}));
  const allPets = seed.pets.filter(p=>journal.pets.some(owned=>owned.id===p.id && owned.obtained)).length;
  marks.push({id: 'pets-all', name: 'All pets', detail: 'Every pet in the current journal catalogue obtained', short: 'All', img: '/brand/rocky-mascot.webp', completed: allPets, total: seed.pets.length, unlocked: allPets === seed.pets.length});
  const maxed = MAX_SKILLS.filter(name => (journal.hiscores.skills.find(s => s.name === name)?.level ?? 0) >= 99).length;
  marks.push({id: 'max-cape', name: 'Max cape', detail: 'Every skill is 99', short: '99', img: '/items/13280.png', completed: maxed, total: MAX_SKILLS.length, unlocked: isMaxed(journal)});
  for (const step of clogMilestones()) marks.push({...step, img: CLOG_EMBLEM, completed: logged, total: step.count, unlocked: earned.some(m => m.id === step.id)});
  marks.push({id: 'clog-all', name: 'Complete collection log', detail: 'Unlock every slot in your synced collection log', short: 'All', img: CLOG_EMBLEM, completed: logged, total: journal.log?.total ?? 0, unlocked: (journal.log?.total ?? 0) > 0 && logged >= journal.log!.total});
  const quests = journal.profile?.quests ?? [];
  const finished = quests.filter(q => q.state === 'finished').length;
  marks.push({id: 'quest-cape', name: 'Quest complete', detail: 'Finish every quest in your synced quest list', short: 'Q', img: '/ui/quest-point-icon.png', completed: finished, total: quests.length, unlocked: quests.length > 0 && finished === quests.length});
  const tiers = journal.profile?.diaries.flatMap(d => d.tiers) ?? [];
  const done = tiers.reduce((n, t) => n + t.completed, 0), total = tiers.reduce((n, t) => n + t.total, 0);
  marks.push({id: 'diary-cape', name: 'Diary complete', detail: 'Complete every task in your synced diaries', short: 'D', img: '/ui/achievement-diaries-icon.png', completed: done, total, unlocked: total > 0 && done >= total});
  const combat = journal.profile?.combat.reduce((n, t) => n + t.completed, 0) ?? 0;
  for (const count of [10, 25, 50, 100, 150, 250, 350, 500]) marks.push({id: `combat-${count}`, name: `${count} combat tasks`, detail: `Complete ${count} combat achievement tasks`, short: String(count), img: '/icons/navigation/combat-achievements.png', completed: combat, total: count, unlocked: combat >= count});
  // Every task in every synced combat achievement tier, read from the same tier totals as the counts above.
  const combatTotal = journal.profile?.combat.reduce((n, t) => n + t.total, 0) ?? 0;
  marks.push({id: 'combat-all', name: 'All combat tasks', detail: 'Complete every task in your synced combat achievements', short: 'All', img: '/icons/navigation/combat-achievements.png', completed: combat, total: combatTotal, unlocked: combatTotal > 0 && combat >= combatTotal});
  return marks;
}
export function earnedMarks(journal: Journal): Mark[] {
  return badgeCatalogue(journal).filter(mark => mark.unlocked);
}

/** Titles are derived from an earned badge, never accepted as arbitrary profile text. */
export function achievementTitle(journal: Journal, pinnedMark: string | null): string | null {
  if (!pinnedMark || !earnedMarks(journal).some(mark => mark.id === pinnedMark)) return null;
  if (pinnedMark === 'pets-all') return 'the Beastmaster';
  if (pinnedMark === 'pets-50') return 'the Zoo Keeper';
  if (pinnedMark === 'pets-25') return 'the Pet Tamer';
  if (pinnedMark === 'pets-10') return 'the Pet Collector';
  if (pinnedMark === 'clog-all') return 'the Completionist';
  if (pinnedMark.startsWith('clog-')) return (journal.log?.obtained??0)>=500?'the Clogger':(journal.log?.obtained??0)>=100?'the Log Collector':null;
  if (pinnedMark === 'quest-cape') return 'the Wise Old Man';
  if (pinnedMark === 'diary-cape') return 'the Achiever';
  return null;
}

function obtainedPets(journal: Journal): Set<string> {
  return new Set(journal.pets.filter(pet => pet.obtained).map(pet => pet.id));
}

/** Capes the player's levels earn, as in game: the cape of every skill at 99, its trimmed version once they have two or
 * more 99s, and the max cape when every skill is 99. */
export function earnedCapes(journal: Journal): string[] {
  const maxed = journal.hiscores.skills.filter(skill => skill.level >= 99 && Object.hasOwn(SKILL_CAPES, skill.name)).map(skill => SKILL_CAPES[skill.name]);
  const capes = maxed.flatMap(([plain, trimmed]) => maxed.length > 1 ? [plain, trimmed] : [plain]);
  return isMaxed(journal) ? [...capes, MAX_CAPE] : capes;
}

/** Logged items, plus the fixed and ornamented versions they unlock (lib/item-variants.ts), the capes the player's
 * levels earn, the site's own items their staff rank allows, and the max and completionist cape versions their
 * logged items, quests and diaries make. */
export function obtainedItems(journal: Journal, access: ItemAccess = {}): Set<string> {
  const ids = new Set<string>(earnedCapes(journal));
  for (const tab of journal.log?.tabs ?? []) for (const page of tab.pages) for (const item of page.items) {
    if (item.quantity > 0) ids.add(String(item.id));
  }
  const all = wearableUnlocks(ids);
  for (const id of staffWearables(access.staffRole)) all.add(id);
  for (const id of capeVariantUnlocks(new Set([...all, ...finishedContent(journal)]))) all.add(id);
  return all;
}

/** Finished quests and fully completed diary tiers, as capeNeedKey keys (`quest:dragon slayer ii`,
 * `diary:ardougne:elite`), for the max cape versions those rewards make. */
function finishedContent(journal: Journal): string[] {
  const quests = (journal.profile?.quests ?? []).filter(q => q.state === 'finished').map(q => capeNeedKey(`quest:${q.name}`));
  const diaries = (journal.profile?.diaries ?? []).flatMap(d => d.tiers.filter(t => t.total > 0 && t.completed >= t.total).map(t => capeNeedKey(`diary:${d.area}:${t.tier}`)));
  return [...quests, ...diaries];
}

export function parsePiece(value: string): {kind: 'pet' | 'item'; id: string} | null {
  const match = /^(pet|item):(\d{1,10})$/.exec(value);
  if (!match) return null;
  return {kind: match[1] as 'pet' | 'item', id: match[2]};
}

function blank(): FlairChoice {
  return {companionPet: null, displayPiece: null, equipped: emptyEquipped(), pinnedMark: null, title: null};
}

function wearOwned(items: Set<string>, id: string, slot: (typeof EQUIP_SLOTS)[number]): boolean {
  const wear = wearables.items[id];
  return !!wear && wear.slot === slot && items.has(id);
}

/** Worn slots from an explicit equipment object, or from a legacy single displayed item. */
function readEquipped(items: Set<string>, input: {equipped?: unknown; displayPiece?: unknown}): Equipped {
  const next = emptyEquipped();
  if (input.equipped && typeof input.equipped === 'object') {
    for (const slot of EQUIP_SLOTS) {
      const id = (input.equipped as Record<string, unknown>)[slot];
      if (typeof id === 'string' && wearOwned(items, id, slot)) next[slot] = id;
    }
  }
  const bare = EQUIP_SLOTS.every(slot => !next[slot]);
  if (bare && typeof input.displayPiece === 'string') {
    const piece = parsePiece(input.displayPiece);
    const wear = piece?.kind === 'item' ? wearables.items[piece.id] : undefined;
    if (piece && wear && items.has(piece.id)) next[wear.slot] = piece.id;
  }
  for (const slot of EQUIP_SLOTS) {
    const worn = next[slot] ? wearables.items[next[slot]!] : undefined;
    for (const block of worn?.blocks ?? []) next[block] = null;
  }
  return next;
}

/** Drop any choice the journal cannot support. Invalid title text is dropped too. */
/** The profile settings save. Visibility, shared details and donation display are edited in Account settings and are never sent here, so the server keeps the stored choices even from a stale tab. */
export function profileSaveBody(journal: Journal, next: StoredFlair, owner: boolean, access: ItemAccess = {}) {
  const clean = coerceFlair(journal, next, access);
  return {...clean, pinnedMark: owner ? next.pinnedMark : clean.pinnedMark, staffBadge: next.staffBadge, staffPrefix: next.staffPrefix, titleChoice: next.titleChoice, showTitle: next.showTitle, appearance: next.appearance};
}

export function coerceFlair(journal: Journal, input: {companionPet?: unknown; displayPiece?: unknown; equipped?: unknown; pinnedMark?: unknown; title?: unknown}, access: ItemAccess = {}): FlairChoice {
  const clean = blank();
  const pets = obtainedPets(journal);
  const items = obtainedItems(journal, access);
  if (typeof input.companionPet === 'string' && pets.has(input.companionPet)) clean.companionPet = input.companionPet;
  if (typeof input.displayPiece === 'string') {
    const piece = parsePiece(input.displayPiece);
    if (piece?.kind === 'pet' && pets.has(piece.id)) clean.displayPiece = `pet:${piece.id}`;
    if (piece?.kind === 'item' && items.has(piece.id)) clean.displayPiece = `item:${piece.id}`;
  }
  if (!clean.companionPet && clean.displayPiece?.startsWith('pet:')) clean.companionPet = clean.displayPiece.slice(4);
  clean.equipped = readEquipped(items, input);
  if (typeof input.pinnedMark === 'string' && (access.allMarks ? badgeCatalogue(journal) : earnedMarks(journal)).some(mark => mark.id === input.pinnedMark)) clean.pinnedMark = input.pinnedMark;
  if (input.title === DONATOR_TITLE) clean.title = DONATOR_TITLE;
  return clean;
}

function asked(value: unknown): boolean {
  return value != null && value !== '';
}

/** Reject a save that asks for a pet, item, mark, or title the account cannot use. */
export function assertFlair(journal: Journal, input: {companionPet?: unknown; displayPiece?: unknown; equipped?: unknown; pinnedMark?: unknown; title?: unknown}, access: ItemAccess = {}): FlairChoice {
  const clean = coerceFlair(journal, input, access);
  if (asked(input.companionPet) && !clean.companionPet) throw new Error('Pick a pet this account has obtained.');
  if (asked(input.displayPiece) && !clean.displayPiece && !EQUIP_SLOTS.some(slot => clean.equipped[slot])) throw new Error('Pick an obtained collection log item or pet.');
  if (input.equipped && typeof input.equipped === 'object') {
    for (const slot of EQUIP_SLOTS) {
      const id = (input.equipped as Record<string, unknown>)[slot];
      if (typeof id === 'string' && id !== '' && clean.equipped[slot] !== id) throw new Error('Equip a collection log item this account can wear.');
    }
  }
  if (asked(input.pinnedMark) && !clean.pinnedMark) throw new Error('Pin a mark this account has earned.');
  if (asked(input.title) && !clean.title) throw new Error('That title is not available.');
  return clean;
}

export type BoardRow = {supporter?:boolean;boardRank?:number|null;supporterRank?:number|null; donation?:Donation; name: string; title: string | null; pets: number; log: number; hasJournal?: boolean; stats?: CommunityStats; staff?: PublicStaff | null; namePrefix?: import('./name-prefix').NamePrefix | null; achievementTitle?: string | null; featuredPet?: {id:string;name:string} | null; accountMode?: import('./account-mode').AccountMode | null};

/** Claimed accounts: pets obtained, then collection-log count, then name. */
export function rankClaims(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort((a, b) => b.pets - a.pets || b.log - a.log || a.name.localeCompare(b.name));
}

export type BadgeTier = 'bronze'|'silver'|'gold'|'platinum'|'diamond'|'legendary';
/** Emblem tiers, lowest first: the order of the tier filter and the emblem groups in Profile settings. */
export const BADGE_TIERS: readonly BadgeTier[] = ['bronze','silver','gold','platinum','diamond','legendary'];
export function badgeTier(id: string): BadgeTier {
 if (['pets-all','clog-all','max-cape','quest-cape','diary-cape','combat-all',clogMarkId(100)].includes(id)) return 'legendary';
 const value=Number(id.split('-').at(-1));
 const steps=id.startsWith('pets-')?[10,20,30,50]:id.startsWith('clog-')?[25,50,75,90].map(clogCount):id.startsWith('combat-')?[100,250,350,500]:id.startsWith('quests-')?[50,100,150,200]:[100,200,300,400];
 return value>=steps[3]?'diamond':value>=steps[2]?'platinum':value>=steps[1]?'gold':value>=steps[0]?'silver':'bronze';
}
