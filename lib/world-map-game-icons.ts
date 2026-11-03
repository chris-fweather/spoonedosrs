/** The game's own world map art: every map-function icon and area label the in-game world map draws, at the same places
 * (public/world-map/game-icons.json, sprites in public/icons/map/game), and the game sprites our places use. Built from
 * the game cache: icon placements from the world map geography (index 18) joined with object configs that carry a map
 * area (index 2 group 6, opcode 82), area sprites and labels from the map element configs (index 2 group 35) and the
 * world map composite (index 19 group 1); sprites from index 8; names from the world map key (enum 1713, by each map
 * element's category). */

/** A map-function sprite (15×15 in the game, saved at 2× with nearest-neighbour scaling). */
export const GAME_ICON = (sprite: number) => `/icons/map/game/${sprite}.png`;

/** The game sprites our places use: banks, quest starts, dungeons, every kind of transport (the game draws fairy rings,
 * spirit trees, gliders, balloons, mushtrees, quetzals, boats and charter ships all with its Transportation icon),
 * docking points, agility shortcuts and house portals. */
export const GAME_SPRITE = {bank: 1453, quest: 1454, dungeon: 1534, dungeonPlain: 1460, transport: 1504, port: 7285, shortcut: 1518, housePortal: 1505, mapLink: 1535} as const;

/** What each map-function sprite stands for, for the hover card: the name the game's world map key gives it. */
export const GAME_ICON_NAME: Record<number, string> = {
  1448: 'General store', 1449: 'Sword shop', 1450: 'Magic shop', 1451: 'Axe shop', 1452: 'Helmet shop', 1453: 'Bank',
  1454: 'Quest start', 1455: 'Amulet shop', 1456: 'Mining site', 1457: 'Furnace', 1458: 'Anvil', 1459: 'Combat training',
  1460: 'Dungeon', 1461: 'Staff shop', 1462: 'Platebody shop', 1463: 'Platelegs shop', 1464: 'Scimitar shop',
  1465: 'Archery shop', 1466: 'Shield shop', 1467: 'Altar', 1468: 'Herbalist', 1469: 'Jewellery shop',
  1470: 'Gem shop', 1471: 'Crafting shop', 1472: 'Candle shop', 1473: 'Fishing shop', 1474: 'Fishing spot',
  1475: 'Clothes shop', 1476: 'Apothecary', 1477: 'Silk trader', 1478: 'Food shop', 1479: 'Pub', 1480: 'Mace shop',
  1481: 'Tannery', 1482: 'Rare trees', 1483: 'Spinning wheel', 1484: 'Food shop', 1485: 'Food shop', 1486: 'Minigame',
  1487: 'Water source', 1488: 'Cooking range', 1489: 'Plateskirt shop', 1490: 'Pottery wheel', 1491: 'Windmill',
  1492: 'Mining shop', 1493: 'Chainmail shop', 1494: 'Silver shop', 1495: 'Fur trader', 1496: 'Spice shop',
  1497: 'Agility training', 1498: 'Food shop', 1499: 'Slayer Master', 1500: 'Hairdresser', 1501: 'Farming patch',
  1502: 'Makeover Mage', 1504: 'Transportation', 1505: 'House portal', 1506: 'Farming shop', 1507: 'Loom',
  1508: 'Brewery', 1509: 'Dairy churn', 1510: 'Stagnant water source', 1511: 'Hunter training', 1512: 'Poll booth',
  1513: 'Hunter shop', 1515: 'Estate Agent', 1516: 'Sawmill', 1517: 'Stonemason', 1518: 'Agility shortcut',
  1519: 'Woodcutting stump', 1521: 'Sandpit', 1522: 'Task Master', 1523: 'Pet shop', 1524: 'Bounty Hunter trader',
  1526: 'Pricing expert', 1527: 'Pricing expert', 1528: 'Pricing expert', 1529: 'Pricing expert',
  1530: 'Pricing expert', 1531: 'Grand Exchange', 1533: 'Raid', 1534: 'Dungeon', 1536: 'Lumbridge Guide',
  1537: 'Bank Tutor', 1538: 'Security Tutor', 1669: 'Woodcutting Tutor', 1670: 'Mining Tutor', 1671: 'Fishing Tutor',
  1672: 'Hunter Tutor', 1673: 'Smithing Tutor', 1674: 'Crafting Tutor', 1675: 'Cooking Tutor', 1676: 'Combat Tutor',
  1677: 'Prayer Tutor', 1678: 'Danger Tutor', 1679: 'Ironman Tutor', 1681: 'Deadman Tutor',
  1684: 'Holiday item trader', 1685: 'Wine trader', 1686: 'Junk checker', 1687: 'Altar', 1688: 'Newspaper trader',
  1689: 'Tea trader', 1690: 'Dairy cow', 1691: 'Dye trader', 1692: 'Garden supplier', 1693: 'Bond Tutor',
  1694: 'Rope trader', 1695: 'Taxidermist', 1696: 'Clue Tutor', 2210: 'Singing bowl', 2214: 'Leagues Tutor',
  2215: 'Bird house site', 2216: "Death's Office", 2960: 'Distraction and Diversion', 2961: 'Clan Hub',
  2962: 'Combat Achievements', 2966: 'Speedrunning shop', 4941: 'Forestry shop', 4942: 'Thieving activity',
  4944: 'Vale totem site', 4945: 'Trawling shoal', 4946: 'Barracuda Trial', 4947: 'Salvaging spot',
  7281: 'Port task board', 7282: 'Salvaging station', 7283: 'Ledger table', 7284: 'Shipwright', 7285: 'Docking point',
  7286: 'Crew registrar', 7287: 'Agility shortcut (One way)',
  1535: 'Map link',
};
export const gameIconName = (sprite: number) => GAME_ICON_NAME[sprite] ?? 'Map icon';

