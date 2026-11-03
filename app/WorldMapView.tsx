'use client';
import {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import {GAME_CRS, areaFrame, canHover, drawExits, escapeHtml, latLngTile, stepWheelZoom, terrainLayer, tileLatLng, tipHtml} from './map-canvas';
import {KIND_LABEL, ROUTE_COLOUR, markerIcon, townNear, type MapPlace} from '@/lib/world-map-places';
import type {Route, Tile} from '@/lib/world-map-routing';
import {EXIT_AREA_ZOOM, areaExits, exitDetail, exitLabel, exitNear, exitWhere, exitsIn, inBox, type Box, type MapExit, type PlaceNames} from '@/lib/world-map-exits';
import {MARKER_PRIORITY, declutter, markerSize, type Footprint} from '@/lib/world-map-markers';
import {undergroundName} from '@/lib/world-map-underground';
import {GAME_ICON, GAME_SPRITE, LABEL_MAX_ZOOM, LABEL_ZOOM, gameIconTip, gameIconPriority, gameIconZoom, gameSpriteSize, sameGameIcon, type GameIcon, type GameIconTip, type GameLabel, type IconDetails} from '@/lib/world-map-game-icons';

export const WORLD_ZOOM = {min: 3, max: 11, initial: 7};
/** The closest zoom at which each kind of marker appears, so the overview stays readable. */
const MIN_ZOOM: Record<string, number> = {town: 5, quest: 7, bank: 7, teleport: 7, fairy: 6, spirit: 6, glider: 6, balloon: 6, mushtree: 6, quetzal: 6, boat: 7};
/** The most teleports a marker's hover card lists before "and N more". */
const TIP_LINES = 8;

/** Where the view goes: a tile, at `zoom` or at least `min` (default: the current zoom, at least 8). */
export type MapFocus = {x: number; y: number; plane: number; zoom?: number; min?: number; key: number};
/** One leg of a trip: its routes and the chosen one, drawn in the leg's colour on a trip with stops. */
/** A leg of the trip on the map: its routes, the chosen one, its colour (trips with stops), whether another leg is
 * highlighted (hovered in Directions), which fades this one, and the chosen route's teleport or transport landings
 * with the icon of how you get there. */
export type MapLeg = {routes: Route[]; active: number; colour?: string; faded?: boolean; landings?: (Tile & {icon: string})[]};
/** A trip pin: A (start), B (destination) or a stop's number, in its leg colour. */
export type MapPin = Tile & {mark: string; colour?: string};
type Props = {
  plane: number; area: Box; areas: Box[]; exits: MapExit[]; onExit: (e: MapExit) => void; places: MapPlace[];
  /** The selected spot: a place's marker is highlighted where it is; any other spot gets a pin. */
  selected: {x: number; y: number; plane: number; icon?: string; place?: MapPlace} | null;
  pins: MapPin[]; legs: MapLeg[]; focus: MapFocus | null; picking: boolean;
  onTile: (t: Tile) => void; onPlace: (p: MapPlace) => void; onZoom?: (z: number) => void;
  /** The game's own map icons and area names, drawn under our markers (null until they load). */
  game?: {icons: GameIcon[]; labels: GameLabel[]; details?: IconDetails | null} | null;
  /** A click or tap on the map (or one of the game's icons on it), or Enter on the focused map; `onMenuClose` when the
   * map moves. Place markers call `onPlace` instead. */
  onMenu?: (m: MapMenuAt) => void; onMenuClose?: () => void;
  /** A click or tap on one of the game's icons or an exit marker: its card opens. */
  onIcon?: (i: MapIconPick) => void;
};
/** Where a context menu opens: the tile (and place) under the pointer, in pixels from the map's top left, and the
 * map's size so the menu can stay inside it. */
export type MapMenuAt = {tile: Tile; place?: MapPlace; name?: string; x: number; y: number; width: number; height: number};
/** One of the map's icons, picked to open its card: the game's own icons (shops, altars, fishing spots, dungeons) and
 * the ways into another area. `info` is what the card says; `exit` is where the icon leads, when the travel data knows. */
export type MapIconPick = {tile: Tile; icon: string; info: GameIconTip; exit?: MapExit};
/** The game's icons that can stand for a way into another area: its two Dungeon icons and the Map link arrow. */
const WAY_IN = new Set<number>([GAME_SPRITE.dungeon, GAME_SPRITE.dungeonPlain, GAME_SPRITE.mapLink]);

const icon = (html: string, size: [number, number], anchor: [number, number], className = 'wm-marker') => L.divIcon({className, html, iconSize: size, iconAnchor: anchor});
const pin = (letter: string, tone: string, colour?: string) => icon(`<span class="wm-pin ${tone}"${colour ? ` style="background:${escapeHtml(colour)}"` : ''}><b>${escapeHtml(letter)}</b></span>`, [28, 36], [14, 34]);
/** A game map-function sprite in an icon's URL (public/icons/map/game/<sprite>.png), if it is one. */
const spriteOf = (url: string) => {const m = url.match(/\/icons\/map\/game\/(\d+)\.png$/); return m ? Number(m[1]) : null;};
/** Our marker counts as the game's own icon within this many tiles, so the game's copy is left out. */
const SAME_SPOT = 8;
const LABEL_FONT = [11, 13, 15];
/** The selected place's marker is drawn highlighted (and wins where markers would overlap). */
const SELECTED_PRIORITY = 100;
const isPlace = (p: MapPlace, s: {x: number; y: number; plane: number; place?: MapPlace} | null) => !!s?.place && s.place.kind === p.kind && s.place.x === p.x && s.place.y === p.y && s.place.plane === p.plane && s.place.name === p.name;
const priority = (p: MapPlace) => p.kind === 'teleport' ? (p.off ? MARKER_PRIORITY.teleportOff : MARKER_PRIORITY.teleport) : p.kind === 'bank' ? MARKER_PRIORITY.bank : p.kind === 'quest' ? MARKER_PRIORITY.quest : MARKER_PRIORITY.transport;
/** A marker's hover card: its name and kind, or for a teleport marker every teleport landing there. */
function placeTip(p: MapPlace) {
  if (!p.teleports?.length) return tipHtml(p.name, p.quest ? [KIND_LABEL.quest, p.quest.difficulty].filter(Boolean).join(' · ') : p.detail && p.detail !== p.name ? p.detail : KIND_LABEL[p.kind]);
  const lines = p.teleports.slice(0, TIP_LINES).map(t => `<li${t.ok ? '' : ' class="is-off"'}${t.label === t.name ? '' : ` title="${escapeHtml(t.name)}"`}><img src="${t.icon}" alt=""><span>${escapeHtml(t.label)}</span></li>`).join('');
  const more = p.teleports.length > TIP_LINES ? `<li class="is-more">and ${p.teleports.length - TIP_LINES} more</li>` : '';
  return `<b>${escapeHtml(p.name)}</b><ul>${lines}${more}</ul>${p.off ? '<small>Not in your travel options</small>' : ''}`;
}

/** A game icon's hover card: its name and what it is, or one row per kind of fishing spot with its level. */
function gameTip(t: GameIconTip) {
  if (!t.rows.length) return tipHtml(t.title, t.detail);
  return `<b>${escapeHtml(t.title)}</b><ul>${t.rows.map(r => `<li><span>${escapeHtml(r.text)}</span>${r.level ? `<small>${escapeHtml(r.level)}</small>` : ''}</li>`).join('')}</ul>`;
}

/** The world map canvas: terrain for one floor of one area (the surface or an underground area), place markers and
 * exits for the current view, route lines and the trip's ends. Markers grow with the zoom; where they would overlap,
 * exits win, then transport, banks, teleports and quest starts. Changing floor or area pans to the exit and fades. */
export default function WorldMapView(props: Props) {
  const {plane, area, exits, places, selected, pins, legs, focus, picking} = props;
  const el = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), veil = useRef<HTMLDivElement | null>(null), leaving = useRef(false);
  const [zoom, setZoom] = useState(0);
  const layers = useRef<{terrain?: L.TileLayer; places: L.LayerGroup; route: L.LayerGroup; pins: L.LayerGroup; exits: L.LayerGroup; frame: ReturnType<typeof areaFrame>} | null>(null);
  const latest = useRef(props);
  latest.current = props;

  /** Exits name the town or underground area they lead to. */
  function names(): PlaceNames {
    const {places, areas} = latest.current;
    return {town: t => townNear(places, t), area: t => undergroundName(t, areas)};
  }
  /** Go through an exit: pan to it while the map fades, then show the other side. */
  function leave(e: MapExit) {
    const m = map.current;
    if (!m || leaving.current) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {latest.current.onExit(e); return;}
    leaving.current = true;
    veil.current?.classList.add('is-on');
    m.panTo(tileLatLng(e.from.x, e.from.y), {animate: true, duration: .22});
    window.setTimeout(() => {leaving.current = false; latest.current.onExit(e);}, 230);
  }

  function draw() {
    const m = map.current, l = layers.current;
    if (!m || !l) return;
    const {exits, plane, area} = latest.current, labels = names();
    const shownExits = exitsIn(areaExits(exits), plane, area);
    const doors = drawExits(m, l.exits, shownExits, leave, {label: e => exitLabel(e, labels), minZoom: () => EXIT_AREA_ZOOM, onPick: e => picked(e.from, GAME_ICON(e.dir === 'up' ? GAME_SPRITE.mapLink : GAME_SPRITE.dungeon), undefined, e)});
    drawPlaces(doors, m.getZoom() >= EXIT_AREA_ZOOM ? shownExits : []);
  }
  function drawPlaces(taken: Footprint[], doors: MapExit[]) {
    const m = map.current, group = layers.current?.places;
    if (!m || !group) return;
    const {places, plane, area, onPlace, game, selected} = latest.current, zoom = m.getZoom(), view = m.getBounds().pad(.25), size = markerSize(zoom), hover = canHover();
    group.clearLayers();
    if (game) drawGameLabels(group, game.labels);
    // Town names that would overlap an earlier one are left out (rough text boxes in screen pixels).
    const labels: [number, number, number, number][] = [], spots: MapPlace[] = [], marks: Footprint[] = [];
    for (const p of places) {
      if (p.plane !== plane || !inBox(area, p.x, p.y) || zoom < (MIN_ZOOM[p.kind] ?? 7) || !view.contains(tileLatLng(p.x, p.y))) continue;
      const c = m.latLngToContainerPoint(tileLatLng(p.x, p.y));
      if (p.kind === 'town') {
        if (game) continue;// the game's own area names stand in for ours (ours only if they could not load)
        const w = p.name.length * (zoom >= 8 ? 8.5 : 7.5) / 2 + 4, box: [number, number, number, number] = [c.x - w, c.y - 10, c.x + w, c.y + 10];
        if (labels.some(b => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
        labels.push(box);
        L.marker(tileLatLng(p.x, p.y), {icon: icon(`<span>${escapeHtml(p.name)}</span>`, [0, 0], [0, 0], 'wm-label' + (zoom >= 8 ? ' is-near' : '')), keyboard: false, interactive: false, zIndexOffset: 500}).addTo(group);
        continue;
      }
      spots.push(p);
      marks.push({x: c.x, y: c.y, size, priority: isPlace(p, selected) ? SELECTED_PRIORITY : priority(p)});
    }
    // The game's own icons: the map functions on this floor in view that this zoom shows (gameIconZoom: the key ones
    // first, everyday services and then common resources closer in), except where one of our markers (or a way into an
    // area) already shows the same icon nearby. They yield to all of ours where they would overlap.
    const games: GameIcon[] = [];
    if (game) {
      const ours = spots.map(p => ({x: p.x, y: p.y, sprite: spriteOf(markerIcon(p))})).filter(o => o.sprite !== null);
      for (const e of doors) ours.push({x: e.from.x, y: e.from.y, sprite: GAME_SPRITE.dungeon});
      for (const g of game.icons) {
        if (g.plane !== plane || zoom < gameIconZoom(g.sprite) || !inBox(area, g.x, g.y) || !view.contains(tileLatLng(g.x, g.y))) continue;
        if (ours.some(o => sameGameIcon(o.sprite!, g.sprite) && Math.abs(o.x - g.x) <= SAME_SPOT && Math.abs(o.y - g.y) <= SAME_SPOT)) continue;
        const c = m.latLngToContainerPoint(tileLatLng(g.x, g.y));
        games.push(g);
        marks.push({x: c.x, y: c.y, size: gameSpriteSize(size), priority: gameIconPriority(g.sprite)});
      }
    }
    for (const i of declutter(marks, .25, taken)) {
      if (i >= spots.length) {drawGameIcon(group, games[i - spots.length], size, hover); continue;}
      const p = spots[i], count = p.teleports && p.teleports.length > 1 ? p.teleports.length : 0, url = markerIcon(p), pixel = spriteOf(url) !== null, s = pixel ? gameSpriteSize(size) : size, on = isPlace(p, selected);
      const marker = L.marker(tileLatLng(p.x, p.y), {
        icon: icon(`<img src="${url}" alt=""${pixel ? ' class="is-pixel"' : ''}>${count ? `<b class="wm-count">${count}</b>` : ''}`, [s, s], [s / 2, s / 2], 'wm-marker kind-' + p.kind + (p.off ? ' is-off' : '') + (count ? ' is-group' : '') + (pixel ? ' is-game' : '') + (on ? ' is-selected' : '')),
        keyboard: true, riseOnHover: true, zIndexOffset: on ? 800 : p.off ? -50 : 0,
      });
      marker.on('add', () => {const el = marker.getElement(); el?.setAttribute('aria-label', p.teleports?.length ? `${p.name}: ${p.teleports.map(t => t.name).join(', ')}` : p.name); if (on) el?.setAttribute('aria-current', 'true');});
      if (hover) marker.bindTooltip(placeTip(p), {direction: 'top', offset: [0, -s / 2], className: 'map-tip' + (p.teleports ? ' is-list' : ''), opacity: 1});
      marker.on('click', e => {L.DomEvent.stopPropagation(e); onPlace(p);});
      marker.addTo(group);
    }
  }

  /** One of the game's own icons: its name on hover; a click opens the map's menu there (or picks the tile). */
  function drawGameIcon(group: L.LayerGroup, g: GameIcon, size: number, hover: boolean) {
    const s = gameSpriteSize(size), tip = gameIconTip(g, latest.current.game?.details);
    const marker = L.marker(tileLatLng(g.x, g.y), {icon: icon(`<img src="${GAME_ICON(g.sprite)}" alt="" class="is-pixel">`, [s, s], [s / 2, s / 2], 'wm-marker is-game kind-game'), keyboard: false, zIndexOffset: -100});
    const said = [tip.title, tip.detail, ...tip.rows.map(r => [r.text, r.level].filter(Boolean).join(' '))].filter(Boolean).join(': ');
    marker.on('add', () => marker.getElement()?.setAttribute('aria-label', said));
    if (hover) marker.bindTooltip(gameTip(tip), {direction: 'top', offset: [0, -s / 2], className: 'map-tip', opacity: 1});
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const {exits, area} = latest.current, tile = {x: g.x, y: g.y, plane: g.plane};
      picked(tile, GAME_ICON(g.sprite), tip, WAY_IN.has(g.sprite) ? exitNear(exits, tile, area) ?? undefined : undefined);
    });
    marker.addTo(group);
  }
  /** The game's area names, in its colours and three sizes: larger names first, and any that would overlap one
   * already written is left out. */
  function drawGameLabels(group: L.LayerGroup, labels: GameLabel[]) {
    const m = map.current;
    if (!m) return;
    const {plane, area} = latest.current, zoom = m.getZoom(), view = m.getBounds().pad(.1), boxes: [number, number, number, number][] = [];
    const list = labels.filter(l => l.plane === plane && zoom >= LABEL_ZOOM[l.size] && zoom <= LABEL_MAX_ZOOM[l.size] && inBox(area, l.x, l.y) && view.contains(tileLatLng(l.x, l.y))).sort((a, b) => b.size - a.size);
    for (const l of list) {
      const c = m.latLngToContainerPoint(tileLatLng(l.x, l.y)), font = LABEL_FONT[l.size];
      const w = Math.max(...l.lines.map(t => t.length)) * font * .3 + 2, h = l.lines.length * font * .6 + 1, box: [number, number, number, number] = [c.x - w, c.y - h, c.x + w, c.y + h];
      if (boxes.some(b => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
      boxes.push(box);
      const colour = l.colour ? `color:#${l.colour.toString(16).padStart(6, '0')};` : '';
      L.marker(tileLatLng(l.x, l.y), {icon: icon(`<span class="size-${l.size}" style="${colour}">${l.lines.map(escapeHtml).join('<br>')}</span>`, [0, 0], [0, 0], 'wm-label is-game'), keyboard: false, interactive: false, zIndexOffset: 500}).addTo(group);
    }
  }

  /** A click on the map: while a trip row is being picked it sets that row, otherwise the map's menu opens there. */
  function clicked(tile: Tile, at: L.Point) {
    const m = map.current;
    if (!m || !inBox(latest.current.area, tile.x, tile.y)) return;
    if (latest.current.picking) {latest.current.onTile(tile); return;}
    const size = m.getSize();
    latest.current.onMenu?.({tile, x: at.x, y: at.y, width: size.x, height: size.y});
  }
  /** A click on an icon: while a trip row is being picked it sets that row, otherwise the icon's card opens. A way into
   * another area (an exit, or a dungeon icon the travel data knows the way in at) names where it leads. */
  function picked(tile: Tile, src: string, info?: GameIconTip, exit?: MapExit) {
    if (!inBox(latest.current.area, tile.x, tile.y)) return;
    if (latest.current.picking) {latest.current.onTile(tile); return;}
    if (exit) {const where = exitWhere(exit, names()); info = {title: where.charAt(0).toUpperCase() + where.slice(1), detail: exitDetail(exit), rows: []};}
    if (info) latest.current.onIcon?.({tile, icon: src, info, exit});
  }

  useEffect(() => {
    const m = L.map(el.current!, {crs: GAME_CRS, minZoom: WORLD_ZOOM.min, maxZoom: WORLD_ZOOM.max, maxBoundsViscosity: 1, scrollWheelZoom: false, zoomSnap: 1, zoomControl: false, attributionControl: true});
    m.attributionControl.setPrefix(false);
    stepWheelZoom(m);
    L.control.zoom({position: 'topright'}).addTo(m);
    m.setView(tileLatLng(3222, 3300), WORLD_ZOOM.initial, {animate: false});
    // The trip draws over the map's icons: its lines in one pane, its pins and arrowheads above them.
    for (const [name, z] of [['tripLines', '620'], ['tripPins', '640']] as const) {const pane = m.createPane(name); pane.style.zIndex = z; pane.style.pointerEvents = 'none';}
    layers.current = {route: L.layerGroup().addTo(m), exits: L.layerGroup().addTo(m), places: L.layerGroup().addTo(m), pins: L.layerGroup().addTo(m), frame: areaFrame(m, WORLD_ZOOM.min)};
    veil.current = L.DomUtil.create('div', 'wm-veil', el.current!) as HTMLDivElement;
    m.on('click', e => {const t = latLngTile(e.latlng); clicked({...t, plane: latest.current.plane}, e.containerPoint);});
    // From the keyboard: Enter (or the menu key) on the focused map opens the menu at its centre.
    m.getContainer().addEventListener('keydown', e => {
      if (e.target !== m.getContainer() || !(e.key === 'Enter' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
      e.preventDefault();
      const size = m.getSize(), centre = L.point(size.x / 2, size.y / 2), t = latLngTile(m.containerPointToLatLng(centre));
      clicked({...t, plane: latest.current.plane}, centre);
    });
    m.on('movestart zoomstart', () => latest.current.onMenuClose?.());
    m.on('moveend zoomend', () => {draw(); latest.current.onZoom?.(m.getZoom());});
    // The arrowheads on the route sit a fixed distance on screen before each landing, so they are placed again.
    m.on('zoomend', () => setZoom(m.getZoom()));
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el.current!);
    map.current = m;
    return () => {resize.disconnect(); m.remove(); map.current = null; layers.current = null; veil.current = null;};
    // The map is created once; the effects below follow the props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The view stays inside the area; terrain loads for this floor of it. Runs before the focus below moves the view.
  useEffect(() => {
    const m = map.current, l = layers.current;
    if (!m || !l) return;
    l.frame.set(area);
    l.terrain?.remove();
    l.terrain = terrainLayer(plane, WORLD_ZOOM.min, WORLD_ZOOM.max, area).addTo(m);
    l.terrain.bringToBack();
    // The new floor or area fades in (from the dark an exit faded to, or straight away after a search).
    const v = veil.current;
    if (v) {
      if (!v.classList.contains('is-on')) v.classList.add('is-on', 'is-instant');
      requestAnimationFrame(() => {v.classList.remove('is-instant'); window.setTimeout(() => v.classList.remove('is-on'), 60);});
    }
  }, [plane, area]);

  // draw reads the latest props through a ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [places, exits, plane, area, props.game, selected?.place]);

  useEffect(() => {
    const group = layers.current?.pins;
    if (!group) return;
    group.clearLayers();
    const here = (t: {x: number; y: number; plane: number} | null) => !!t && t.plane === plane && inBox(area, t.x, t.y);
    // A place is highlighted on its own marker (drawPlaces); only a spot with no marker gets the selection pin.
    if (selected && !selected.place && here(selected)) L.marker(tileLatLng(selected.x, selected.y), {icon: icon(`<span class="wm-pin is-selected">${selected.icon ? `<img src="${selected.icon}" alt="">` : ''}</span>`, [28, 36], [14, 34]), interactive: false, zIndexOffset: 900}).addTo(group);
    for (const p of pins) if (here(p)) L.marker(tileLatLng(p.x, p.y), {icon: pin(p.mark, p.mark === 'A' ? 'is-from' : p.mark === 'B' ? 'is-to' : 'is-stop', p.colour), interactive: false, zIndexOffset: 1000, pane: 'tripPins'}).addTo(group);
  }, [selected, pins, plane, area]);

  useEffect(() => {
    const m = map.current, group = layers.current?.route;
    if (!m || !group) return;
    group.clearLayers();
    const shown = (leg: Route['legs'][number]) => leg.plane === plane && leg.points.length > 0 && inBox(area, leg.points[0][0], leg.points[0][1]);
    // Other routes faintly underneath (a trip with one leg), each leg's chosen route on top with a dark edge so it
    // reads on any terrain: in the travel colours, or with stops in the leg's own colour (dashed off foot).
    if (legs.length === 1) legs[0].routes.forEach((r, i) => {
      if (i === legs[0].active) return;
      for (const leg of r.legs) if (shown(leg) && leg.mode === 'walk') L.polyline(leg.points.map(([x, y]) => tileLatLng(x, y)), {color: '#d9cfb8', weight: 3, opacity: .45, interactive: false}).addTo(group);
    });
    for (const trip of legs) {
      const r = trip.routes[trip.active];
      if (!r) continue;
      const fade = trip.faded ? .3 : 1;
      for (const leg of r.legs) {
        if (!shown(leg)) continue;
        const walk = leg.mode === 'walk', [end, before] = [leg.points[leg.points.length - 1], leg.points[leg.points.length - 2]];
        // A teleport or transport hop is a straight dashed line from where it starts to where it lands, with an
        // arrowhead at the landing; one that starts in another area (a dungeon, say) is left out.
        if (!walk && !inBox(area, end[0], end[1])) continue;
        const line = leg.points.map(([x, y]) => tileLatLng(x, y)), colour = trip.colour ?? ROUTE_COLOUR[leg.mode] ?? '#9fd7ff';
        if (walk) {
          L.polyline(line, {pane: 'tripLines', color: '#1a1206', weight: 8, opacity: .75 * fade, interactive: false}).addTo(group);
          L.polyline(line, {pane: 'tripLines', color: colour, weight: 5, opacity: fade, interactive: false}).addTo(group);
          continue;
        }
        L.polyline(line, {pane: 'tripLines', color: '#1a1206', weight: 7, opacity: .8 * fade, dashArray: '10 9', lineCap: 'butt', interactive: false}).addTo(group);
        L.polyline(line, {pane: 'tripLines', color: colour, weight: 3.5, opacity: fade, dashArray: '10 9', lineCap: 'butt', interactive: false}).addTo(group);
        if (before) {
          // The landing: a badge with the way's icon (or a dot) where you arrive, and an arrowhead on the hop before it.
          const a = m.latLngToLayerPoint(tileLatLng(before[0], before[1])), b = m.latLngToLayerPoint(tileLatLng(end[0], end[1])), length = a.distanceTo(b);
          const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, back = (p: number) => m.layerPointToLatLng(b.subtract(b.subtract(a).multiplyBy(p / length)));
          const landing = trip.landings?.find(l => l.plane === leg.plane && Math.max(Math.abs(l.x - end[0]), Math.abs(l.y - end[1])) <= 1);
          if (landing) L.marker(tileLatLng(end[0], end[1]), {pane: 'tripPins', interactive: false, opacity: fade, icon: icon(`<span class="wm-landing" style="border-color:${escapeHtml(colour)}"><img src="${escapeHtml(landing.icon)}" alt=""></span>`, [26, 26], [13, 13], 'wm-landing-mark')}).addTo(group);
          else L.circleMarker(tileLatLng(end[0], end[1]), {pane: 'tripLines', radius: 4.5, color: '#1a1206', weight: 2, fillColor: colour, fillOpacity: fade, opacity: fade, interactive: false}).addTo(group);
          if (length > 48) L.marker(back(landing ? 22 : 16), {pane: 'tripPins', interactive: false, opacity: fade, icon: icon(`<svg class="wm-arrow" viewBox="0 0 20 20" style="transform:rotate(${angle.toFixed(1)}deg)"><path d="M17 10 4 3.5 7.5 10 4 16.5Z" fill="${escapeHtml(colour)}" stroke="#1a1206" stroke-width="1.6" stroke-linejoin="round"/></svg>`, [20, 20], [10, 10], 'wm-arrow-mark')}).addTo(group);
        }
      }
    }
  }, [legs, plane, area, zoom]);

  // Frame a new trip: its pins and the chosen routes on this floor.
  const chosen = legs.map(l => {const r = l.routes[l.active]; return r ? r.signature + r.ticks : '';}).join(';');
  useEffect(() => {
    const m = map.current;
    if (!m || !chosen) return;
    const points = legs.flatMap(l => (l.routes[l.active]?.legs ?? []).filter(x => x.plane === plane).flatMap(x => x.points.filter(([x, y]) => inBox(area, x, y)).map(([x, y]) => tileLatLng(x, y))));
    for (const t of pins) if (t.plane === plane && inBox(area, t.x, t.y)) points.push(tileLatLng(t.x, t.y));
    if (points.length) m.fitBounds(L.latLngBounds(points), {padding: [40, 40], maxZoom: 9});
    // Only when the chosen routes change, not when the floor or the pins move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  useEffect(() => {
    const m = map.current;
    if (focus && m) m.setView(tileLatLng(focus.x, focus.y), focus.zoom ?? Math.max(m.getZoom(), focus.min ?? 8));
  }, [focus]);

  // The selected spot stays in sight: once the view settles, if the spot's card (over the map's top left, or along the
  // bottom on phones) covers it, the map pans it to the middle of the part left showing.
  const shownSpot = selected ? `${selected.x},${selected.y},${selected.plane}` : '';
  useEffect(() => {
    if (!shownSpot) return;
    const timer = window.setTimeout(() => {
      const m = map.current, box = el.current, card = box?.parentElement?.querySelector<HTMLElement>('.wm-card'), selected = latest.current.selected;
      if (!m || !box || !card || !selected || selected.plane !== latest.current.plane) return;
      const b = box.getBoundingClientRect(), c = card.getBoundingClientRect(), at = m.latLngToContainerPoint(tileLatLng(selected.x, selected.y));
      const left = c.left - b.left, top = c.top - b.top, right = c.right - b.left, bottom = c.bottom - b.top, margin = 24;
      if (at.x < left - margin || at.x > right + margin || at.y < top - margin || at.y > bottom + margin) return;
      if (c.width > b.width * .8) m.panBy([0, at.y - top / 2]);
      else m.panBy([at.x - (right + (b.width - right) / 2), 0]);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [shownSpot]);

  // Leaflet adds its own classes to this element, so picking's class is toggled here rather than set by React (which
  // would drop Leaflet's, and with them the map's clipping).
  useEffect(() => {el.current?.classList.toggle('is-picking', picking);}, [picking]);
  return <div ref={el} className="wm-canvas"/>;
}
