'use client';
/** The game's world maps for the tiles this deployment serves (lib/world-maps.ts), loaded once per page and shared by
 * the world map and every guide map on it. A tile version drawn per map has public/world-map/maps.json (made with its
 * render); a single sheet (Mejrs' tiles, our first render) needs nothing loaded. */
import {useEffect, useState} from 'react';
import {hasMaps, TILE_VERSION} from '@/lib/map-tile-source';
import {readMaps, sheetMaps, type MapsFile, type WorldMaps} from '@/lib/world-maps';
import {worldMapData} from '@/lib/world-map-data';

const SHEET = sheetMaps();
let loading: Promise<WorldMaps> | null = null;
function load() {
  // maps.json describes one render: it is only used with the tiles it was made with.
  loading ??= fetch(worldMapData('maps.json')).then(r => r.ok ? r.json() as Promise<MapsFile> : null)
    .then(f => f && f.version === TILE_VERSION ? readMaps(f) : SHEET)
    .catch(() => {loading = null; return SHEET;});
  return loading;
}
/** The maps, or null while maps.json loads. */
export function useWorldMaps(): WorldMaps | null {
  const [maps, setMaps] = useState<WorldMaps | null>(hasMaps() ? null : SHEET);
  useEffect(() => {
    if (!hasMaps()) return;
    let live = true;
    void load().then(m => {if (live) setMaps(m);});
    return () => {live = false;};
  }, []);
  return maps;
}
