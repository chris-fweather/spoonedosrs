// Builds public/world-map/icon-details.json: what the world map's agility shortcut and fishing spot icons stand for, for
// their hover cards (lib/world-map-game-icons.ts gameIconTip). Each icon in public/world-map/game-icons.json is matched to
// open data by where it is:
//
// - Agility shortcuts (sprites 1518 and 7287): RuneLite's AgilityShortcut enum gives each shortcut's Agility level, its
//   name and the tile where the world map draws its icon; an icon within MATCH tiles of one takes that shortcut. Icons
//   RuneLite places nowhere fall back to Shortest Path's agility shortcuts and Agility-gated transports (the obstacle's
//   name and the skills it needs, from either end within MATCH + 1 tiles). Grapple shortcuts also list the other skills
//   Shortest Path gives them (Ranged, Strength).
// - Fishing spots (sprite 1474): RuneLite's FishingSpot enum lists the fish of each kind of spot by NPC, and the game's
//   NPC names (RuneLite gameval NpcID) carry the 64×64 map square the spots stand in (_0_44_53_RAREFISH: floor 0,
//   square 44,53). An icon takes every kind of spot named for its square; the level is the lowest of the spot's fish in
//   RuneLite's Fishing calculator (FishingAction). Spots named without a square (boats, Piscatoris, Tempoross…) are left
//   out, so those icons say just "Fishing spot".
//
// Ambiguous matches (two shortcuts with different levels at the same distance) are left out rather than guessed.
//
// Sources (download them into one folder, then run):
//   RuneLite 9fad2c588ca957ae47d883b09544725a796ed9fe (BSD-2-Clause), https://github.com/runelite/runelite
//     runelite-client/src/main/java/net/runelite/client/game/AgilityShortcut.java
//     runelite-client/src/main/java/net/runelite/client/game/FishingSpot.java
//     runelite-client/src/main/java/net/runelite/client/plugins/skillcalculator/skills/FishingAction.java
//   Shortest Path c48960159a738066a230f76899821da9d5369439 (BSD-2-Clause), https://github.com/Skretzo/shortest-path
//     src/main/resources/transports/agility_shortcuts.tsv
//     src/main/resources/transports/transports.tsv
//
//   node scripts/build-map-icon-details.mjs <sourceFolder>
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir] = process.argv.slice(2);
if (!dir) {console.error('usage: node scripts/build-map-icon-details.mjs <sourceFolder>'); process.exit(1);}
const read = name => readFileSync(join(dir, name), 'utf8');
const OUT = 'public/world-map';
const SHORTCUT = new Set([1518, 7287]), FISHING = 1474;
/** How close (in tiles) a shortcut's map point has to be to an icon. */
const MATCH = 2;

const icons = JSON.parse(readFileSync(`${OUT}/game-icons.json`, 'utf8')).icons.map(([x, y, plane, sprite]) => ({x, y, plane, sprite}));
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** "Grapple Broken Raft" → "Grapple broken raft"; "Bridge Repair - Quest" → "Bridge repair (quest)". */
const sentence = s => {const t = s.replace(/\s+-\s+Quest$/i, ' (quest)').trim(); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();};

// ---------- Agility shortcuts ----------
const runelite = [];
for (const m of read('AgilityShortcut.java').matchAll(/^\t([A-Z_0-9]+)\(\s*(\d+), "([^"]+)", (?:null|new WorldPoint\((\d+), (\d+), (\d+)\))/gm)) {
  if (m[4] !== undefined) runelite.push({x: +m[4], y: +m[5], plane: +m[6], name: sentence(m[3]), level: +m[2]});
}
/** Shortest Path rows with an Agility level: both ends, the obstacle's name and every skill it needs. */
const paths = [];
for (const file of ['agility_shortcuts.tsv', 'transports.tsv']) {
  for (const line of read(file).split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const f = line.split('\t'), skills = (f[3] ?? '').split(';').map(s => s.trim().match(/^(\d+) (\w+)$/)).filter(Boolean).map(m => [m[2], +m[1]]);
    const agility = skills.find(s => s[0] === 'Agility');
    if (!agility) continue;
    const words = f[2].trim().split(' '), name = sentence(words.slice(1, -1).join(' '));
    const ends = [f[0], f[1]].filter(s => s && s.trim()).map(s => {const [x, y, plane] = s.trim().split(/\s+/).map(Number); return {x, y, plane};});
    for (const end of ends) paths.push({...end, name, level: agility[1], other: skills.filter(s => s[0] !== 'Agility')});
  }
}
/** The nearest candidates within `range`: all of those at the closest distance. */
function nearest(list, icon, range) {
  const near = list.filter(c => c.plane === icon.plane && dist(c, icon) <= range);
  const best = Math.min(...near.map(c => dist(c, icon)));
  return near.filter(c => dist(c, icon) === best);
}
const same = (list, key) => new Set(list.map(key)).size === 1;
const otherSkills = list => list.map(c => c.other.map(([s, l]) => `${l} ${s}`).join(' · '));

