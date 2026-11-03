'use client';
/** The ways to reach each teleport stop on a guide map, from the travel data (public/world-map/travel.json, shared with the
 * world map and cached by the browser). Loaded once per page, and only for a map that has a teleport stop. */
import {useEffect, useMemo, useState} from 'react';
import {teleportsNear, type StopTeleport} from '@/lib/guide-map-teleports';
import type {GuideMapPin} from '@/lib/guide-map';
import type {TravelData} from '@/lib/world-map-routing';

type Teleports = Pick<TravelData, 'groups' | 'names' | 'teleports'>;
let loading: Promise<Teleports | null> | null = null;
function load() {
  loading ??= fetch('/world-map/travel.json').then(r => r.ok ? r.json() as Promise<TravelData> : null).then(d => d ? {groups: d.groups, names: d.names, teleports: d.teleports} : null).catch(() => {loading = null; return null;});
  return loading;
}
/** For each stop, the teleports landing there (teleport stops only; an empty list for the others and until the data arrives). */
export function useStopTeleports(pins: GuideMapPin[]): StopTeleport[][] {
  const wanted = pins.some(p => p.kind === 'teleport'), [data, setData] = useState<Teleports | null>(null);
  useEffect(() => {if (!wanted) return; let live = true; void load().then(d => {if (live) setData(d);}); return () => {live = false;};}, [wanted]);
  return useMemo(() => pins.map(p => p.kind === 'teleport' && data ? teleportsNear(data, p, p.label) : []), [pins, data]);
}