/** An icon on the game's map: tile, floor and sprite. */
export type GameIcon = {x: number; y: number; plane: number; sprite: number};
/** An area name as the game writes it: lines, size (0 small, 1 medium, 2 large) and colour (0 for the usual white). */
export type GameLabel = {x: number; y: number; plane: number; lines: string[]; size: number; colour: number};
export type GameIconsFile = {v: 1; icons: [number, number, number, number][]; labels: [number, number, number, string, number, number][]};
export function readGameIcons(file: GameIconsFile): {icons: GameIcon[]; labels: GameLabel[]} {
  return {
    icons: file.icons.map(([x, y, plane, sprite]) => ({x, y, plane, sprite})),
    labels: file.labels.map(([x, y, plane, text, size, colour]) => ({x, y, plane, lines: text.split('\n'), size, colour})),
  };
}

/** What an agility shortcut or fishing spot icon stands for (public/world-map/icon-details.json, built by
 * scripts/build-map-icon-details.mjs from RuneLite and Shortest Path): a shortcut's obstacle, Agility level and other
 * skills; a fishing spot's kinds of spot, each with its fish and lowest Fishing level. Icons the data could not place
 * have none and keep the plain name. */
export type IconDetailsFile = {
  v: 1; fish: [string, number | null][];
  shortcuts: [number, number, number, string | null, number | null, string][];
  fishing: [number, number, number, number[]][];
};
export type FishingKind = {fish: string; level: number | null};
export type IconDetail = {kind: 'shortcut'; name: string | null; level: number | null; other: string} | {kind: 'fishing'; spots: FishingKind[]};
export type IconDetails = Map<string, IconDetail>;
const detailKey = (x: number, y: number, plane: number) => `${x},${y},${plane}`;
export function readIconDetails(file: IconDetailsFile): IconDetails {
  const out: IconDetails = new Map(), fish = file.fish.map(([f, level]) => ({fish: f, level}));
  for (const [x, y, plane, name, level, other] of file.shortcuts) out.set(detailKey(x, y, plane), {kind: 'shortcut', name, level, other});
  for (const [x, y, plane, kinds] of file.fishing) out.set(detailKey(x, y, plane), {kind: 'fishing', spots: kinds.map(i => fish[i]).filter(Boolean)});
  return out;
}
/** A game icon's hover card: its name, and for a shortcut or fishing spot what it is ("Crumbling wall · 5 Agility",
 * "Lobster, swordfish, tuna · 35 Fishing"). Where several kinds of fishing spot share the icon's map square, each is a
 * row of its own. */
