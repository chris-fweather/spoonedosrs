/** Shared Leaflet pieces for maps of the game world (guide maps and the world map). Import only from components that
 * load lazily, so Leaflet stays out of every other page. */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map-canvas.css';
import {EXIT_ZOOM, exitChangesArea, exitDetail, exitLabel, type Box, type MapExit} from '@/lib/world-map-exits';
import {MARKER_PRIORITY, markerSize, type Footprint} from '@/lib/world-map-markers';
import {GAME_ICON, GAME_SPRITE, gameSpriteSize} from '@/lib/world-map-game-icons';
import {mapAttribution, tileUrl, TILE_VERSION} from '@/lib/map-tile-source';
import type {GameMap} from '@/lib/world-maps';
import type {Tile} from '@/lib/world-map-routing';

/** Game tiles as map units: at zoom 6 one tile is one pixel, and each zoom level doubles it. */
export const GAME_CRS = L.extend({}, L.CRS.Simple, {scale: (z: number) => 2 ** (z - 6), zoom: (s: number) => Math.log2(s) + 6});
/** The centre of a game tile. */
export const tileLatLng = (x: number, y: number) => L.latLng(y + .5, x + .5);
/** The game tile under a map position. */
export const latLngTile = (p: L.LatLng) => ({x: Math.floor(p.lng), y: Math.floor(p.lat)});
/** A box of game tiles as map bounds. */
export const boxBounds = (b: Box) => L.latLngBounds(L.latLng(b.y0, b.x0), L.latLng(b.y1, b.x1));
/** Credits whoever made the tiles this deployment serves (lib/map-tile-source.ts). */
export const MAP_ATTRIBUTION = mapAttribution();
/** Tiles at zoom 10 are the most detailed the tile set has; closer zooms scale them up. */
export const MAX_NATIVE_ZOOM = 10;

const TileSource = L.TileLayer.extend({getTileUrl(this: L.TileLayer & {options: {plane: number; map?: number}}, c: L.Coords) {return tileUrl(c.z - 6, this.options.plane, c.x, -1 - c.y, TILE_VERSION, this.options.map);}});
/** Terrain for one floor of one of the game's world maps (lib/world-maps.ts), served through /api/map-tile; only the
 * squares inside the map load. */
export function terrainLayer(map: GameMap, plane: number, minZoom: number, maxZoom: number): L.TileLayer {
  return new (TileSource as unknown as new (url: string, o: L.TileLayerOptions & {plane: number; map?: number}) => L.TileLayer)('', {plane, map: map.ownTiles ? map.id : undefined, minZoom, maxZoom, maxNativeZoom: MAX_NATIVE_ZOOM, noWrap: true, bounds: boxBounds(map.bounds), attribution: MAP_ATTRIBUTION, updateWhenZooming: false, keepBuffer: 3});
}
/** Shows a map: the view can pan a little past its edges, and an underground map sits on plain black, the black of its
 * own tiles, so nothing around it shows as a box and zooming never flashes another colour. Every map has the same zoom
 * range (`minZoom`, set again on each switch), so leaving one never keeps another's limits. */
export function showMap(m: L.Map, map: GameMap, minZoom: number) {
  m.setMinZoom(minZoom);
  m.setMaxBounds(boxBounds(map.bounds).pad(.08));
  m.getContainer().classList.toggle('is-dark', map.dark);
}
/** Where a game tile is on the map shown, on the display floor shown: the map position of its centre, or null when the
 * map (or the floor) does not show it. */
export const placeOn = (map: GameMap, plane: number) => (t: Tile): L.LatLng | null => {
  const d = map.toDisplay(t);
  return d && d.plane === plane ? tileLatLng(d.x, d.y) : null;
};

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
  /** Where an exit is drawn (the map shown turns its game tile into a map position); null leaves it out. */
  at?: (t: Tile) => L.LatLng | null;
  /** A click or tap on an exit opens a menu instead (the world map's, with the way through on top): where on the map
   * it was, in pixels from the map's top left. */
  onPick?: (e: MapExit, at: L.Point) => void;
};
/** Draw the exits inside the view (those `at` places on the map shown). Exits closer than half a marker on screen show once; an up and a down
 * on the same spot sit side by side. With a mouse an exit names its destination on hover and goes there on click; on a
 * touch screen a tap names it with a button to go. Returns where the markers are on screen, so other markers can keep
 * clear of them. */
export function drawExits(m: L.Map, group: L.LayerGroup, exits: MapExit[], onExit: (e: MapExit) => void, options: ExitOptions = {}): Footprint[] {
  group.clearLayers();
  const {label = (e: MapExit) => exitLabel(e), minZoom = () => EXIT_ZOOM, offset, onPick, at: place = (t: Tile) => tileLatLng(t.x, t.y)} = options;
  const zoom = m.getZoom(), view = m.getBounds().pad(.2), drawn: (Footprint & {dir: string})[] = [], hover = canHover();
  for (const e of exits) {
    if (zoom < minZoom(e)) continue;
    const at = place(e.from);
    if (!at || !view.contains(at)) continue;
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
