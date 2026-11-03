import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {MAP_PIN_ICON} from './guide-map.ts';
import {KIND_ICON, difficultyIcon, SPELLBOOK_ICON, TRAVEL_ICON, TELEPORT_ITEM, nearestPlace, placeIcon, readPlaces, searchPlaces, spellIcon, tabletIcon, teleportGroupIcon, teleportIcon, type MapPlace, type PlacesFile} from './world-map-places.ts';


const file: PlacesFile = {v: 1, places: [
  {k: 'bank', n: 'Varrock bank', x: 3185, y: 3436, p: 0},
  {k: 'fairy', n: 'Fairy ring AIQ', x: 2996, y: 3114, p: 0},
  {k: 'teleport', n: 'Varrock Teleport', x: 3213, y: 3424, p: 0},
  {k: 'town', n: 'Lumbridge', x: 3222, y: 3222, p: 0},
  {k: 'unknown', n: 'Nope', x: 1, y: 1, p: 0},
], quests: [{n: 'Romeo & Juliet', x: 3211, y: 3423, p: 0, d: 'Novice', l: 'Short', s: 'Talk to Romeo in Varrock Square.', npc: 'Romeo'}]};

test('places merge the site town list and skip unknown kinds and repeated towns', () => {
  const places = readPlaces(file);
  assert.equal(places.filter(p => p.name === 'Lumbridge').length, 1);
  assert.ok(!places.some(p => p.name === 'Nope'));
  const quest = places.find(p => p.kind === 'quest')!;
  assert.deepEqual(quest.quest, {name: 'Romeo & Juliet', difficulty: 'Novice', length: 'Short', start: 'Talk to Romeo in Varrock Square.', npc: 'Romeo'});
});

test('search puts towns and name starts first, finds fairy codes and tiles', () => {
  const places = readPlaces(file);
  assert.deepEqual(searchPlaces(places, 'varr').map(p => p.name), ['Varrock', 'Varrock bank', 'Varrock Sewers', 'Varrock Museum basement', 'Varrock Teleport']);
  assert.equal(searchPlaces(places, 'romeo')[0].kind, 'quest');
  assert.equal(searchPlaces(places, 'aiq')[0].name, 'Fairy ring AIQ');
  assert.deepEqual(searchPlaces(places, '3222, 3218'), [{id: 'tile', kind: 'town', name: 'Tile 3222, 3218', x: 3222, y: 3218, plane: 0}]);
  assert.deepEqual(searchPlaces(places, '  '), []);
  assert.equal(searchPlaces(places, 'a', 2).length, 2);
});

test('a clicked tile is described by the nearest town', () => {
  const places = readPlaces(file);
  assert.equal(nearestPlace(places, 3200, 3430, 0)?.name, 'Varrock');
  assert.equal(nearestPlace(places, 1000, 1000, 0), null);
});

test('the shipped places file has quest starts with difficulty and no unlicensed labels', () => {
  const data = JSON.parse(readFileSync('public/world-map/places.json', 'utf8')) as PlacesFile;
  const places = readPlaces(data);
  const quests = places.filter(p => p.kind === 'quest');
  assert.ok(quests.length > 150);
  assert.ok(quests.filter(q => q.quest?.difficulty).length / quests.length > .9);
  assert.equal(searchPlaces(places, "cook's assistant")[0]?.kind, 'quest');
  assert.ok(searchPlaces(places, 'edgeville').length > 0);
  assert.ok(!JSON.stringify(data).includes('Explv'));
});

