/** A short rundown of each skill for its hover card in guides: what it does in a sentence, its type, whether
 * free-to-play accounts can train it, and a few key facts (label and value) such as notable unlock levels. Every skill
 * goes to level 99. Written for guides, so it says nothing about a player. Facts are the OSRS Wiki's; a fact we are not
 * sure of is left out rather than guessed. */
import {GUIDE_SKILLS} from './guides';

/** The OSRS Wiki's grouping of skills. Sailing has none listed here. */
export type SkillCategory = 'Combat' | 'Gathering' | 'Artisan' | 'Support';
/** One fact on the card: a short label over its value, e.g. "High Level Alchemy" / "Level 55", and the game's icon for
 * the thing it names when the site has one (a spell, prayer, item or boss image under public/). */
export type SkillFact = {label: string; value: string; icon?: string};
export type SkillInfo = {summary: string; facts: SkillFact[]; members: boolean; category?: SkillCategory};
export const SKILL_MAX_LEVEL = 99;

/** An unlock and the level it needs, with its icon. */
const at = (label: string, level: number, icon?: string): SkillFact => ({label, value: `Level ${level}`, ...(icon ? {icon} : {})});
/** Icons: an item's inventory icon (as guides show it), a spell, a prayer, a boss. */
const item = (id: number, file = `/items/${id}.png`) => file;
const spell = (name: string) => `/icons/spells/${name}.png`;
const prayer = (name: string) => `/icons/prayers/${name}.png`;

