// Map tiles through the built Worker (lib/map-tile.ts): the version the build serves, its R2 copy and the edge cache,
// with GitHub mocked. Our own render (served since 1.0.0) is read from R2 only; Mejrs' path is checked when a build serves it.
import assert from 'node:assert/strict';
import {TILE_VERSION, hasMaps, SURFACE_MAP} from '../lib/map-tile-source.ts';
import {startWorker} from './worker-harness.mjs';

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
let githubUp = true;
const w = await startWorker({r2: ['MAP_TILES'], outbound: request => {
  const url = new URL(request.url);
  if (url.hostname !== 'raw.githubusercontent.com') return new Response('blocked', {status: 503});
  if (!githubUp) return new Response('down', {status: 503});
  return url.pathname.endsWith('/2/0_50_50.png') || url.pathname.endsWith('/2/0_51_50.png') ? new Response(PNG) : new Response(null, {status: 404});
}});
try {
  const maps = hasMaps(TILE_VERSION), own = TILE_VERSION !== 'mejrs-master';
  const tile = (q, v = TILE_VERSION) => w.fetch(`${w.origin}/api/map-tile?${q}${maps ? `&m=${SURFACE_MAP}` : ''}&v=${v}`);
  const bucket = await w.mf.getR2Bucket('MAP_TILES');
  // Our own render is uploaded ahead of time (docs/map-tiles.md): put one square in the bucket the way the workflow does.
  if (own) await bucket.put(`${TILE_VERSION}/${maps ? SURFACE_MAP + '/' : ''}2/0_50_50.png`, PNG);
  const first = await tile('z=2&p=0&x=50&y=50');
  assert.equal(first.status, 200); assert.equal(first.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), PNG);
  if (TILE_VERSION === 'mejrs-master') {
    assert.ok(w.upstream.some(u => u.endsWith('/mapsquares/-1/2/0_50_50.png')), 'fetched from Mejrs on GitHub');
    for (let i = 0; i < 20 && !(await bucket.head(`${TILE_VERSION}/2/0_50_50.png`)); i++) await new Promise(r => setTimeout(r, 50));
    assert.ok(await bucket.head(`${TILE_VERSION}/2/0_50_50.png`), 'kept in R2 under its version');
    githubUp = false;
    assert.equal((await tile('z=2&p=0&x=50&y=50')).status, 200, 'served without GitHub');
    const cold = await tile('z=2&p=0&x=51&y=50');
    assert.equal(cold.status, 502); assert.equal(cold.headers.get('Cache-Control'), 'no-store');
    githubUp = true;
    assert.equal((await tile('z=2&p=0&x=52&y=50')).status, 404, 'open sea');
  }
  if (own) {
    assert.equal((await tile('z=2&p=0&x=51&y=50')).status, 404, 'a square not in the bucket is open sea');
    assert.equal(w.upstream.filter(u => u.includes('raw.githubusercontent.com')).length, 0, 'our own tiles never go to GitHub');
  }
  assert.equal((await tile('z=2&p=0&x=999&y=1')).status, 404, 'outside the world');
  assert.equal((await tile('z=9&p=0&x=1&y=1')).status, 400);
  // The address's version is only for browsers: an old address still gets the version the site serves.
  assert.equal((await tile('z=2&p=0&x=50&y=50', 'spooned-old')).status, 200);
  console.log(`PASS map tiles: ${TILE_VERSION} through R2 and the edge cache, ${own ? 'R2 only' : 'GitHub down handled'}, open sea, bad keys`);
} finally {await w.dispose();}
