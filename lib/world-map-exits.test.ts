import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {areaExtent, undergroundLinks} from './world-map-areas.ts';
import {SURFACE, areaExits, areaFor, areaWith, backLabel, exitArt, exitDetail, exitAction, exitDirection, exitLabel, exitNear, exitsIn, findExits, inBox, onSurface, readExits, wayOut, type ExitsFile} from './world-map-exits.ts';
import type {Collision, TravelEdge} from './world-map-routing.ts';

const t = (x: number, y: number, plane = 0) => ({x, y, plane});

test('the surface holds the mainland, Zeah, Varlamore and the islands, and none of the underground blocks', () => {
  for (const [x, y] of [[3222, 3218], [1640, 3670], [1700, 3100], [2400, 4000], [3800, 3850], [1100, 2900]]) assert.ok(inBox(SURFACE, x, y), `${x},${y}`);
  for (const [x, y] of [[3210, 9616], [2884, 9798], [3239, 6076], [2400, 4500], [1866, 5323]]) assert.ok(!onSurface({x, y}), `${x},${y}`);
  assert.equal(areaFor(t(3222, 3218)), SURFACE);
});

test('an underground tile takes the smallest known area holding it, padded, or a box around it', () => {
  const areas = [{x0: 3000, y0: 9500, x1: 3400, y1: 9900}, {x0: 3090, y0: 9560, x1: 3130, y1: 9590}];
  const small = areaFor(t(3104, 9576), areas);
  assert.ok(inBox(small, 3104, 9576) && inBox(small, 3090, 9560) && inBox(small, 3129, 9589));
  assert.ok(small.x1 - small.x0 >= 64 && small.x1 - small.x0 < 100, 'a small cellar is framed at least 64 tiles wide');
  assert.deepEqual(areaFor(t(5000, 5000), areas), {x0: 4936, y0: 4936, x1: 5064, y1: 5064});
  // A guide map's underground stops all fit in its area; surface stops and far ones do not stretch it.
  const grown = areaWith(small, [t(3150, 9600), t(3222, 3218), t(4000, 9000)]);
  assert.ok(inBox(grown, 3150, 9600) && grown.y0 > 4000 && grown.x1 < 3300);
  assert.equal(areaWith(SURFACE, [t(3104, 9576)]), SURFACE);
});

test('exits go up, down, underground, back up or across', () => {
  assert.equal(exitDirection(t(3205, 3228, 0), t(3206, 3229, 1)), 'up');
  assert.equal(exitDirection(t(3206, 3229, 1), t(3205, 3228, 0)), 'down');
  assert.equal(exitDirection(t(3210, 3216), t(3210, 9616)), 'down');
  assert.equal(exitDirection(t(3210, 9616), t(3210, 3216)), 'up');
  assert.equal(exitDirection(t(3000, 9600), t(2500, 5000)), 'enter');
});

test('exits say where they lead: the floor of the nearest town, the dungeon, or back to the surface', () => {
  const names = {town: () => 'Lumbridge', area: (x: {x: number}) => x.x === 2884 ? 'Taverley Dungeon' : null};
  const stairs = {from: t(3205, 3228), to: t(3206, 3229, 1), name: 'Climb-up Staircase', dir: 'up' as const};
  assert.equal(exitLabel(stairs, names), 'Climb up — Lumbridge 1st floor');
  assert.equal(exitLabel({from: t(3206, 3229, 1), to: t(3205, 3228), name: 'Climb-down Staircase', dir: 'down'}, names), 'Climb down — Lumbridge ground floor');
  assert.equal(exitLabel(stairs), 'Climb up — 1st floor');
  assert.equal(exitLabel({from: t(2884, 3397), to: t(2884, 9798), name: 'Climb-down Ladder', dir: 'down'}, names), 'Climb down — Taverley Dungeon');
  assert.equal(exitLabel({from: t(3321, 3122), to: t(3305, 9497), name: 'Enter Cave', dir: 'down'}), 'Enter — underground');
  assert.equal(exitLabel({from: t(2884, 9798), to: t(2884, 3397), name: 'Climb-up Ladder', dir: 'up'}, {town: () => 'Taverley'}), 'Climb up — Taverley');
  assert.equal(exitLabel({from: t(3305, 9497), to: t(3321, 3122), name: 'Exit Cave', dir: 'up'}), 'Leave — the surface');
  assert.equal(exitLabel({from: t(3000, 9600), to: t(2500, 5000), name: 'Enter Portal', dir: 'enter'}), 'Enter — another area');
});