export const SKILL_INFO: Record<string, SkillInfo> = {
  Attack: {summary: 'Melee accuracy, and better weapons as you level.', category: 'Combat', members: false, facts: [at('Rune weapons', 40, item(1333, '/drops/Rune_scimitar.png')), at('Dragon weapons', 60, item(4587, '/drops/Dragon_scimitar.png')), at('Abyssal whip', 70, item(4151))]},
  Strength: {summary: 'Melee max hit: how hard your attacks land.', category: 'Combat', members: false, facts: [{label: 'Trained with', value: 'Aggressive style'}, at('Tzhaar-ket-om', 60, item(6528)), at('Elder maul', 75, item(21003))]},
  Defence: {summary: 'Avoid hits, and wear stronger armour.', category: 'Combat', members: false, facts: [at('Rune armour', 40, item(1127, '/drops/Rune_platebody.png')), at('Dragon armour', 60, item(21892)), at('Barrows armour', 70, item(4720))]},
  Ranged: {summary: 'Fight from range with bows and crossbows.', category: 'Combat', members: false, facts: [at('Magic shortbow', 50, item(861, '/drops/Magic_shortbow.png')), at('Rune crossbow', 61, item(9185, '/drops/Rune_crossbow.png')), at('Toxic blowpipe', 75, item(12926))]},
  Prayer: {summary: 'Prayers that boost or protect you in combat.', category: 'Combat', members: false, facts: [{label: 'Trained by', value: 'Burying bones', icon: item(526)}, at('Protect from Melee', 43, prayer('protect-from-melee')), at('Piety', 70, prayer('piety'))]},
  Magic: {summary: 'Combat, teleport and utility spells.', category: 'Combat', members: false, facts: [{label: 'Spellbooks', value: '4', icon: '/icons/game/spellbook-standard.png'}, at('High Level Alchemy', 55, spell('high-level-alchemy')), at('Ice Barrage', 94, spell('ice-barrage'))]},
  Runecraft: {summary: 'Craft runes from essence at each rune’s altar.', category: 'Artisan', members: false, facts: [at('Nature runes', 44, item(561)), at('Law runes', 54, item(563)), at('Death runes', 65, item(560))]},
  Construction: {summary: 'Build and furnish your own player-owned house.', category: 'Artisan', members: true, facts: [{label: 'Materials', value: 'Planks and nails', icon: item(960)}, at('Portal nexus', 72), at('Ornate pool', 90)]},
  Hitpoints: {summary: 'Your life points: drop to 0 and you die.', category: 'Combat', members: false, facts: [{label: 'Starts at', value: 'Level 10'}, {label: 'Trained by', value: 'Any combat'}]},
  Agility: {summary: 'Longer-lasting run energy and shortcuts.', category: 'Support', members: true, facts: [at('Draynor rooftop', 10, item(11849)), at('Werewolf course', 60), at('Ardougne rooftop', 90, item(11849))]},
  Herblore: {summary: 'Clean herbs and mix potions.', category: 'Artisan', members: true, facts: [{label: 'Unlocked by', value: 'Druidic Ritual', icon: '/ui/quest-point-icon.png'}, at('Prayer potion', 38, item(2434)), at('Super combat', 90, item(12695))]},
  Thieving: {summary: 'Pickpocket, steal from stalls, open chests.', category: 'Support', members: true, facts: [at('Pyramid Plunder', 21, item(9028)), at('Master Farmer', 38, item(5295)), at('Ardougne knight', 55, item(995))]},
  Crafting: {summary: 'Make jewellery, armour, pottery and glass.', category: 'Artisan', members: false, facts: [at('Water battlestaff', 54, item(1395, '/drops/Water_battlestaff.png')), at("Green d'hide body", 63, item(1135, '/drops/Green_d_hide_body_0f4761.png')), at('Dragonstone amulet', 80, item(1702))]},
  Fletching: {summary: 'Make bows, arrows, crossbows and darts.', category: 'Artisan', members: true, facts: [at('Yew longbow', 70, item(855, '/drops/Yew_longbow.png')), at('Magic longbow', 85, item(859)), at('Dragon darts', 95, item(11230))]},
  Slayer: {summary: 'Kill monsters assigned by Slayer masters.', category: 'Support', members: true, facts: [at('Gargoyles', 75, '/bosses/gargoyle-wiki.png'), at('Abyssal demons', 85, item(7979)), at('Kraken', 87, '/bosses/kraken.png')]},
  Hunter: {summary: 'Trap creatures with snares, nets and box traps.', category: 'Gathering', members: true, facts: [at('Grey chinchompas', 53, item(10033)), at('Red chinchompas', 63, item(10034)), at('Black chinchompas', 73, item(11959))]},
  Mining: {summary: 'Mine ores and gems from rocks.', category: 'Gathering', members: false, facts: [at('Adamantite ore', 70, item(449)), at('Runite ore', 85, item(451)), at('Amethyst', 92, item(21347))]},
  Smithing: {summary: 'Smelt bars and smith weapons and armour.', category: 'Artisan', members: false, facts: [at('Mithril bars', 50, item(2359)), at('Adamantite bars', 70, item(2361)), at('Runite bars', 85, item(2363))]},
  Fishing: {summary: 'Catch fish with nets, rods, harpoons and cages.', category: 'Gathering', members: false, facts: [at('Lobsters', 40, item(377)), at('Sharks', 76, item(383)), at('Anglerfish', 82, item(13439))]},
  Cooking: {summary: 'Cook food that heals; burn less as you level.', category: 'Artisan', members: false, facts: [at('Lobsters', 40, item(379)), at('Sharks', 80, item(385)), at('Anglerfish', 84, item(13441))]},
  Firemaking: {summary: 'Light logs to make fires.', category: 'Artisan', members: false, facts: [at('Wintertodt', 50, '/bosses/wintertodt.png'), at('Yew logs', 60, item(1515)), at('Magic logs', 75, item(1513))]},
  Woodcutting: {summary: 'Chop trees for logs.', category: 'Gathering', members: false, facts: [at('Willow trees', 30, item(1519)), at('Yew trees', 60, item(1515)), at('Magic trees', 75, item(1513))]},
  Farming: {summary: 'Grow crops, herbs and trees, even while offline.', category: 'Gathering', members: true, facts: [at('Ranarr weed', 32, item(257)), at('Magic tree', 75, item(5316)), at('Spirit tree', 83, '/icons/map/spirit-tree.png')]},
  Sailing: {summary: 'Sail your own ship across Gielinor’s oceans.', members: true, facts: [{label: 'Added', value: '2025'}]},
};

/** The rundown for a skill by name (any case), or null for one that is not a skill. */
export function skillInfo(name: string): (SkillInfo & {name: string}) | null {
  const skill = GUIDE_SKILLS.find(s => s.toLowerCase() === name.trim().toLowerCase());
  return skill && SKILL_INFO[skill] ? {name: skill, ...SKILL_INFO[skill]} : null;
}
