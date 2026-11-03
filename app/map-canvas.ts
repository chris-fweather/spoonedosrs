/** Shared Leaflet pieces for maps of the game world (guide maps and the world map). Import only from components that
 * load lazily, so Leaflet stays out of every other page. */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map-canvas.css';
import {EXIT_ZOOM, exitChangesArea, exitDetail, exitLabel, type Box, type MapExit} from '@/lib/world-map-exits';
import {MARKER_PRIORITY, markerSize, type Footprint} from '@/lib/world-map-markers';
import {GAME_ICON, GAME_SPRITE, gameSpriteSize} from '@/lib/world-map-game-icons';

/** Game tiles as map units: at zoom 6 one tile is one pixel, and each zoom level doubles it. */
export const GAME_CRS = L.extend({}, L.CRS.Simple, {scale: (z: number) => 2 ** (z - 6), zoom: (s: number) => Math.log2(s) + 6});
/** The centre of a game tile. */
export const tileLatLng = (x: number, y: number) => L.latLng(y + .5, x + .5);
/** The game tile under a map position. */
export const latLngTile = (p: L.LatLng) => ({x: Math.floor(p.lng), y: Math.floor(p.lat)});
/** The mapped surface of the game world, plus the underground areas north of it. */
export const WORLD = L.latLngBounds(tileLatLng(1024, 1216), tileLatLng(4415, 12799));
/** A box of game tiles as map bounds. */
export const boxBounds = (b: Box) => L.latLngBounds(L.latLng(b.y0, b.x0), L.latLng(b.y1, b.x1));
export const MAP_ATTRIBUTION = 'Map tiles: <a href="https://github.com/mejrs/layers_osrs" target="_blank" rel="noreferrer">Mejrs</a> · © Jagex';
/** Tiles at zoom 10 are the most detailed the tile set has; closer zooms scale them up. */
export const MAX_NATIVE_ZOOM = 10;

const TileSource = L.TileLayer.extend({getTileUrl(this: L.TileLayer & {options: {plane: number}}, c: L.Coords) {return `/api/map-tile?z=${c.z - 6}&p=${this.options.plane}&x=${c.x}&y=${-1 - c.y}`;}});
/** Terrain for one floor, served through /api/map-tile; only squares touching `area` load. */
export function terrainLayer(plane: number, minZoom: number, maxZoom: number, area?: Box): L.TileLayer {
  return new (TileSource as unknown as new (url: string, o: L.TileLayerOptions & {plane: number}) => L.TileLayer)('', {plane, minZoom, maxZoom, maxNativeZoom: MAX_NATIVE_ZOOM, noWrap: true, bounds: area ? boxBounds(area) : WORLD, attribution: MAP_ATTRIBUTION, updateWhenZooming: false, keepBuffer: 3});
}

/** Keeps a map inside one area: it cannot pan out of the area or zoom out past the whole area, and anything around the
 * area (a far-out terrain square also holds the neighbouring underground blocks) is covered in the map's background. */
export function areaFrame(m: L.Map, minZoom: number) {
  const pane = m.createPane('area-mask');
  pane.style.zIndex = '250';
  pane.style.pointerEvents = 'none';
  let mask: L.Polygon | null = null, area: Box | null = null;
  const fit = () => {
    if (!area || !m.getSize().x) return;
    m.setMinZoom(Math.min(m.getMaxZoom(), Math.max(minZoom, m.getBoundsZoom(boxBounds(area), false))));
  };
  m.on('resize', fit);
  return {
    /** Move the frame to a new area; the caller then moves the view into it. */
    set(next: Box) {
      area = next;
      const far = 1e5, ring = (b: Box) => [L.latLng(b.y0, b.x0), L.latLng(b.y1, b.x0), L.latLng(b.y1, b.x1), L.latLng(b.y0, b.x1)];
      mask?.remove();
      mask = L.polygon([ring({x0: -far, y0: -far, x1: far, y1: far}), ring(next)], {pane: 'area-mask', stroke: false, fillColor: '#0e0d0b', fillOpacity: 1, interactive: false}).addTo(m);
      m.setMaxBounds(boxBounds(next).pad(.04));
      fit();
    },
  };
}