test('exit kinds from the name: stairs, ladders, ways underground and other entrances', () => {
  assert.equal(exitArt({name: 'Climb-up Staircase'}), 'stairs');
  assert.equal(exitArt({name: 'Walk-down Stairs'}), 'stairs');
  assert.equal(exitArt({name: 'Climb-down Ladder'}), 'ladder');
  assert.equal(exitArt({name: 'Climb-down Trapdoor'}), 'dungeon');
  assert.equal(exitArt({name: 'Enter Cave entrance'}), 'dungeon');
  assert.equal(exitArt({name: 'Enter Tunnel'}), 'dungeon');
  assert.equal(exitArt({name: 'Enter Passageway'}), 'entrance');
  assert.equal(exitArt({name: 'Use Portal'}), 'entrance');
  assert.equal(exitArt({name: 'Search Well stacked rocks'}), 'entrance');
});

test('the maps draw ways into another area only, never floor changes (as on the game\'s world map)', () => {
  const stairs = {from: t(3205, 3228), to: t(3206, 3229, 1), name: 'Climb-up Staircase', dir: 'up' as const};
  const down = {from: t(3206, 3229, 1), to: t(3205, 3228), name: 'Climb-down Ladder', dir: 'down' as const};
  const taverley = {from: t(2884, 3397), to: t(2884, 9798), name: 'Climb-down Ladder', dir: 'down' as const};
  const out = {from: t(2884, 9798), to: t(2884, 3398), name: 'Climb-up Ladder', dir: 'up' as const};
  const trapdoor = {from: t(3209, 3216), to: t(3208, 9616), name: 'Climb-down Trapdoor', dir: 'down' as const};
  const cave = {from: t(2796, 3615), to: t(2808, 10002), name: 'Enter Cave Entrance', dir: 'down' as const};
  const dungeonStairs = {from: t(3000, 9600), to: t(3001, 9601, 1), name: 'Climb-up Stairs', dir: 'up' as const};
  assert.deepEqual(areaExits([stairs, down, taverley, out, trapdoor, cave, dungeonStairs]), [taverley, out, trapdoor, cave]);
});

test('exit details say what the exit is in a few plain words', () => {
  const d = (name: string, dir: 'up' | 'down' | 'enter' = 'down') => exitDetail({name, dir});
  assert.equal(d('Climb-down Ladder'), 'Ladder · down');
  assert.equal(d('Climb-up Ladder', 'up'), 'Ladder · up');
  assert.equal(d('Climb-up Staircase', 'up'), 'Staircase · up');
  assert.equal(d('Climb Stairs', 'up'), 'Stairs · up');
  assert.equal(d('Climb-up Stairs up', 'up'), 'Stairs · up');
  assert.equal(d('Walk-down Stairs'), 'Stairs · down');
  assert.equal(d('Top-floor Staircase', 'up'), 'Staircase · up');
  assert.equal(d('Climb-down Ladder top'), 'Ladder · down');
  assert.equal(d('Climb Down Trap Door'), 'Trapdoor · down');
  assert.equal(d('Climb-down Trapdoor'), 'Trapdoor · down');
  assert.equal(d('Open Trapdoor'), 'Trapdoor · down');
  assert.equal(d('Climb-up Ship\'s ladder', 'up'), 'Ship\'s ladder · up');
  assert.equal(d('Enter Cave entrance'), 'Cave entrance');
  assert.equal(d('Enter Cave Entrance'), 'Cave entrance');
  assert.equal(d('Enter Tunnel'), 'Tunnel');
  assert.equal(d('Enter Cave'), 'Cave');
  assert.equal(d('Exit Cave Exit', 'up'), 'Cave exit');
  assert.equal(d('Enter Hole'), 'Hole · down');
  assert.equal(d('Cross Gangplank'), 'Gangplank');
  assert.equal(d('Leave Tomb Tomb Door', 'up'), 'Tomb door');
  assert.equal(d('Use A crack'), 'Crack');
  assert.equal(d('Use Spade -> Mole hill'), 'Mole hill');
  assert.equal(d('Jump off End of bridge'), 'End of bridge · down');
  assert.equal(d('Teleport Mage of Zamorak'), 'Mage of Zamorak');
  assert.equal(d('Climb-up Ladder', 'enter'), 'Ladder');
  assert.equal(d('Next stop'), 'Next stop');
});

