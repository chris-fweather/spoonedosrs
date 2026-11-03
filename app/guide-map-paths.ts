/** Walking paths for guide map route lines, worked out in the world map's Web Worker. One worker serves every map on the
 * page; it starts (and loads the collision data) only when a map with route lines is on screen, and each leg is asked
 * for once. A leg with no walking path, or any failure, resolves to null and keeps a straight line. */
import {pathKey, type PathPoint} from '@/lib/guide-map-paths';
import type {Tile} from '@/lib/world-map-routing';
import type {PlanReply, PlanRequest} from './world-map-route.worker';

let worker: Worker | null = null, next = 0;
const waiting = new Map<number, (r: PlanReply) => void>(), cache = new Map<string, Promise<PathPoint[] | null>>();

function ask(legs: {from: Tile; to: Tile}[]): Promise<(PathPoint[] | null)[]> {
  const none = () => legs.map(() => null);
  if (typeof Worker === 'undefined') return Promise.resolve(none());
  return new Promise(resolve => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./world-map-route.worker.ts', import.meta.url), {type: 'module'});
        worker.onmessage = (e: MessageEvent<PlanReply>) => {waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id);};
        worker.onerror = () => {for (const [id, done] of waiting) done({id, ok: false, error: 'stopped'}); waiting.clear(); worker?.terminate(); worker = null;};
      }
      const id = ++next;
      waiting.set(id, reply => resolve(reply.ok && reply.paths ? reply.paths : none()));
      worker.postMessage({type: 'paths', legs, id} as PlanRequest);
    } catch {resolve(none());}
  });
}

/** The walking path for each leg, from the cache or one request for the legs not asked for yet. */
export function walkingPaths(legs: {from: Tile; to: Tile}[]): Promise<(PathPoint[] | null)[]> {
  const fresh = legs.filter(l => !cache.has(pathKey(l.from, l.to)));
  if (fresh.length) {
    const asked = ask(fresh);
    fresh.forEach((l, i) => cache.set(pathKey(l.from, l.to), asked.then(paths => paths[i] ?? null)));
  }
  return Promise.all(legs.map(l => cache.get(pathKey(l.from, l.to))!));
}
