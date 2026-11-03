/** Guide maps: a view of the game world with numbered stops, saved in the guide as a document section. Coordinates are
 * game tiles (x east, y north) on one of the four floors (plane 0 is the ground floor). */
import {exitDirection, far, onSurface, type MapExit} from './world-map-exits';

/** `fight` is a fight in any combat style (the plain hitsplat); `fight-melee`, `fight-ranged` and `fight-magic` are fights
 * where one style is recommended (the hitsplat with its weapon). Stops saved before the styles were split keep `fight`,
 * which now reads as any style: the quests that used it allow every style. */
export const MAP_PIN_KINDS = ['stop', 'start', 'npc', 'fight', 'fight-melee', 'fight-ranged', 'fight-magic', 'item', 'dig', 'search', 'cutscene', 'bank', 'teleport', 'danger'] as const;
export type GuideMapPinKind = (typeof MAP_PIN_KINDS)[number];
/** An item a stop uses or needs (a guide item id, as in requirements), with how many. */
export type GuideMapStopItem = {id: string; quantity: number};
/** A stop can carry details shown in a small card when readers hover or choose it: the items used there, the chat options
 * to pick in order (Quest Helper style), and a short note. Stops saved before details have none. */
/** `text` is what to do at the stop, in the guide's inline formatting ([[game terms]], **bold**): a map whose stops carry
 * it is a step of its own, read from the stops beside the map instead of a separate list. */
/** `via` (teleport stops) names how to get there when the label does not ("Amulet of glory", "Spirit tree"): it picks the
 * stop's icon and the teleport its card highlights. */
export type GuideMapPin = {x: number; y: number; plane: number; label: string; kind: GuideMapPinKind; items?: GuideMapStopItem[]; dialogue?: string[]; note?: string; via?: string; text?: string};
export const MAP_STOP_LIMITS = {items: 8, quantity: 1_000_000, dialogue: 8, line: 100, note: 200, via: 60, text: 240};
/** Whether a stop has anything to show in its card. */
export const hasStopDetails = (p: GuideMapPin) => !!(p.items?.length || p.dialogue?.length || p.note);
/** Whether a map's stops carry their own instructions, so the map reads as a step by itself. */
export const hasStopText = (map: Pick<GuideMap, 'pins'>) => map.pins.some(p => !!p.text);
/** A stop as saved: blank dialogue lines, an empty note, empty instructions and empty lists are left out, text is trimmed. */
export function tidyStop(p: GuideMapPin): GuideMapPin {
  const {items, dialogue, note, via, text: say, ...pin} = p, lines = (dialogue ?? []).map(l => l.trim()).filter(Boolean), text = note?.trim() ?? '', how = p.kind === 'teleport' ? via?.trim() ?? '' : '', steps = say?.trim() ?? '';
  return {...pin, label: pin.label.trim(), ...(steps ? {text: steps} : {}), ...(items?.length ? {items: items.map(i => ({id: i.id, quantity: i.quantity}))} : {}), ...(lines.length ? {dialogue: lines} : {}), ...(text ? {note: text} : {}), ...(how ? {via: how} : {})};
}
/** `lines` draws the route between stops; a map without it (every map saved before route lines) shows them. */
export type GuideMap = {title: string; x: number; y: number; plane: number; zoom: number; pins: GuideMapPin[]; lines?: boolean};
export const MAP_ZOOM = {min: 5, max: 11, initial: 8};
export const MAP_PIN_LABEL: Record<GuideMapPinKind, string> = {stop: 'Stop', start: 'Start', npc: 'Talk to', fight: 'Fight', 'fight-melee': 'Fight with Melee', 'fight-ranged': 'Fight with Ranged', 'fight-magic': 'Fight with Magic', item: 'Pick up', dig: 'Dig', search: 'Search', cutscene: 'Cutscene', bank: 'Bank', teleport: 'Teleport', danger: 'Danger'};
/** What a stop's icon means, on hover of the pin and list icons: "Fight · any style", "Fight · Melee recommended". */
export const MAP_PIN_HINT: Record<GuideMapPinKind, string> = {stop: 'Walk here', start: 'Start here', npc: 'Talk to', fight: 'Fight · any style', 'fight-melee': 'Fight · Melee recommended', 'fight-ranged': 'Fight · Ranged recommended', 'fight-magic': 'Fight · Magic recommended', item: 'Pick up or take an item', dig: 'Dig', search: 'Search', cutscene: 'Cutscene', bank: 'Bank', teleport: 'Teleport', danger: 'Danger'};
export const isFightKind = (kind: GuideMapPinKind) => kind === 'fight' || kind.startsWith('fight-');
/** Stop kinds in the editor's list, grouped, with the fight styles spelled out. */
export const MAP_PIN_GROUPS: {label: string; kinds: {kind: GuideMapPinKind; label: string}[]}[] = [
  {label: 'Move', kinds: [{kind: 'start', label: 'Start'}, {kind: 'stop', label: 'Stop'}, {kind: 'teleport', label: 'Teleport'}, {kind: 'bank', label: 'Bank'}]},
  {label: 'Do', kinds: [{kind: 'npc', label: 'Talk to'}, {kind: 'item', label: 'Pick up'}, {kind: 'search', label: 'Search'}, {kind: 'dig', label: 'Dig'}, {kind: 'cutscene', label: 'Cutscene'}]},
  {label: 'Fight', kinds: [{kind: 'fight', label: 'Fight (any style)'}, {kind: 'fight-melee', label: 'Fight · Melee'}, {kind: 'fight-ranged', label: 'Fight · Ranged'}, {kind: 'fight-magic', label: 'Fight · Magic'}, {kind: 'danger', label: 'Danger (hazard)'}]},
];
/** Each stop kind's icon, in one place: the game's own art wherever it has an equivalent (public/icons/game and the
 * map-function sprites in public/icons/map/game, built from the game cache; item art from public/items). Plain stops
 * (a boot) and cutscenes keep the site's drawings, as the game has nothing for them. */