export type GameIconTip = {title: string; detail: string; rows: {text: string; level: string}[]};
export function gameIconTip(g: GameIcon, details?: IconDetails | null): GameIconTip {
  const title = gameIconName(g.sprite), d = details?.get(detailKey(g.x, g.y, g.plane));
  if (d?.kind === 'shortcut') {
    // The name for the one-way icon already says it is a shortcut; the obstacle and requirements follow.
    return {title, detail: [d.name, d.level ? `${d.level} Agility` : '', d.other].filter(Boolean).join(' · '), rows: []};
  }
  if (d?.kind === 'fishing' && d.spots.length) {
    const level = (k: FishingKind) => k.level ? `${k.level} Fishing` : '';
    if (d.spots.length === 1) return {title, detail: [d.spots[0].fish, level(d.spots[0])].filter(Boolean).join(' · '), rows: []};
    return {title: 'Fishing spots', detail: '', rows: d.spots.map(k => ({text: k.fish, level: level(k)}))};
  }
  return {title, detail: '', rows: []};
}

/** Which layer button hides a game icon along with our markers of the same kind; anything else always shows. */
export function gameIconLayer(sprite: number): 'bank' | 'quest' | 'transport' | null {
  if (sprite === GAME_SPRITE.bank) return 'bank';
  if (sprite === GAME_SPRITE.quest) return 'quest';
  if (sprite === GAME_SPRITE.transport || sprite === GAME_SPRITE.port) return 'transport';
  return null;
}
/** Sprites that count as the same icon when one of our markers already stands nearby (a dungeon with or without a
 * link to another map). */
export const sameGameIcon = (a: number, b: number) => a === b || (isDungeon(a) && isDungeon(b));
const isDungeon = (s: number) => s === GAME_SPRITE.dungeon || s === GAME_SPRITE.dungeonPlain;

/** The zoom from which a label of each size shows: kingdoms first, then towns, then smaller places, as in the game. */
export const LABEL_ZOOM = [7, 5, 3];
/** Labels of each size stop showing past this zoom (the kingdom names would sit over towns). */
export const LABEL_MAX_ZOOM = [99, 99, 6];
/** Size on screen of a 15-pixel game sprite near `size` pixels: whole multiples only, so the pixels stay square. */
export const gameSpriteSize = (size: number) => Math.max(15, Math.round(size / 15) * 15);

/** Decluttering by zoom, as the in-game map feels: from zoom 6 (a tile a pixel) only the places people travel by or
 * head for (transport, docking points, dungeons, altars, the Grand Exchange, minigames, raids, house portals, Slayer
 * masters); banks and quest starts join at 7 with our own bank and quest markers; shops, services and crafting spots
 * at 8; and the common resources (water, ranges, fishing spots, trees, rocks, shortcuts, patches, tutors and the like)
 * only close up, from 9. */
export const GAME_ICON_ZOOM = {key: 6, start: 7, service: 8, resource: 9} as const;
const KEY = new Set<number>([GAME_SPRITE.transport, GAME_SPRITE.port, GAME_SPRITE.dungeon, GAME_SPRITE.dungeonPlain, GAME_SPRITE.housePortal, 1467, 1687, 1531, 1486, 1533, 1499]);
const START = new Set<number>([GAME_SPRITE.bank, GAME_SPRITE.quest]);
const RESOURCE = new Set<number>([
  1487, 1510, 1488, 1474, 4945, 4947, 1482, 1519, 1456, GAME_SPRITE.shortcut, 7287, 1501, 1483, 1490, 1507, 1509, 1690, 1511, 2215, 4944, 1512, 1521,
  1536, 1537, 1538, 1669, 1670, 1671, 1672, 1673, 1674, 1675, 1676, 1677, 1678, 1679, 1681, 1693, 1696, 2214,
]);
/** The closest zoom at which a game icon shows. */
export function gameIconZoom(sprite: number): number {
  return KEY.has(sprite) ? GAME_ICON_ZOOM.key : START.has(sprite) ? GAME_ICON_ZOOM.start : RESOURCE.has(sprite) ? GAME_ICON_ZOOM.resource : GAME_ICON_ZOOM.service;
}
/** Where game icons would overlap, the key ones win over services, and services over resources (all below ours). */
export function gameIconPriority(sprite: number): number {
  const z = gameIconZoom(sprite);
  return z <= GAME_ICON_ZOOM.start ? 36 - z : z === GAME_ICON_ZOOM.service ? 26 : 22;
}