const shortcuts = [];
let fromRunelite = 0, fromPaths = 0;
for (const icon of icons.filter(i => SHORTCUT.has(i.sprite))) {
  const rl = nearest(runelite, icon, MATCH);
  if (rl.length && same(rl, c => c.name + c.level)) {
    // Other skills (grapples) from Shortest Path's rows for the same shortcut, when they agree.
    const sp = nearest(paths, icon, MATCH + 1).filter(c => c.level === rl[0].level), other = otherSkills(sp);
    shortcuts.push([icon.x, icon.y, icon.plane, rl[0].name, rl[0].level || null, other.length && same(other, s => s) ? other[0] : '']);
    fromRunelite++;
    continue;
  }
  const sp = nearest(paths, icon, MATCH + 1);
  if (!sp.length || !same(sp, c => c.level)) continue;
  const other = otherSkills(sp);
  shortcuts.push([icon.x, icon.y, icon.plane, same(sp, c => c.name) ? sp[0].name : null, sp[0].level, same(other, s => s) ? other[0] : '']);
  fromPaths++;
}

// ---------- Fishing spots ----------
const levels = new Map([...read('FishingAction.java').matchAll(/^\t([A-Z_]+)\(ItemID\.\w+, (\d+), /gm)].map(m => [m[1], +m[2]]));
/** The fish each kind of spot gives, by RuneLite's Fishing calculator names (for the lowest level), and the name the card
 * shows. RuneLite's spot names list the main catches; the big net catches of a shark spot (mackerel, cod) are added. A
 * kind missing here, or with a fish the calculator does not list, shows its RuneLite name without a level. */
const SPOT_FISH = {
  SHRIMP: ['Shrimp, anchovies, sardine, herring', 'RAW_SHRIMPS', 'RAW_ANCHOVIES', 'RAW_SARDINE', 'RAW_HERRING'],
  LOBSTER: ['Lobster, swordfish, tuna', 'RAW_LOBSTER', 'RAW_SWORDFISH', 'RAW_TUNA'],
  SHARK: ['Shark, bass, cod, mackerel', 'RAW_SHARK', 'RAW_BASS', 'RAW_COD', 'RAW_MACKEREL'],
  SALMON: ['Salmon, trout, pike', 'RAW_SALMON', 'RAW_TROUT', 'RAW_PIKE'],
  BARB_FISH: ['Leaping trout, salmon, sturgeon', 'LEAPING_TROUT', 'LEAPING_SALMON', 'LEAPING_STURGEON'],
  KARAMBWAN: ['Karambwan', 'RAW_KARAMBWAN'],
  KARAMBWANJI: ['Karambwanji, shrimp', 'RAW_KARAMBWANJI', 'RAW_SHRIMPS'],
  SLIMY_EEL: ['Slimy eel', 'RAW_SLIMY_EEL'],
  CAMDOZAAL_CAVE_EEL: ['Slimy eel, cave eel', 'RAW_SLIMY_EEL', 'RAW_CAVE_EEL'],
  DARK_CRAB: ['Dark crab', 'RAW_DARK_CRAB'],
  TUTORIAL_SHRIMP: ['Shrimp', 'RAW_SHRIMPS'],
  ETCETERIA_LOBSTER: ['Lobster', 'RAW_LOBSTER'],
};
const spotSource = read('FishingSpot.java');
const body = spotSource.slice(spotSource.indexOf('public enum FishingSpot'), spotSource.indexOf('private static final Map'));
const kinds = [], squares = new Map();
for (const m of body.matchAll(/^\t([A-Z_0-9]+)\("([^"]*)"(?:, "[^"]*")?, ItemID\.\w+,([\s\S]*?)\)(?=,\n|\n)/gm)) {
  const [key, name, ids] = [m[1], m[2], m[3]];
  const fish = SPOT_FISH[key], known = fish?.slice(1).map(f => levels.get(f));
  const kind = [fish ? fish[0] : sentence(name), known && known.every(l => l !== undefined) ? Math.min(...known) : null];
  let index = -1;
  for (const id of ids.matchAll(/NpcID\.(\w+)/g)) {
    // _<floor>_<square x>_<square y>_NAME, or _<square x>_<square y>_NAME on the ground floor.
    const sq = id[1].match(/^_(?:(\d+)_)?(\d+)_(\d+)_[A-Z]/);
    if (!sq) continue;
    if (index < 0) {index = kinds.length; kinds.push(kind);}
    const at = `${sq[1] ?? 0},${sq[2]},${sq[3]}`;
    squares.set(at, [...new Set([...(squares.get(at) ?? []), index])]);
  }
}
const fishing = [];
for (const icon of icons.filter(i => i.sprite === FISHING)) {
  const found = squares.get(`${icon.plane},${icon.x >> 6},${icon.y >> 6}`);
  // The lowest level first, so the card reads from the easiest spot up.
  if (found) fishing.push([icon.x, icon.y, icon.plane, [...found].sort((a, b) => (kinds[a][1] ?? 999) - (kinds[b][1] ?? 999))]);
}

const total = (s) => icons.filter(i => s(i.sprite)).length;
writeFileSync(`${OUT}/icon-details.json`, JSON.stringify({v: 1, fish: kinds, shortcuts, fishing}));
console.log(JSON.stringify({shortcutIcons: total(s => SHORTCUT.has(s)), shortcuts: shortcuts.length, fromRunelite, fromPaths, fishingIcons: total(s => s === FISHING), fishing: fishing.length, kinds: kinds.length}));
