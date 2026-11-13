import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {composeFloor, cutPlaneImage, decode, downscale, insideRoute, isEmpty, sliceMaps, sliceMapTiles, SIZE, upscalePart} from './slice-map-tiles.mjs';
import {tileKey} from '../lib/map-tile.ts';

const blank = () => Buffer.alloc(SIZE * SIZE * 4);
const px = (rgba, x, y) => [...rgba.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4)];
const fill = (rgba, x0, y0, w, h, c) => {for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set(c, (y * SIZE + x) * 4);};
const png = rgba => sharp(rgba, {raw: {width: SIZE, height: SIZE, channels: 4}}).png().toBuffer();
const RED = [200, 0, 0, 255], BLUE = [0, 0, 200, 255];

test('empty tiles are skipped: transparent or RuneLite black', () => {
  assert.ok(isEmpty(blank()));
  const black = blank(); fill(black, 0, 0, SIZE, SIZE, [0, 0, 0, 255]); assert.ok(isEmpty(black));
  const one = blank(); fill(one, 9, 9, 1, 1, RED); assert.ok(!isEmpty(one));
});

test('upper floors draw the ground floor under them at half brightness', () => {
  const ground = blank(), floor = blank();
  fill(ground, 0, 0, SIZE, SIZE, [200, 100, 50, 255]); fill(floor, 0, 0, 10, 10, BLUE);
  const out = composeFloor(ground, floor);
  assert.deepEqual(px(out, 5, 5), BLUE);
  assert.deepEqual(px(out, 50, 50), [100, 50, 25, 255]);
  assert.deepEqual(px(composeFloor(null, floor), 50, 50), [0, 0, 0, 0], 'no ground: still transparent');
});

test('zoom up: part (0,0) is the south-west quarter, part (1,1) the north-east', () => {
  const t = blank(); fill(t, 0, 128, 128, 128, RED); fill(t, 128, 0, 128, 128, BLUE);// red south-west, blue north-east
  assert.deepEqual(px(upscalePart(t, 2, 0, 0), 0, 0), RED); assert.deepEqual(px(upscalePart(t, 2, 0, 0), 255, 255), RED);
  assert.deepEqual(px(upscalePart(t, 2, 1, 1), 100, 100), BLUE);
  assert.ok(isEmpty(upscalePart(t, 2, 0, 1)));
});

test('zoom down: the south-west child lands bottom left, the north-east one top right', async () => {
  const red = blank(), blue = blank(); fill(red, 0, 0, SIZE, SIZE, RED); fill(blue, 0, 0, SIZE, SIZE, BLUE);
  const out = await downscale([[red, null], [null, blue]]);
  assert.deepEqual(px(out, 10, 245), RED); assert.deepEqual(px(out, 245, 10), BLUE); assert.equal(px(out, 10, 10)[3], 0);
});

