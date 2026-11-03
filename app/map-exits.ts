'use client';
/** The exits and underground areas for the maps (public/world-map/exits.json), loaded once per page and shared by the
 * world map and every guide map on it. */
import {useEffect, useState} from 'react';
import {readExits, type Box, type ExitsFile, type MapExit} from '@/lib/world-map-exits';

export type MapExits = {exits: MapExit[]; areas: Box[]};
let loading: Promise<MapExits | null> | null = null;
function load() {
  loading ??= fetch('/world-map/exits.json').then(r => r.ok ? r.json() as Promise<ExitsFile> : null).then(f => f ? readExits(f) : null).catch(() => {loading = null; return null;});
  return loading;
}
/** The exits and areas, or null until they arrive (maps work without them: the surface needs neither). */
export function useMapExits(): MapExits | null {
  const [data, setData] = useState<MapExits | null>(null);
  useEffect(() => {let live = true; void load().then(d => {if (live) setData(d);}); return () => {live = false;};}, []);
  return data;
}
