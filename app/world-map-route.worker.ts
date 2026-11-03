/** Route planning for the world map, and walking paths for guide map route lines, off the page's main thread. Loads the
 * collision map and travel data once. */
import {walkLinks, walkingPath, type PathPoint, type WalkLinks} from '../lib/guide-map-paths';
import {buildGraph, decodeCollision, planRoutes, RouteError, teleportArrivals, type Collision, type TeleportArrival, type Tile, type TravelData, type TravelGraph} from '../lib/world-map-routing';
import {parseTravelSettings} from '../lib/world-map-settings';

export type PlanInput = {type: 'load'} | {type: 'plan'; from: Tile; to: Tile; settings: unknown} | {type: 'paths'; legs: {from: Tile; to: Tile}[]} | {type: 'teleports'; settings: unknown};
export type PlanRequest = PlanInput & {id: number};
export type PlanReply = {id: number; ok: true; routes?: ReturnType<typeof planRoutes>; paths?: (PathPoint[] | null)[]; teleports?: TeleportArrival[]} | {id: number; ok: false; error: string};

const scope = self as unknown as {onmessage: ((e: MessageEvent<PlanRequest>) => void) | null; postMessage(m: PlanReply): void};
let loading: Promise<{collision: Collision; data: TravelData}> | null = null, travel: Promise<TravelData> | null = null;
let graph: {key: string; graph: TravelGraph} | null = null;
let doors: WalkLinks | null = null;

async function gunzip(response: Response) {
  if (!response.ok || !response.body) throw Error('The map data could not be loaded.');
  return new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
/** The travel data alone (the Teleports layer needs no collision map). */
function loadTravel() {
  travel ??= fetch('/world-map/travel.json').then(r => {if (!r.ok) throw Error('The map data could not be loaded.'); return r.json() as Promise<TravelData>;}).catch(error => {travel = null; throw error;});
  return travel;
}
function load() {
  loading ??= Promise.all([fetch('/world-map/collision.dat').then(gunzip), loadTravel()])
    .then(([bytes, data]) => ({collision: decodeCollision(bytes), data}))
    .catch(error => {loading = null; throw error;});
  return loading;
}

scope.onmessage = async ({data: request}) => {
  try {
    if (request.type === 'teleports') return scope.postMessage({id: request.id, ok: true, teleports: teleportArrivals(await loadTravel(), parseTravelSettings(request.settings))});
    const {collision, data} = await load();
    if (request.type === 'load') return scope.postMessage({id: request.id, ok: true});
    if (request.type === 'paths') {
      doors ??= walkLinks(data);
      return scope.postMessage({id: request.id, ok: true, paths: request.legs.map(leg => walkingPath(collision, doors!, leg.from, leg.to))});
    }
    const settings = parseTravelSettings(request.settings), key = JSON.stringify(settings);
    if (graph?.key !== key) graph = {key, graph: buildGraph(data, settings)};
    scope.postMessage({id: request.id, ok: true, routes: planRoutes(collision, graph.graph, request.from, request.to)});
  } catch (error) {
    scope.postMessage({id: request.id, ok: false, error: error instanceof RouteError || error instanceof Error ? error.message : 'Something went wrong planning that route.'});
  }
};