test('a whole-plane image is cut into region tiles by game coordinates, whatever its corner', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiles-'));
  try {
    // 176 by 176 game tiles with the top-left corner at game (3152, 3440): not on a region edge.
    const width = 3 * SIZE - 64, height = 3 * SIZE - 64, west = 3136 + 16, north = 3264 + 192 - 16;
    const image = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const gx = west + Math.floor(x / 4), gy = north - 1 - Math.floor(y / 4);// the game tile under this pixel
      image.set([gx % 256, gy % 256, 7, 255], (y * width + x) * 4);
    }
    const file = path.join(dir, 'img-0.png');
    writeFileSync(file, await sharp(image, {raw: {width, height, channels: 4}}).png().toBuffer());
    assert.equal(await cutPlaneImage({file, plane: 0, west, north}, path.join(dir, 'regions')), 9);
    // Region 50,51 is game x 3200-3263, y 3264-3327: its top-left pixel is game (3200, 3327), bottom-right (3263, 3264).
    const r = await decode(path.join(dir, 'regions', '0_50_51.png'));
    assert.deepEqual(px(r, 0, 0), [3200 % 256, 3327 % 256, 7, 255]); assert.deepEqual(px(r, 255, 255), [3263 % 256, 3264 % 256, 7, 255]);
    const corner = await decode(path.join(dir, 'regions', '0_49_53.png'));
    assert.equal(px(corner, 0, 0)[3], 0, 'outside the image stays transparent');
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('every zoom names its tiles as the route and the map ask for them', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiles-'));
  try {
    const regions = path.join(dir, 'regions'), out = path.join(dir, 'out');
    // Lumbridge's square (50,50), marked red on the game tile (3222, 3218); plane 1 has only a blue square.
    const ground = blank(); fill(ground, 0, 0, SIZE, SIZE, [40, 120, 40, 255]);
    const gx = 3222 - 50 * 64, gy = 3218 - 50 * 64; fill(ground, gx * 4, (63 - gy) * 4, 4, 4, RED);
    const floor = blank(); fill(floor, 0, 0, 8, 8, BLUE);
    mkdirSync(regions);
    writeFileSync(path.join(regions, '0_50_50.png'), await png(ground));
    writeFileSync(path.join(regions, '1_50_50.png'), await png(floor));
    writeFileSync(path.join(regions, '2_9_9.png'), await png(blank()));// an empty upper floor over no ground: nothing
    const result = await sliceMapTiles({regionsDir: regions, out});
    for (let z = -3; z <= 4; z++) {
      const span = SIZE / 2 ** z, x = Math.floor(3222 / span), y = Math.floor(3218 / span);
      const names = readdirSync(path.join(out, String(z)));
      assert.ok(names.includes(`0_${x}_${y}.png`) && names.includes(`1_${x}_${y}.png`), `zoom ${z}: ${x},${y} in ${names}`);
      assert.ok(names.every(n => !n.endsWith('_9_9.png')), 'no tile from an empty region');
      assert.ok(insideRoute(z, x, y));
      assert.deepEqual(tileKey(new URL(`https://x/api/map-tile?z=${z}&p=0&x=${x}&y=${y}`), 'spooned-2026-11-03'), {z, p: 0, x, y});
      if (z >= 2) {
        // The red game tile is where the map puts it: 2^z px per game tile, top of the image north.
        const s = 2 ** z, t = await decode(path.join(out, String(z), `0_${x}_${y}.png`));
        assert.deepEqual(px(t, (3222 - x * span) * s + s / 2, (span - 1 - (3218 - y * span)) * s + s / 2), RED, `zoom ${z}`);
      }
    }
    assert.equal(readdirSync(path.join(out, '4')).length, 4 * 16, 'plane 0-3 over the ground floor, 16 tiles each');
    const p2 = await decode(path.join(out, '2', '2_50_50.png'));
    assert.deepEqual(px(p2, 100, 100), [20, 60, 20, 255], 'plane 2 with nothing of its own: the ground floor, darkened');
    assert.equal(result.total.count, (1 + 4 + 16 + 5) * 4);
    assert.equal(result.outsideRoute, 0);
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('each world map is drawn from its own squares and zones at their display positions', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tiles-'));
  try {
    const regions = path.join(dir, 'regions'), out = path.join(dir, 'out');
    mkdirSync(regions);
    const solid = c => {const b = blank(); fill(b, 0, 0, SIZE, SIZE, c); return png(b);};
    const GREEN = [0, 200, 0, 255], OLIVE = [100, 100, 0, 255];
    writeFileSync(path.join(regions, '0_50_50.png'), await solid(RED));// the surface
    writeFileSync(path.join(regions, '1_50_50.png'), await solid(GREEN));// its 1st floor
    // A dungeon square at y 9600: south-west zone blue, the rest olive.
    const dungeon = blank(); fill(dungeon, 0, 0, SIZE, SIZE, OLIVE); fill(dungeon, 0, SIZE - 32, 32, 32, BLUE);
    writeFileSync(path.join(regions, '0_50_150.png'), await png(dungeon));
    writeFileSync(path.join(regions, '0_70_150.png'), await solid(OLIVE));// on no map of the game
    writeFileSync(path.join(regions, 'worldmaps.json'), JSON.stringify([
      {id: 0, key: 'main', name: 'Gielinor Surface', surface: true, origin: [3232, 3232, 0], squares: [[0, 1, 50, 50, 50, 50]], zones: []},
      // The dungeon's south-west zone (square 50,150 zone 0,0), moved to square 51,51 zone 2,3 of its map.
      {id: 3, key: 'misthalin_underground', name: 'Misthalin Underground', surface: false, origin: [0, 0, 0], squares: [], zones: [[0, 1, 50, 150, 0, 0, 51, 51, 2, 3]]},
    ]));
    const {maps, totals} = await sliceMaps({regionsDir: regions, out, work: path.join(dir, 'work')});
    assert.deepEqual(maps.map(m => [m.id, m.name, m.planes]), [[0, 'Gielinor Surface', 2], [3, 'Misthalin Underground', 1], [-1, 'Other areas', 1]]);
    const under = maps[1];
    assert.deepEqual(under.bounds, [51 * 64 + 16, 51 * 64 + 24, 51 * 64 + 24, 51 * 64 + 32]);
    assert.deepEqual(under.home, [50 * 64 + 4, 150 * 64 + 4, 0], 'opens on its one zone, in game tiles');
    const t = await decode(path.join(out, '3', '2', '0_51_51.png'));
    // Display zone 2,3 of the square: 64 px from the left, 128 px from the top (rows 4 to 7 from the top are zones 3 to 0).
    assert.deepEqual(px(t, 64 + 5, 128 + 5), BLUE);
    assert.equal(px(t, 10, 10)[3], 0, 'black (transparent) around it');
    assert.equal(px(t, 64 + 40, 128 + 5)[3], 0, 'the olive rest of the dungeon square is not on this map');
    assert.deepEqual(px(await decode(path.join(out, '0', '2', '1_50_50.png')), 9, 9), GREEN, 'the surface keeps its upper floors');
    assert.ok(readdirSync(path.join(out, '-1', '2')).includes('0_70_150.png'), 'other areas stay where they are');
    assert.ok(totals.count > 0 && totals.outsideRoute === 0);
  } finally {rmSync(dir, {recursive: true, force: true});}
});