test('teleport spots: the game\'s spell art, our tablet and jewellery art, otherwise the item; every icon file exists', () => {
  const icon = (name: string, detail?: string, kind: MapPlace['kind'] = 'teleport') => placeIcon({kind, name, detail});
  assert.equal(icon('Edgeville', 'Amulet of glory: Edgeville'), '/items/1712.png');
  assert.equal(icon('Varrock', 'Varrock tablet'), '/items/8007.png');
  assert.equal(icon('Varrock', 'Varrock Teleport: Grand Exchange'), '/icons/spells/varrock-teleport.png');
  assert.notEqual(icon('Varrock', 'Varrock tablet'), icon('Varrock', 'Varrock Teleport'), 'a spell and its tablet look different');
  assert.equal(icon('Paddewwa', 'Paddewwa Teleport'), '/icons/spells/paddewwa-teleport.png');
  assert.equal(icon('Lunar Isle', 'Lunar Home Teleport'), '/icons/spells/lumbridge-home-teleport.png');
  assert.equal(icon('Barrows', 'Barrows Teleport'), '/icons/spells/barrows-teleport.png');
  assert.equal(icon('Nardah', 'Master scroll book: Nardah teleport'), '/items/12402.png');
  assert.equal(icon('Ardougne', 'Rat Pits Minigame Teleport: 1. Ardougne'), '/icons/game/minigame.png');
  assert.equal(icon('Crabs', 'Wilderness Crabs tablet'), '/items/24251.png');
  assert.equal(icon('Charter ship: Catherby', undefined, 'boat'), '/icons/map/game/1504.png');
  assert.equal(spellIcon("Fenkenstrain's Castle Teleport"), '/icons/spells/fenkenstrain-s-castle-teleport.png');
  assert.equal(spellIcon('Carrallanger Teleport'), '/icons/spells/carrallangar-teleport.png');
  assert.equal(spellIcon('Battlefront Teleport'), '/items/22949.png', 'no spell art: its tablet');
  assert.equal(tabletIcon('Rimmington tablet'), '/items/8013.png');
  assert.equal(tabletIcon('House tablet'), '/items/8013.png');
  assert.equal(tabletIcon('Kourend Castle tablet'), '/items/28790.png', 'no art of ours: the item');
  assert.equal(teleportGroupIcon('spells-lunar', 'Lunar spellbook'), '/icons/game/spellbook-lunar.png');
  assert.equal(teleportGroupIcon('cowbell-amulet', 'Cowbell amulet'), '/items/33103.png');
  assert.equal(teleportGroupIcon('teleport-tablets', 'Teleport tablets', 8007), '/items/8007.png');
  assert.equal(teleportGroupIcon('ardougne-cloak', 'Ardougne cloak', 13121), '/items/13121.png');
  assert.equal(teleportGroupIcon('max-cape', 'Max cape', 13280), '/items/13280.png');
  assert.equal(teleportGroupIcon('house', 'Teleport to house'), '/icons/spells/teleport-to-house.png');
  const data = JSON.parse(readFileSync('public/world-map/places.json', 'utf8')) as PlacesFile;
  const paths = new Set([...readPlaces(data).map(placeIcon), ...Object.values(KIND_ICON), ...Object.values(TRAVEL_ICON), ...SPELLBOOK_ICON, ...Object.values(MAP_PIN_ICON).filter((p): p is string => !!p), ...['home', 'minigames', 'house'].map(id => teleportGroupIcon(id, '')), ...Object.values(TELEPORT_ITEM).map(id => `/items/${id}.png`)]);
  for (const p of paths) assert.ok(existsSync('public' + p), p);
});

test('every spell, tablet and item teleport in the travel data has its own art', () => {
  type Travel = {groups: {id: string; name: string; cat: string; icon?: number}[]; names: string[]; teleports: {g: number; n: number}[]};
  const data = JSON.parse(readFileSync('public/world-map/travel.json', 'utf8')) as Travel;
  const options = JSON.parse(readFileSync('public/world-map/travel-options.json', 'utf8')) as {groups: Travel['groups']};
  for (const g of options.groups) if (g.icon) assert.equal(TELEPORT_ITEM[g.name], g.icon, `${g.name} uses the travel data's item`);
  const ours = /^\/icons\/map\/(?!game\/)/;
  for (const t of data.teleports) {
    const g = data.groups[t.g], name = data.names[t.n], icon = teleportIcon({name, group: g.id, groupName: g.name, item: g.icon});
    assert.ok(existsSync('public' + icon), `${name}: ${icon}`);
    if (g.cat === 'spells' || g.cat === 'home') assert.ok(icon.startsWith('/icons/spells/') || name === 'Battlefront Teleport', `${name} shows its spell: ${icon}`);
    else if (g.cat === 'tablets') assert.ok(icon.startsWith('/items/') && (!icon.includes('varrock') && icon !== '/items/8007.png' || name.startsWith('Varrock')), `${name} shows its own tablet: ${icon}`);
    else if (g.cat === 'jewellery') assert.equal(icon, `/items/${TELEPORT_ITEM[g.name]}.png`, `${name} shows its item art`);
    // No art of their own in public/ for these: the Home Teleport spell.
    else if (!['minigames', 'teleport-spheres', 'hallowed-crystal-shard'].includes(g.id)) assert.ok(!ours.test(icon) && icon !== KIND_ICON.teleport, `${name} shows its item: ${icon}`);
    // None of the site's own map drawings is left on a teleport.
    assert.ok(!ours.test(icon), `${name} shows game art: ${icon}`);
  }
});

test('the game\'s own map icons: every placement has its sprite, and our kinds use the game\'s map functions', async () => {
  const {GAME_ICON, GAME_SPRITE, readGameIcons} = await import('./world-map-game-icons.ts');
  const {icons, labels} = readGameIcons(JSON.parse(readFileSync('public/world-map/game-icons.json', 'utf8')));
  assert.ok(icons.length > 3000 && labels.length > 1000);
  for (const s of new Set([...icons.map(i => i.sprite), ...Object.values(GAME_SPRITE), 1535])) assert.ok(existsSync('public' + GAME_ICON(s)), `sprite ${s}`);
  // Varrock west bank and the general store sit where the game draws them.
  assert.ok(icons.some(i => i.sprite === GAME_SPRITE.bank && i.x === 3186 && i.y === 3441 && i.plane === 0));
  assert.ok(labels.some(l => l.lines.join(' ') === 'Varrock' && l.plane === 0));
  assert.equal(KIND_ICON.bank, GAME_ICON(GAME_SPRITE.bank));
});