export const MAP_PIN_ICON: Record<GuideMapPinKind, string | null> = {
  stop: '/icons/map/step.png', start: '/icons/map/game/1454.png', npc: '/icons/game/chat.png', fight: '/icons/game/hitsplat.png', 'fight-melee': '/icons/game/fight-melee.png',
  'fight-ranged': '/icons/game/fight-ranged.png', 'fight-magic': '/icons/game/fight-magic.png', item: '/icons/game/inventory.png', dig: '/items/952.png',
  search: '/icons/game/search.png', cutscene: '/icons/map/cutscene.png', bank: '/items/995.png', teleport: '/icons/spells/lumbridge-home-teleport.png', danger: '/icons/game/skull.png',
};

/** The icon a stop shows: an item stop that lists items shows its first item (the map piece a chest holds), every other
 * stop its kind's icon. `itemImage` gives an item's icon (lib/guides guideItemImage). */
export function stopIcon(pin: Pick<GuideMapPin, 'kind' | 'items'>, itemImage: (id: string) => string | null): string | null {
  const first = pin.kind === 'item' ? pin.items?.[0] : undefined;
  return (first && itemImage(first.id)) || MAP_PIN_ICON[pin.kind];
}

/** Places to jump to while placing stops: town centres and well-known spots (approximate, ground floor). */
export const MAP_PLACES: {name: string; x: number; y: number}[] = [
  {name: 'Lumbridge', x: 3222, y: 3218}, {name: 'Draynor Village', x: 3093, y: 3245}, {name: 'Al Kharid', x: 3293, y: 3180},
  {name: 'Varrock', x: 3213, y: 3428}, {name: 'Grand Exchange', x: 3164, y: 3487}, {name: 'Edgeville', x: 3094, y: 3493},
  {name: 'Barbarian Village', x: 3082, y: 3420}, {name: 'Falador', x: 2965, y: 3380}, {name: 'Port Sarim', x: 3023, y: 3208},
  {name: 'Rimmington', x: 2957, y: 3214}, {name: 'Taverley', x: 2895, y: 3443}, {name: 'Burthorpe', x: 2899, y: 3544},
  {name: 'Catherby', x: 2808, y: 3436}, {name: "Seers' Village", x: 2725, y: 3485}, {name: 'Camelot Castle', x: 2757, y: 3477},
  {name: 'East Ardougne', x: 2662, y: 3305}, {name: 'Yanille', x: 2606, y: 3093}, {name: 'Canifis', x: 3496, y: 3489},
  {name: 'Port Phasmatys', x: 3687, y: 3480}, {name: 'Shilo Village', x: 2852, y: 2955}, {name: 'Brimhaven', x: 2760, y: 3178},
];

