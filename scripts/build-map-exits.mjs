// Builds public/world-map/exits.json from the world map data: the stairs, ladders, trapdoors and entrances players click
// to change floor or go underground, and the walkable extent of each underground area (so the map view can stay inside
// it). Run after scripts/build-world-map.mjs:
//
//   node --import ./scripts/register-tests.mjs scripts/build-map-exits.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {areaExtent, undergroundLinks} from '../lib/world-map-areas.ts';
import {findExits, onSurface} from '../lib/world-map-exits.ts';
import {decodeCollision} from '../lib/world-map-routing.ts';

const OUT = 'public/world-map';
const data = JSON.parse(readFileSync(`${OUT}/travel.json`, 'utf8'));
const collision = decodeCollision(new Uint8Array(gunzipSync(readFileSync(`${OUT}/collision.dat`))));
const exits = findExits(data);

// One area per walkable underground region an exit leads into or out of; tiles already inside a found area are skipped.
const links = undergroundLinks(data), areas = [], covered = new Set();
for (const t of exits.flatMap(e => [e.from, e.to])) {
  const k = `${t.x},${t.y},${t.plane}`;
  if (onSurface(t) || covered.has(k)) continue;
  const {box, tiles} = areaExtent(collision, links, t);
  for (const tile of tiles) covered.add(tile);
  if (!areas.some(a => a[0] === box.x0 && a[1] === box.y0 && a[2] === box.x1 && a[3] === box.y1)) areas.push([box.x0, box.y0, box.x1, box.y1]);
}

const names = [...new Set(exits.map(e => e.name))].sort();
const index = new Map(names.map((n, i) => [n, i]));
const file = {v: 1, names, areas, exits: exits.map(e => [e.from.x, e.from.y, e.from.plane, e.to.x, e.to.y, e.to.plane, index.get(e.name)])};
writeFileSync(`${OUT}/exits.json`, JSON.stringify(file));
console.log(`${exits.length} exits, ${areas.length} underground areas`);