test('every exit in the game data gets a short, clean detail line', () => {
  const {exits} = readExits(JSON.parse(readFileSync(new URL('../public/world-map/exits.json', import.meta.url), 'utf8')) as ExitsFile);
  assert.ok(exits.length > 1000);
  for (const e of exits) {
    const s = exitDetail(e);
    assert.match(s, /^[A-Z0-9]/, e.name);
    assert.ok(s.length <= 26, `${e.name}: ${s}`);
    assert.doesNotMatch(s, /^(?:\S+-\S+ )|^(?:climb|walk|enter|use|open|go|leave|jump)\b|\b(\w+) \1\b|->|·\s*$/i, `${e.name}: ${s}`);
    if (exitArt(e) === 'ladder' || exitArt(e) === 'stairs') assert.equal(s.endsWith(' · ' + e.dir), e.dir !== 'enter', `${e.name}: ${s}`);
  }
});

test('only floor and area changes become exits, one per staircase', () => {
  const kinds = ['passage', 'boat'], names = ['Climb-up Staircase', 'Climb-down Trapdoor', 'Enter Tunnel', 'Open Large door', 'Set sail'];
  const e = (a: number[], b: number[], name: number, kind = 0): TravelEdge => [a[0], a[1], a[2], b[0], b[1], b[2], 1, kind, name, 0, 0];
  const edges = [
    e([3205, 3228, 0], [3206, 3229, 1], 0), e([3206, 3229, 0], [3206, 3229, 1], 0), // two tiles of one staircase
    e([3210, 3216, 0], [3210, 9616, 0], 1), // trapdoor into the cellar
    e([2900, 3400, 0], [2920, 3400, 0], 2), // a tunnel through a hill stays on the surface: no exit
    e([3213, 3221, 0], [3212, 3221, 0], 3), e([3213, 3221, 0], [1866, 5323, 0], 3), // the castle door, and a quest-state copy of it
    e([3000, 3200, 0], [3000, 9600, 0], 4, 1), // not a passage
  ];
  const exits = findExits({kinds, names, edges});
  assert.deepEqual(exits.map(x => [x.name, x.dir]), [['Climb-up Staircase', 'up'], ['Climb-down Trapdoor', 'down']]);
});