/** Route line colours, one per leg in turn: bright on the game map's greens, browns and water, and none of the pins'
 * own gold (a stop no line reaches), red (danger) or green (start). */
export const MAP_LEG_COLOURS = ['#46d9ec', '#f26bdc', '#ff9f40', '#c4e85a', '#8fa8ff'] as const;
/** One leg of the route: walking from stop `from` to the next stop `to`, on one floor. */
export type GuideMapLeg = {from: number; to: number; plane: number; colour: string};

/** The legs to draw between consecutive stops. A leg into a teleport stop is a teleport, not a walk, and a leg between
 * floors (or between the surface and the underground) has no line on either side, so neither is drawn; the legs that are drawn take the colours in turn. */
export function guideMapLegs(map: Pick<GuideMap, 'pins' | 'lines'>): GuideMapLeg[] {
  if (map.lines === false) return [];
  const legs: GuideMapLeg[] = [];
  for (let i = 1; i < map.pins.length; i++) {
    const a = map.pins[i - 1], b = map.pins[i];
    if (b.kind === 'teleport' || a.plane !== b.plane || onSurface(a) !== onSurface(b) || (a.x === b.x && a.y === b.y)) continue;
    legs.push({from: i - 1, to: i, plane: b.plane, colour: MAP_LEG_COLOURS[legs.length % MAP_LEG_COLOURS.length]});
  }
  return legs;
}
/** Each stop's colour: the colour of the leg that ends there, or null for a stop no line reaches. */
export function guideMapStopColours(map: Pick<GuideMap, 'pins' | 'lines'>): (string | null)[] {
  const colours: (string | null)[] = map.pins.map(() => null);
  for (const leg of guideMapLegs(map)) colours[leg.to] = leg.colour;
  return colours;
}

/** The part of the route a chosen stop focuses: the leg that ends at it (the first stop takes the leg it starts), and
 * the stops at either end. A stop no walking leg reaches (a teleport, a floor change, route lines off) is shown alone. */
export function guideMapFocus(map: Pick<GuideMap, 'pins' | 'lines'>, stop: number): {leg: GuideMapLeg | null; stops: number[]} {
  const legs = guideMapLegs({pins: map.pins}), leg = legs.find(l => l.to === stop) ?? (stop === 0 ? legs.find(l => l.from === 0) : undefined);
  if (!leg) return {leg: null, stops: [stop]};
  const drawn = guideMapLegs(map).find(l => l.from === leg.from && l.to === leg.to) ?? null;
  return {leg: drawn, stops: [leg.from, leg.to]};
}

/** An exit the route itself shows: where one stop leads to the next on another floor or in another area (a ladder in a
 * quest maze the travel data lacks), from that stop. Skipped where a known exit already leads the same way. */
export type GuideMapExit = MapExit & {stop: number};
export function guideMapExits(pins: GuideMapPin[], known: MapExit[] = []): GuideMapExit[] {
  const out: GuideMapExit[] = [];
  for (let i = 1; i < pins.length; i++) {
    const a = pins[i - 1], b = pins[i];
    if (b.kind === 'teleport' || (a.plane === b.plane && onSurface(a) === onSurface(b))) continue;
    const from = {x: a.x, y: a.y, plane: a.plane}, to = {x: b.x, y: b.y, plane: b.plane};
    if (known.some(e => e.from.plane === a.plane && far(e.from, a) <= 4 && e.to.plane === b.plane && onSurface(e.to) === onSurface(b))) continue;
    out.push({from, to, name: 'Next stop', dir: exitDirection(from, to), stop: i});
  }
  return out;
}