test('the game\'s map icons have the world map key\'s names and declutter by zoom', async () => {
  const {GAME_ICON_ZOOM, GAME_SPRITE, gameIconName, gameIconPriority, gameIconZoom, readGameIcons} = await import('./world-map-game-icons.ts');
  const {icons} = readGameIcons(JSON.parse(readFileSync('public/world-map/game-icons.json', 'utf8')));
  for (const s of new Set(icons.map(i => i.sprite))) assert.notEqual(gameIconName(s), 'Map icon', `sprite ${s} has a name`);
  assert.equal(gameIconName(1512), 'Poll booth');
  assert.equal(gameIconZoom(GAME_SPRITE.transport), GAME_ICON_ZOOM.key);
  assert.equal(gameIconZoom(GAME_SPRITE.dungeon), GAME_ICON_ZOOM.key);
  assert.equal(gameIconZoom(GAME_SPRITE.bank), GAME_ICON_ZOOM.start);
  assert.equal(gameIconZoom(1448), GAME_ICON_ZOOM.service, 'a general store');
  assert.equal(gameIconZoom(1487), GAME_ICON_ZOOM.resource, 'a water source');
  assert.ok(gameIconPriority(GAME_SPRITE.transport) > gameIconPriority(1448) && gameIconPriority(1448) > gameIconPriority(1487));
  // Mid zoom (7) shows only the key icons, banks and quest starts: a fraction of the full set.
  const mid = icons.filter(i => gameIconZoom(i.sprite) <= 7).length;
  assert.ok(mid < icons.length / 3, `${mid} of ${icons.length} at mid zoom`);
});

test('agility shortcut and fishing spot icons say what they are, from the matched data', async () => {
  const {gameIconTip, readGameIcons, readIconDetails} = await import('./world-map-game-icons.ts');
  const {icons} = readGameIcons(JSON.parse(readFileSync('public/world-map/game-icons.json', 'utf8')));
  const details = readIconDetails(JSON.parse(readFileSync('public/world-map/icon-details.json', 'utf8')));
  const at = (x: number, y: number) => icons.find(i => i.x === x && i.y === y && i.plane === 0)!;
  // Falador's crumbling wall, and a grapple shortcut with its other skills.
  assert.deepEqual(gameIconTip(at(2937, 3357), details), {title: 'Agility shortcut', detail: 'Crumbling wall · 5 Agility', rows: []});
  assert.match(gameIconTip(at(3032, 3391), details).detail, /^Grapple wall · 11 Agility · \d+ Ranged · \d+ Strength$/);
  // Catherby's spots share one map square: one row per kind, the easiest first.
  const catherby = gameIconTip(at(2837, 3431), details);
  assert.equal(catherby.title, 'Fishing spots');
  assert.deepEqual(catherby.rows.map(r => r.level), ['1 Fishing', '16 Fishing', '35 Fishing']);
  assert.ok(catherby.rows.some(r => r.text === 'Lobster, swordfish, tuna'));
  // Most icons are matched; one the data cannot place keeps its plain name.
  const shortcuts = icons.filter(i => i.sprite === 1518 || i.sprite === 7287), fishing = icons.filter(i => i.sprite === 1474);
  assert.ok(shortcuts.filter(i => details.has(`${i.x},${i.y},${i.plane}`)).length > shortcuts.length * .7);
  assert.ok(fishing.filter(i => details.has(`${i.x},${i.y},${i.plane}`)).length > fishing.length * .7);
  assert.deepEqual(gameIconTip(at(1832, 3773), details), {title: 'Fishing spot', detail: '', rows: []});
  assert.deepEqual(gameIconTip(at(1832, 3773), null), {title: 'Fishing spot', detail: '', rows: []});
});

test('quest start text reads cleanly: no HTML entities or doubled floor names', () => {
  const places = JSON.parse(readFileSync('public/world-map/places.json', 'utf8')) as PlacesFile;
  for (const q of places.quests) if (q.s) assert.doesNotMatch(q.s, /&#?\w+;|\[\s*(UK|US)\s*\]|\b\d+ (st|nd|rd|th)\b/, q.n);
  assert.equal(places.quests.find(q => q.n === 'Rune Mysteries')?.s, 'Talk to Duke Horacio on the 1st floor of Lumbridge Castle.');
});

test('a quest difficulty shows its orb, as on the quest list', () => {
  for (const d of ['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster', 'Special']) {
    const src = difficultyIcon(d);
    assert.equal(src, `/icons/tiers/${d.toLowerCase()}.png`);
    assert.ok(existsSync('public' + src), src);
  }
  assert.equal(difficultyIcon('Hard'), '');
  assert.equal(difficultyIcon(undefined), '');
});