// Exit markers, as the game's world map draws them: its Dungeon icon on a way into an area (or down), its Map link arrow
// on the way back up, never in a box.
const exitHtml = (e: MapExit) => `<img class="map-exit-glyph is-pixel" src="${GAME_ICON(e.dir === 'up' ? GAME_SPRITE.mapLink : GAME_SPRITE.dungeon)}" alt="">`;
/** Whether this device hovers (a mouse): markers then name themselves on hover, and a tap elsewhere asks first. */
export const canHover = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
/** A tooltip over a marker: a bold first line and an optional second. */
export const tipHtml = (title: string, detail = '') => `<b>${escapeHtml(title)}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;

export type ExitOptions = {
  /** What an exit says on hover or tap ("Climb up — Lumbridge 1st floor"). */
  label?: (e: MapExit) => string;
  /** The closest zoom at which an exit shows (default EXIT_ZOOM). */
  minZoom?: (e: MapExit) => number;
  /** Moves chosen exits aside, in pixels (a guide stop drawn on the same tile). */
  offset?: (e: MapExit) => number;
  /** A click or tap on an exit opens a menu instead (the world map's, with the way through on top): where on the map
   * it was, in pixels from the map's top left. */
  onPick?: (e: MapExit, at: L.Point) => void;
};
/** Draw the exits on this floor inside the view. Exits closer than half a marker on screen show once; an up and a down
 * on the same spot sit side by side. With a mouse an exit names its destination on hover and goes there on click; on a
 * touch screen a tap names it with a button to go. Returns where the markers are on screen, so other markers can keep
 * clear of them. */
export function drawExits(m: L.Map, group: L.LayerGroup, exits: MapExit[], onExit: (e: MapExit) => void, options: ExitOptions = {}): Footprint[] {
  group.clearLayers();
  const {label = (e: MapExit) => exitLabel(e), minZoom = () => EXIT_ZOOM, offset, onPick} = options;
  const zoom = m.getZoom(), view = m.getBounds().pad(.2), drawn: (Footprint & {dir: string})[] = [], hover = canHover();
  for (const e of exits) {
    if (zoom < minZoom(e)) continue;
    const at = tileLatLng(e.from.x, e.from.y);
    if (!view.contains(at)) continue;
    const p = m.latLngToContainerPoint(at), size = gameSpriteSize(markerSize(zoom)), close = size * .55;
    if (drawn.some(d => d.dir === e.dir && Math.abs(d.x - p.x) < close && Math.abs(d.y - p.y) < close)) continue;
    const pair = drawn.some(d => d.dir !== e.dir && Math.abs(d.x - p.x) < close && Math.abs(d.y - p.y) < close) || exits.some(o => o !== e && o.dir !== e.dir && o.from.plane === e.from.plane && Math.abs(o.from.x - e.from.x) <= 1 && Math.abs(o.from.y - e.from.y) <= 1);
    const shift = (pair ? (e.dir === 'up' ? -.6 : .6) * size : 0) + (offset?.(e) ?? 0);
    drawn.push({x: p.x + shift, y: p.y, size, priority: exitChangesArea(e) ? MARKER_PRIORITY.exitArea : MARKER_PRIORITY.exitFloor, dir: e.dir});
    const text = label(e), [verb, where] = text.split(' — '), detail = exitDetail(e);
    const marker = L.marker(at, {icon: L.divIcon({className: 'map-exit is-game is-' + e.dir, html: exitHtml(e), iconSize: [size, size], iconAnchor: [size / 2 - shift, size / 2]}), keyboard: true, riseOnHover: true, zIndexOffset: 200});
    marker.on('add', () => {const el = marker.getElement(); el?.setAttribute('aria-label', text); el?.setAttribute('data-exit', e.name);});
    if (hover) marker.bindTooltip(tipHtml(text, detail), {direction: 'top', offset: [shift, -size / 2], className: 'map-tip', opacity: 1});
    if (onPick) marker.on('click', ev => {L.DomEvent.stopPropagation(ev); onPick(e, ev.containerPoint);});
    else if (hover) marker.on('click', ev => {L.DomEvent.stopPropagation(ev); onExit(e);});
    else {
      // A tap names the destination first, so a stray tap never changes floor.
      const card = L.DomUtil.create('div', 'map-exit-card');
      card.innerHTML = `<b>${escapeHtml(where ?? text)}</b><small>${escapeHtml(detail)}</small>`;
      const go = L.DomUtil.create('button', 'btn sm primary map-exit-go', card);
      go.type = 'button';
      go.textContent = verb;
      L.DomEvent.on(go, 'click', ev => {L.DomEvent.stop(ev); m.closePopup(); onExit(e);});
      // A popup of the map's own, not the marker's: panning it into view redraws the markers.
      const popup = L.popup({className: 'map-exit-pop', closeButton: false, offset: [shift, -size / 2 + 4], autoPanPadding: [16, 16]}).setLatLng(at).setContent(card);
      marker.on('click', ev => {L.DomEvent.stopPropagation(ev); popup.openOn(m);});
    }
    marker.addTo(group);
  }
  return drawn;
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** Wheel zoom in whole steps: one mouse-wheel notch is one level, a trackpad needs a short swipe, and a fast flick
 * queues at most one more step while a zoom animates. Leaflet's own wheel zoom rounds small deltas away at zoomSnap 1,
 * so some notches did nothing while trackpads jumped. Call with scrollWheelZoom: false on the map. */
export function stepWheelZoom(m: L.Map, active: () => boolean = () => true) {
  let acc = 0, idle = 0, busy = false, at: L.Point | null = null;
  const step = () => {
    if (Math.abs(acc) < 40 || !at) return;
    const zoom = m.getZoom() + (acc < 0 ? 1 : -1);
    acc = 0;
    if (zoom < m.getMinZoom() || zoom > m.getMaxZoom()) return;
    busy = true;
    window.setTimeout(() => { busy = false; }, 600);
    m.setZoomAround(at, zoom);
  };
  m.on('zoomend', () => { busy = false; step(); });
  m.getContainer().addEventListener('wheel', e => {
    if (!active()) return;
    e.preventDefault();
    const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1);
    window.clearTimeout(idle);
    idle = window.setTimeout(() => { acc = 0; }, 250);
    at = m.mouseEventToContainerPoint(e);
    acc = busy ? Math.max(-40, Math.min(40, acc + d)) : acc + d;
    if (!busy) step();
  }, {passive: false});
}
