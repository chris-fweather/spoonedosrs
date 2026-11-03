import {mapTile} from '@/lib/map-tile';

/** Map tiles (lib/map-tile.ts). The Worker entry answers these first, with the edge cache; this route is the fallback. */
export function GET(request: Request) {
  return mapTile(request);
}