test('the built exits reach the castle floors, its cellar and the Wizards\' Tower basement', () => {
  const {exits, areas} = readExits(JSON.parse(readFileSync('public/world-map/exits.json', 'utf8')) as ExitsFile);
  const castle = exitsIn(exits, 0, {x0: 3200, y0: 3200, x1: 3232, y1: 3235});
  assert.ok(castle.some(x => x.dir === 'up' && x.to.plane === 1), 'castle stairs up');
  const trapdoor = castle.find(x => x.name === 'Climb-down Trapdoor');
  assert.ok(trapdoor && !onSurface(trapdoor.to));
  assert.ok(exitsIn(exits, 1, SURFACE).some(x => x.from.x === 3205 && x.from.y === 3209 && x.dir === 'down'));
  assert.ok(exits.some(x => x.from.x === 3105 && x.from.y === 3162 && x.to.y === 9576), 'Wizards\' Tower ladder');
  // The basement's area frames the basement and has a way back out to the tower.
  const basement = areaFor(t(3104, 9576), areas);
  assert.ok(basement.x1 - basement.x0 < 200 && basement.y1 - basement.y0 < 200);
  assert.deepEqual(wayOut(exits, basement, t(3104, 9576), areas), {x: 3105, y: 3162, plane: 0});
  // Melzar's Maze basement is in no known area: its box holds other dungeons' ladders, so there is no way out to offer.
  assert.equal(wayOut(exits, areaFor(t(2931, 9650), areas), t(2931, 9650), areas), null);
  // Every exit leads somewhere a map can show.
  for (const x of exits) assert.ok(inBox(areaFor(x.to, areas), x.to.x, x.to.y));
});

test('the back control names the way back to the surface ground floor', () => {
  assert.equal(backLabel({plane: 0, at: t(3222, 3218)}), null);
  assert.equal(backLabel({plane: 1, at: t(3222, 3218)}), 'Down to the ground floor');
  assert.equal(backLabel({plane: 0, at: t(3104, 9576)}), 'Back to the surface');
});

test('an area is every tile reachable on foot and by its own stairs, and never the surface', () => {
  // A 5x5 room at 3100,9570 with a staircase to a 3x3 room upstairs; walls everywhere else.
  const open = new Set<string>();
  for (let x = 3100; x < 3105; x++) for (let y = 9570; y < 9575; y++) open.add(`${x},${y},0`);
  for (let x = 3140; x < 3143; x++) for (let y = 9570; y < 9573; y++) open.add(`${x},${y},1`);
  const c: Collision = {flag: (x, y, p, f) => open.has(`${x},${y},${p}`) && open.has(f ? `${x + 1},${y},${p}` : `${x},${y + 1},${p}`)};
  const links = undergroundLinks({kinds: ['passage'], edges: [[3104, 9574, 0, 3140, 9570, 1, 1, 0, 0, 0, 0], [3100, 9570, 0, 3100, 3200, 0, 1, 0, 0, 0, 0]]});
  const {box, tiles} = areaExtent(c, links, t(3100, 9570));
  assert.deepEqual(box, {x0: 3100, y0: 9570, x1: 3143, y1: 9575});
  assert.equal(tiles.size, 25 + 9);
});

test('a dungeon icon stands for the way in that starts beside it, and says Enter or Exit', () => {
  const cave = {from: t(3169, 3172), to: t(3169, 9572), name: 'Enter Cave', dir: 'down' as const};
  const stairs = {from: t(3170, 3171), to: t(3170, 3171, 1), name: 'Climb-up Staircase', dir: 'up' as const};
  const ladder = {from: t(3169, 9572), to: t(3169, 3172), name: 'Climb-up Ladder', dir: 'up' as const};
  const exits = [stairs, cave, ladder];
  assert.equal(exitNear(exits, t(3171, 3174), SURFACE), cave, 'a floor change nearer the icon is not a way in');
  assert.equal(exitNear(exits, t(3180, 3174), SURFACE), null, 'none within range');
  assert.equal(exitNear(exits, t(3171, 3174, 1), SURFACE), null, 'another floor');
  const below = {x0: 3100, y0: 9500, x1: 3250, y1: 9650};
  assert.equal(exitNear(exits, t(3168, 9571), below), ladder);
  assert.equal(exitNear(exits, t(3168, 9571), SURFACE), null, 'outside the area shown');
  assert.equal(exitAction(cave), 'Enter');
  assert.equal(exitAction(ladder), 'Exit');
  assert.equal(exitAction({from: t(3000, 9600), to: t(2500, 5000)}), 'Enter');
});