const finite = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/** A stop's optional details: instructions of up to 240 characters, up to 8 known items with whole quantities (each item
 * once), up to 8 chat options of up to 100 characters (blank lines are dropped) and a note of up to 200 characters. */
function parseStopDetails(p: Record<string, unknown>, isItem: (id: string) => boolean): Pick<GuideMapPin, 'items' | 'dialogue' | 'note' | 'via' | 'text'> {
  const L = MAP_STOP_LIMITS, out: Pick<GuideMapPin, 'items' | 'dialogue' | 'note' | 'via' | 'text'> = {};
  if (p.text !== undefined) {
    if (typeof p.text !== 'string' || p.text.length > L.text) throw Error(`Keep what to do at each stop to ${L.text} characters.`);
    if (p.text.trim()) out.text = p.text.trim();
  }
  if (p.items !== undefined) {
    const items = p.items;
    if (!Array.isArray(items) || items.length > L.items || items.some(i => !i || typeof i !== 'object' || typeof i.id !== 'string' || !isItem(i.id) || !finite(i.quantity, 1, L.quantity)) || new Set(items.map(i => i.id)).size !== items.length) throw Error(`Use up to ${L.items} known items on a stop, each once, with a quantity from 1 to 1,000,000.`);
    if (items.length) out.items = items.map(i => ({id: i.id as string, quantity: i.quantity as number}));
  }
  if (p.dialogue !== undefined) {
    const lines = p.dialogue;
    if (!Array.isArray(lines) || lines.some(l => typeof l !== 'string' || l.length > L.line)) throw Error(`Keep each chat option to ${L.line} characters.`);
    const kept = (lines as string[]).map(l => l.trim()).filter(Boolean);
    if (kept.length > L.dialogue) throw Error(`Use up to ${L.dialogue} chat options on a stop.`);
    if (kept.length) out.dialogue = kept;
  }
  if (p.note !== undefined) {
    if (typeof p.note !== 'string' || p.note.length > L.note) throw Error(`Keep each stop note to ${L.note} characters.`);
    if (p.note.trim()) out.note = p.note.trim();
  }
  if (p.via !== undefined) {
    if (typeof p.via !== 'string' || p.via.length > L.via) throw Error(`Keep how to get to a stop to ${L.via} characters.`);
    if (p.via.trim() && p.kind === 'teleport') out.via = p.via.trim();
  }
  return out;
}

/** Check a map section from the editor: up to 20 stops, short labels, a known zoom and floor. `isItem` says which item ids
 * a stop may list (the guide item catalogue). */
export function parseGuideMap(v: Record<string, unknown>, isItem: (id: string) => boolean = id => /^\d{1,6}$/.test(id)): GuideMap {
  if (typeof v.title !== 'string' || v.title.length > 80) throw Error('Keep the map title to 80 characters.');
  if (!finite(v.x, 0, 12800) || !finite(v.y, 0, 12800) || !finite(v.plane, 0, 3) || !finite(v.zoom, MAP_ZOOM.min, MAP_ZOOM.max)) throw Error('Choose where the map opens.');
  const pins = v.pins;
  if (!Array.isArray(pins) || pins.length > 20) throw Error('Use up to 20 stops on a map.');
  if (v.lines !== undefined && typeof v.lines !== 'boolean') throw Error('Choose whether the map shows route lines.');
  // Lines are on unless turned off, so only `false` is stored.
  return {title: v.title.trim(), x: v.x, y: v.y, plane: v.plane, zoom: v.zoom, ...(v.lines === false ? {lines: false} : {}), pins: pins.map((p: Record<string, unknown>) => {
    if (!p || typeof p !== 'object' || !finite(p.x, 0, 12800) || !finite(p.y, 0, 12800) || !finite(p.plane, 0, 3)) throw Error('Place every stop on the map.');
    if (typeof p.label !== 'string' || p.label.length > 60) throw Error('Keep each stop label to 60 characters.');
    if (!(MAP_PIN_KINDS as readonly string[]).includes(String(p.kind))) throw Error('Choose a kind for every stop.');
    return {x: p.x, y: p.y, plane: p.plane, label: p.label.trim(), kind: p.kind as GuideMapPinKind, ...parseStopDetails(p, isItem)};
  })};
}
