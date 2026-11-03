'use client';
import {Fragment, lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type CSSProperties, type PointerEvent as ReactPointerEvent} from 'react';
import {ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronUp, Crosshair, Flag, Footprints, GripVertical, ListPlus, LocateFixed, MapPin, MousePointerClick, Navigation, Search, X} from 'lucide-react';
import {PublicHeader} from './Community';
import {GuideLink} from './GuideLink';
import {TravelOptions, travelSummary, type TravelOptionsFile, type TravelTab} from './TravelOptions';
import type {MapFocus, MapIconPick, MapLeg, MapMenuAt, MapPin as MapTripPin} from './WorldMapView';
import {useMapExits} from './map-exits';
import type {PlanInput, PlanReply, PlanRequest} from './world-map-route.worker';
import {DEFAULT_LAYERS, KIND_ICON, KIND_LABEL, difficultyIcon, LAYERS, ROUTE_COLOUR, TRAVEL_ICON, groupTeleports, listIcon, nearestPlace, readPlaces, searchPlaces, teleportIcon, townNear, type LayerId, type MapPlace, type PlacesFile} from '@/lib/world-map-places';
import {areaFor, backLabel, exitAction, onSurface, wayOut, type MapExit, type MapPlace as MapSpot} from '@/lib/world-map-exits';
import {undergroundName} from '@/lib/world-map-underground';
import {travelTime, type Route, type RouteStep, type Tile} from '@/lib/world-map-routing';
import {GAME_ICON, GAME_SPRITE, gameIconLayer, readGameIcons, readIconDetails, type GameIcon, type GameIconTip, type GameIconsFile, type GameLabel, type IconDetails, type IconDetailsFile} from '@/lib/world-map-game-icons';
import {DEFAULT_TRAVEL, KIND_NETWORK, parseTravelSettings, type TravelSettings} from '@/lib/world-map-settings';
import {MAX_STOPS, applyTripAction, canAddStop, emptyTrip, legKey, moveRow, parseStops, removeRow, reverseTrip, rowMark, setEnd, stopCount, tripLegs, tripOf, tripTime, type TripAction, type TripRow} from '@/lib/world-map-trip';
import {MAP_LEG_COLOURS} from '@/lib/guide-map';
import './world-map.css';

// Leaflet and the map canvas load only on this page, in the browser.
const WorldMapView = lazy(() => import('./WorldMapView'));
const FLOORS = ['Ground', '1st', '2nd', '3rd'];
const START = {x: 3222, y: 3300};
const WORLD_ZOOM_MIN = 3;
/** The layer buttons use the game's own icons: the quest and bank map icons, the Transportation icon and, for teleports,
 * the Lumbridge Home Teleport spell. */
const LAYER_ICON: Record<LayerId, string> = {quest: KIND_ICON.quest, transport: KIND_ICON.boat, teleport: '/icons/spells/lumbridge-home-teleport.png', bank: KIND_ICON.bank};
const KEYS = {travel: 'spooned:world-map:travel', layers: 'spooned:world-map:layers', home: 'spooned:world-map:home'};
/** A spot on the map: a tile, a place, or one of the map's icons (what it is, and where it leads when it is a way in). */
type Point = {tile: Tile; label: string; icon?: string; place?: MapPlace; info?: GameIconTip; exit?: MapExit};
const T = TRAVEL_ICON.transport;
const STEP_ICON: Record<string, string> = {fairy: TRAVEL_ICON.fairy, spirit: TRAVEL_ICON.spirit, mushtree: KIND_ICON.mushtree, boat: KIND_ICON.boat, ship: KIND_ICON.boat, charter: T, canoe: T, glider: KIND_ICON.glider, balloon: KIND_ICON.balloon, quetzal: KIND_ICON.quetzal, minecart: T, carpet: T, shortcut: TRAVEL_ICON.shortcut, portal: TRAVEL_ICON.housePortal, lever: T, house: TRAVEL_ICON.housePortal, passage: TRAVEL_ICON.passage};
const STEP_VERB: Record<string, string> = {fairy: 'Fairy ring', spirit: 'Spirit tree to', mushtree: 'Mushtree to', boat: 'Boat:', ship: 'Ship to', charter: 'Charter ship to', canoe: 'Canoe to', glider: 'Glider to', balloon: 'Balloon to', quetzal: 'Quetzal to', minecart: 'Minecart to', carpet: 'Carpet to', house: 'House:'};

function read<T>(key: string, parse: (v: unknown) => T, fallback: T): T {
  try {const raw = localStorage.getItem(key); return raw ? parse(JSON.parse(raw)) : fallback;} catch {return fallback;}
}
function save(key: string, value: unknown) {try {localStorage.setItem(key, JSON.stringify(value));} catch {/* private browsing: keep it for this visit */}}
const tileParam = (v: string | null): Tile | null => {const m = v?.match(/^(\d{3,5}),(\d{3,5})(?:,([0-3]))?$/); return m ? {x: Number(m[1]), y: Number(m[2]), plane: Number(m[3] ?? 0)} : null;};
const sameTile = (a: Tile | null | undefined, b: Tile | null | undefined) => !!a && !!b && a.x === b.x && a.y === b.y && a.plane === b.plane;

/** A map icon's card: its detail ("what · level") as a row of its own, where the card has room for it. */
const iconRows = (info: GameIconTip): GameIconTip => {
  if (!info.detail || info.rows.length) return info;
  const [text, ...rest] = info.detail.split(' · ');
  return {...info, detail: '', rows: [{text, level: rest.join(' · ')}]};
};

/** Route planning in a Web Worker: one request at a time, newer requests replace older ones. */
function usePlanner() {
  const worker = useRef<Worker | null>(null), next = useRef(0), waiting = useRef(new Map<number, (r: PlanReply) => void>());
  useEffect(() => () => {worker.current?.terminate(); worker.current = null;}, []);
  return useCallback((request: PlanInput) => new Promise<PlanReply>(resolve => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./world-map-route.worker.ts', import.meta.url), {type: 'module'});
      worker.current.onmessage = (e: MessageEvent<PlanReply>) => {waiting.current.get(e.data.id)?.(e.data); waiting.current.delete(e.data.id);};
      worker.current.onerror = () => {for (const [id, done] of waiting.current) done({id, ok: false, error: 'The route planner stopped. Reload the page to try again.'}); waiting.current.clear();};
    }
    const id = ++next.current;
    waiting.current.set(id, resolve);
    worker.current.postMessage({...request, id} as PlanRequest);
  }), []);
}

/** A search box for a place: type to find one, or pick it on the map. In Directions, `mark` is the row's pin (A, 1, 2…
 * or B) and × clears or removes the row. */
function PlaceField({label, mark, colour, value, places, onPick, onClear, removable, picking, onPickMap, autoFocus}: {label: string; mark?: string; colour?: string; value: Point | null; places: MapPlace[]; onPick: (p: Point) => void; onClear?: () => void; removable?: boolean; picking?: boolean; onPickMap?: () => void; autoFocus?: boolean}) {
  const [text, setText] = useState(''), [open, setOpen] = useState(false), [cursor, setCursor] = useState(0);
  const results = useMemo(() => searchPlaces(places, text, 7), [places, text]);
  const choose = (p: MapPlace) => {onPick({tile: {x: p.x, y: p.y, plane: p.plane}, label: p.name, icon: p.kind === 'town' ? undefined : listIcon(p), place: p.id === 'tile' ? undefined : p}); setText(''); setOpen(false);};
  const empty = mark === 'A' ? 'Choose a start' : mark === 'B' ? 'Choose a destination' : 'Choose a stop';
  return <div className="wm-field">
    <label className="board-filter wm-search">
      {!mark ? <Search size={16} aria-hidden="true"/> : <span className={'wm-field-dot ' + (mark === 'A' ? 'is-from' : mark === 'B' ? 'is-to' : 'is-stop')} style={colour ? {background: colour} : undefined} aria-hidden="true">{mark}</span>}
      <input aria-label={!mark ? 'Search the map' : label} placeholder={value && !open ? value.label : !mark ? 'Search towns, dungeons, quests…' : empty} value={text} autoFocus={autoFocus}
        className={value && !open ? 'has-value' : ''} title={value && !open ? value.label : undefined}
        onChange={e => {setText(e.target.value); setOpen(true); setCursor(0);}} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {if (e.key === 'ArrowDown') {e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1));} else if (e.key === 'ArrowUp') {e.preventDefault(); setCursor(c => Math.max(c - 1, 0));} else if (e.key === 'Enter' && results[cursor]) {e.preventDefault(); choose(results[cursor]);} else if (e.key === 'Escape') setOpen(false);}}/>
      {(value || removable) && onClear && !text && <button type="button" className="wm-field-btn" aria-label={(removable ? 'Remove ' : 'Clear ') + label.toLowerCase()} title={removable ? 'Remove' : 'Clear'} onClick={onClear}><X size={15}/></button>}
      {onPickMap && <button type="button" className="wm-field-btn" aria-pressed={!!picking} aria-label={'Pick ' + label.toLowerCase() + ' on the map'} title="Pick on the map" onClick={onPickMap}><Crosshair size={16}/></button>}
    </label>
    {open && results.length > 0 && <ul className="wm-results" role="listbox">{results.map((p, i) => <li key={p.id} role="option" aria-selected={i === cursor}><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(p)}><img src={listIcon(p)} alt=""/><span>{p.name}</span><small>{p.id === 'tile' ? 'Tile' : p.kind === 'teleport' || p.kind === 'fairy' ? p.detail ?? KIND_LABEL[p.kind] : KIND_LABEL[p.kind]}{p.plane ? ' · ' + FLOORS[p.plane] : ''}</small></button></li>)}</ul>}
  </div>;
}

/** The map's menu (a click or tap on the map): start, end or add a stop to a trip here. Arrow keys move between the
 * items, Escape, Cancel or a click elsewhere closes it, and it opens on the side of the pointer that has room. */
function MapMenu({at, canStop, onChoose, onClose, onDismiss}: {at: MapMenuAt; canStop: boolean; onChoose: (action: TripAction) => void; onClose: () => void; onDismiss: () => void}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = menu.current;
    el?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus({preventScroll: true});
    const away = (e: PointerEvent) => {if (!el?.contains(e.target as Node)) onDismiss();};
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('resize', onClose);
    return () => {document.removeEventListener('pointerdown', away, true); window.removeEventListener('resize', onClose);};
  }, [onClose, onDismiss]);
  const back = () => {onClose(); document.querySelector<HTMLElement>('.wm-canvas')?.focus({preventScroll: true});};
  const keys = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])], i = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'ArrowDown' ? (i + 1) % items.length : e.key === 'ArrowUp' ? (i - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (to >= 0) {e.preventDefault(); items[to]?.focus();}
    else if (e.key === 'Escape' || e.key === 'Tab') {e.preventDefault(); back();}
  };
  const left = at.x > at.width - 210, up = at.y > at.height - 190;
  return <div ref={menu} className="wm-ctx" role="menu" aria-label={at.place?.name ?? at.name ?? 'This spot'} onKeyDown={keys} onContextMenu={e => e.preventDefault()}
    style={{left: at.x, top: at.y, transform: `translate(${left ? '-100%' : '0'}, ${up ? '-100%' : '0'})`}}>
    <button type="button" role="menuitem" tabIndex={-1} onClick={() => onChoose('from')}><Flag size={15} aria-hidden="true"/>Start here</button>
    <button type="button" role="menuitem" tabIndex={-1} onClick={() => onChoose('to')}><Navigation size={15} aria-hidden="true"/>Directions to here</button>
    <button type="button" role="menuitem" tabIndex={-1} disabled={!canStop} title={canStop ? undefined : `Up to ${MAX_STOPS} stops`} onClick={() => onChoose('stop')}><ListPlus size={15} aria-hidden="true"/>Add a stop</button>
    <button type="button" role="menuitem" tabIndex={-1} className="is-cancel" onClick={back}><X size={15} aria-hidden="true"/>Cancel</button>
  </div>;
}

/** The leg colour of a multi-stop trip (as on guide maps); a trip with one leg keeps the travel colours. */
const legColour = (leg: number, legs: number) => legs > 1 ? MAP_LEG_COLOURS[leg % MAP_LEG_COLOURS.length] : undefined;

/** Directions' list of places: the start, any stops and the destination. Drag a row by its handle (mouse or touch) or
 * focus it and use the arrow keys to reorder; × removes a stop or clears an end. */
function TripRows({trip, colours, places, pick, onChange, onPick, onPickMap}: {trip: TripRow<Point>[]; colours: (string | undefined)[]; places: MapPlace[]; pick: number | null; onChange: (t: TripRow<Point>[]) => void; onPick: (id: number, p: Point) => void; onPickMap: (id: number | null) => void}) {
  const [drag, setDrag] = useState<{id: number; dy: number; order: TripRow<Point>[]} | null>(null);
  const start = useRef(0), rows = useRef(new Map<number, HTMLLIElement>()), refocus = useRef<{id: number; part: string} | null>(null);
  const list = drag?.order ?? trip;
  useEffect(() => {
    const f = refocus.current;
    if (!f) return;
    refocus.current = null;
    rows.current.get(f.id)?.querySelector<HTMLElement>(f.part)?.focus();
  });
  const move = (from: number, to: number, part: string) => {if (to < 0 || to >= trip.length) return; refocus.current = {id: trip[from].id, part}; onChange(moveRow(trip, from, to));};
  const down = (e: ReactPointerEvent<HTMLButtonElement>, id: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientY;
    setDrag({id, dy: 0, order: trip});
  };
  const over = (e: ReactPointerEvent) => {
    if (!drag) return;
    let order = drag.order, dy = e.clientY - start.current;
    const i = order.findIndex(r => r.id === drag.id), h = rows.current.get(drag.id)?.offsetHeight ?? 44;
    // Past half a row, the dragged row swaps with its neighbour and the offset carries on from its new place.
    if (dy > h / 2 && i < order.length - 1) {order = moveRow(order, i, i + 1); start.current += h; dy -= h;}
    else if (dy < -h / 2 && i > 0) {order = moveRow(order, i, i - 1); start.current -= h; dy += h;}
    setDrag({...drag, dy, order});
  };
  const up = (commit: boolean) => {
    if (!drag) return;
    if (commit && drag.order.some((r, i) => r.id !== trip[i]?.id)) onChange(drag.order);
    setDrag(null);
  };
  const name = (i: number) => i === 0 ? 'Start' : i === list.length - 1 ? 'Destination' : 'Stop ' + i;
  return <ol className={'wm-trip' + (drag ? ' is-dragging' : '')}>
    {list.map((row, i) => {const dragging = drag?.id === row.id, stop = i > 0 && i < list.length - 1; return <li key={row.id} ref={el => {if (el) rows.current.set(row.id, el); else rows.current.delete(row.id);}} className={'wm-stop' + (dragging ? ' is-drag' : '')} style={dragging ? {transform: `translateY(${drag.dy}px)`} : undefined}>
      <button type="button" className="wm-stop-handle" aria-label={`Move ${name(i).toLowerCase()} (arrow keys)`} title="Drag to reorder, or use the arrow keys"
        onPointerDown={e => down(e, row.id)} onPointerMove={over} onPointerUp={() => up(true)} onPointerCancel={() => up(false)}
        onKeyDown={e => {if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {e.preventDefault(); move(i, i + (e.key === 'ArrowUp' ? -1 : 1), '.wm-stop-handle');}}}><GripVertical size={16} aria-hidden="true"/></button>
      <PlaceField label={name(i)} mark={rowMark(i, list.length)} colour={stop ? colours[i] : undefined} value={row.point} places={places} onPick={p => onPick(row.id, p)}
        onClear={() => onChange(removeRow(trip, trip.findIndex(r => r.id === row.id)))} removable={stop || list.length > 2}
        picking={pick === row.id} onPickMap={() => onPickMap(pick === row.id ? null : row.id)}/>
      {/* Screen reader buttons; keyboards use the arrow keys on the handle, pointers drag it. */}
      <span className="wm-stop-move sr-only">
        <button type="button" tabIndex={-1} aria-label={`Move ${name(i).toLowerCase()} up`} disabled={i === 0} onClick={() => move(i, i - 1, '.wm-stop-handle')}><ChevronUp size={14} aria-hidden="true"/></button>
        <button type="button" tabIndex={-1} aria-label={`Move ${name(i).toLowerCase()} down`} disabled={i === list.length - 1} onClick={() => move(i, i + 1, '.wm-stop-handle')}><ChevronDown size={14} aria-hidden="true"/></button>
      </span>
    </li>;})}
  </ol>;
}

/** A teleport's or transport's icon (walking has none: it draws footprints). */
function stepImage(step: RouteStep, groups: Map<string, number | undefined>) {
  if (step.type === 'walk') return null;
  return step.type === 'teleport' ? teleportIcon({...step, item: groups.get(step.group)}) : STEP_ICON[step.kind] ?? '/icons/skills/agility.png';
}
function stepIcon(step: RouteStep, groups: Map<string, number | undefined>) {
  const src = stepImage(step, groups);
  return src ? <img src={src} alt=""/> : <Footprints size={18} aria-hidden="true"/>;
}
function stepText(step: RouteStep, places: MapPlace[], last = false, destination = ''): [string, string] {
  if (step.type === 'walk') {const near = last ? null : nearestPlace(places, step.to.x, step.to.y, step.to.plane, ['town', 'bank', 'fairy', 'spirit']); return [`Walk ${step.tiles} tile${step.tiles === 1 ? '' : 's'}`, last ? 'to ' + destination : near ? 'towards ' + near.name : ''];}
  if (step.type === 'teleport') return [step.name, step.name.startsWith(step.groupName) ? 'Teleport' : step.groupName];
  if (step.kind === 'passage') return [step.name, step.to.plane !== step.from.plane ? FLOORS[step.to.plane] + ' floor' : ''];
  const verb = STEP_VERB[step.kind];
  return [verb ? `${verb} ${step.name}` : step.name, ''];
}

/** A row's pin (A, 1, 2… or B) in a leg's heading, in the same colours as the list of places. */
function LegMark({mark, colour}: {mark: string; colour?: string}) {
  const kind = mark === 'A' ? 'is-from' : mark === 'B' ? 'is-to' : 'is-stop';
  return <span className={'wm-field-dot ' + kind} style={kind === 'is-stop' && colour ? {background: colour} : undefined}>{mark}</span>;
}
/** "Fastest", or how much slower than the fastest way a route is ("+11 s"; "Same time" for a tie). */
const behind = (index: number, ticks: number, fastest: number) => index === 0 ? 'Fastest' : ticks - fastest < 1 ? 'Same time' : '+' + travelTime(ticks - fastest);
function routeName(route: Route, places: MapPlace[]) {
  const main = route.steps.filter(s => s.type !== 'walk');
  return main.length ? main.slice(0, 2).map(s => stepText(s, places)[0]).join(', ') : 'On foot';
}
function RouteIcons({route, groups}: {route: Route; groups: Map<string, number | undefined>}) {
  const main = route.steps.filter(s => s.type !== 'walk');
  return <span className="wm-route-icons" aria-hidden="true">{(main.length ? main : route.steps).slice(0, 3).map((s, i) => <span key={i}>{stepIcon(s, groups)}</span>)}</span>;
}

/** How a step draws: a walk (and stairs or doors) as a solid line, a teleport or transport as a dashed hop, as on the map. */
const isHop = (step: RouteStep) => step.type === 'teleport' || (step.type === 'travel' && step.kind !== 'passage');
const stepColour = (step: RouteStep, leg?: string) => leg ?? ROUTE_COLOUR[step.type === 'teleport' ? 'teleport' : step.type === 'travel' ? step.kind : 'walk'] ?? ROUTE_COLOUR.walk;
type Seg = CSSProperties & {'--seg': string};

/** A place of the trip on the Directions timeline: its pin and name. */
function TimelineNode({mark, colour, label}: {mark: string; colour?: string; label: string}) {
  return <li className="wm-node" title={label}><span className="wm-node-pin"><LegMark mark={mark} colour={colour}/></span><b>{label}</b></li>;
}

/** One leg on the Directions timeline, between two places: its time, its steps (icon, name and time, the line solid
 * for walking and dashed for a teleport or transport) and "Change", which opens the leg's routes as radio rows to
 * pick another (closing once one is picked). Hovering or focusing the leg highlights it on the map. */
function TimelineLeg({plan, colour, name, places, groups, onSelect, onHover}: {plan: {routes: Route[]; active: number} | null; colour?: string; name: string; places: MapPlace[]; groups: Map<string, number | undefined>; onSelect: (i: number) => void; onHover: (on: boolean) => void}) {
  const [open, setOpen] = useState(false), id = useId(), toggle = useRef<HTMLButtonElement>(null);
  const route = plan?.routes[plan.active], routes = plan?.routes ?? [], fastest = routes[0]?.ticks ?? 0;
  const first = route?.steps[0], headSeg = {'--seg': first ? stepColour(first, colour) : colour ?? ROUTE_COLOUR.walk} as Seg, line = first && isHop(first) ? 'is-hop' : 'is-walk';
  return <li className="wm-itin-leg" onPointerEnter={e => {if (e.pointerType === 'mouse') onHover(true);}} onPointerLeave={e => {if (e.pointerType === 'mouse') onHover(false);}}
    onFocus={e => {if (e.target.matches(':focus-visible')) onHover(true);}} onBlur={() => onHover(false)}>
    <div className={'wm-itin-head ' + line} style={headSeg}>
      {route ? <><b className="wm-itin-time">{travelTime(route.ticks)}</b>{!!plan?.active && <small>{behind(plan.active, route.ticks, fastest)}{route.ticks - fastest >= 1 ? ' vs fastest' : ''}</small>}</> : <small>Finding the way…</small>}
      {routes.length > 1 && <button ref={toggle} type="button" className="wm-ways-toggle" aria-expanded={open} aria-controls={id} aria-label={`Change the way to ${name} (${routes.length} ways)`} title={`${routes.length} ways`} onClick={() => setOpen(o => !o)}>Change<ChevronDown size={15} aria-hidden="true"/></button>}
    </div>
    {open && <div id={id} className={'wm-alts ' + line} role="radiogroup" aria-label={'Ways to ' + name} style={headSeg}>
      {routes.map((r, i) => {const text = routeName(r, places); return <label key={r.signature + r.ticks} className={'wm-alt' + (i === plan?.active ? ' is-on' : '')} title={text + ' · ' + travelTime(r.ticks)}>
        <input type="radio" name={id} checked={i === plan?.active} onChange={() => {onSelect(i); setOpen(false); toggle.current?.focus();}}
          onKeyDown={e => {if (e.key === 'Escape') {setOpen(false); toggle.current?.focus();}}}/>
        <span className="wm-alt-radio" aria-hidden="true"/>
        <RouteIcons route={r} groups={groups}/>
        <span className="wm-alt-name">{text}</span>
        <small className={i === 0 ? 'is-best' : ''}>{behind(i, r.ticks, fastest)}</small>
      </label>;})}
    </div>}
    {route && <ol className="wm-itin-steps">
      {route.steps.map((s, i) => {const [title, detail] = stepText(s, places, i === route.steps.length - 1, name); return <li key={i} className={isHop(s) ? 'is-hop' : 'is-walk'} style={{'--seg': stepColour(s, colour)} as Seg} title={detail ? title + ' ' + detail : title}>
        <span className="wm-step-icon">{stepIcon(s, groups)}</span><span className="wm-itin-name">{title}</span><small>{travelTime(s.ticks)}</small></li>;})}
    </ol>}
  </li>;
}

/** The world map page: look around, find places and quest starts, and plan the quickest way from a start through any
 * stops to a destination. */
export function WorldMap() {
  const [error, setError] = useState(''), [places, setPlaces] = useState<MapPlace[] | null>(null), [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'explore' | 'route'>('explore'), [spot, setSpot] = useState<MapSpot>({plane: 0, at: START}), [layers, setLayers] = useState<LayerId[]>(DEFAULT_LAYERS);
  const [selected, setSelected] = useState<Point | null>(null), [focus, setFocus] = useState<MapFocus | null>(null);
  const [trip, setTrip] = useState<TripRow<Point>[]>(() => emptyTrip<Point>()), [pick, setPick] = useState<number | null>(null);
  const [plans, setPlans] = useState<Record<string, Route[]>>({}), [actives, setActives] = useState<Record<string, number>>({}), [status, setStatus] = useState<{state: 'idle' | 'busy' | 'error'; message?: string}>({state: 'idle'});
  const [settings, setSettings] = useState<TravelSettings>(DEFAULT_TRAVEL), [optionsOpen, setOptionsOpen] = useState<false | 'modal' | 'sheet'>(false), [optionsTab, setOptionsTab] = useState<TravelTab>('Teleports'), [options, setOptions] = useState<TravelOptionsFile | null>(null);
  const [home, setHome] = useState<Point | null>(null), [teleports, setTeleports] = useState<MapPlace[] | null>(null);
  const [game, setGame] = useState<{icons: GameIcon[]; labels: GameLabel[]} | null>(null), [details, setDetails] = useState<IconDetails | null>(null);
  const [menu, setMenu] = useState<MapMenuAt | null>(null), [touch, setTouch] = useState(false), [hoverLeg, setHoverLeg] = useState<number | null>(null);
  // A click outside the open menu only closes it: the same click does not open a new one.
  const dismissed = useRef(0);
  const closeMenu = useCallback(() => setMenu(null), []);
  const dismissMenu = useCallback(() => {dismissed.current = Date.now(); setMenu(null);}, []);
  const plan = usePlanner(), request = useRef(0), cache = useRef(new Map<string, Route[]>()), page = useRef<HTMLElement>(null), entrance = useRef<{x: number; y: number} | null>(null);
  const from = trip[0].point, to = trip[trip.length - 1].point;
  // Every visit starts on the surface's ground floor. Exits (cave entrances, trapdoors, ladders into a dungeon) change
  // the area; as on the game's world map there are no floor changes, but a link with a floor (?at= or ?to=) shows it.
  const doors = useMapExits(), plane = spot.plane, box = areaFor(spot.at, doors?.areas);
  const area = useMemo(() => ({x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1}), [box.x0, box.y0, box.x1, box.y1]);
  const go = useCallback((t: Tile, zoom?: number, min?: number) => {setSpot({plane: t.plane, at: {x: t.x, y: t.y}}); setFocus({...t, zoom, min, key: Date.now()});}, []);

  // The page fits the window exactly (no page scroll, so the wheel always zooms the map): the map fills what is left
  // below the site header and the dev environment's banner, whatever height they wrap to, and the side panel scrolls
  // inside itself.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site > .hdr'), banner = document.querySelector<HTMLElement>('.dev-banner'), main = page.current, root = document.documentElement;
    if (!main) return;
    root.classList.add('wm-fit');
    const fit = () => main.style.setProperty('--wm-top', Math.round(main.getBoundingClientRect().top + window.scrollY) + 'px');
    const watch = new ResizeObserver(fit);
    for (const el of [header, banner]) if (el) watch.observe(el);
    fit();
    window.addEventListener('resize', fit);
    return () => {watch.disconnect(); window.removeEventListener('resize', fit); root.classList.remove('wm-fit');};
  }, []);
  useEffect(() => {
    setMounted(true);
    setTouch(!matchMedia('(hover: hover) and (pointer: fine)').matches);
    setSettings(read(KEYS.travel, parseTravelSettings, DEFAULT_TRAVEL));
    setLayers(read(KEYS.layers, v => Array.isArray(v) ? v.filter((l): l is LayerId => LAYERS.some(x => x.id === l)) : DEFAULT_LAYERS, DEFAULT_LAYERS));
    const saved = read<Point | null>(KEYS.home, v => {const p = v as Point; return p && typeof p.label === 'string' && tileParam(`${p.tile?.x},${p.tile?.y},${p.tile?.plane}`) ? {tile: p.tile, label: p.label.slice(0, 80)} : null;}, null);
    setHome(saved);
    // Links from guides open with a destination: /map?to=3222,3218,0&name=Lumbridge; a trip link can add a start and
    // stops: /map?from=…&via=…&via=…&to=…
    const params = new URLSearchParams(window.location.search), target = tileParam(params.get('to')), start = tileParam(params.get('from'));
    const stops = parseStops(params.getAll('via'), tileParam).map((tile, i): Point => ({tile, label: 'Stop ' + (i + 1)}));
    const at = tileParam(params.get('at')), zoom = Number(params.get('zoom'));
    if (target) {setTab('route'); go(target, 9);}
    else if (at) go(at, zoom >= WORLD_ZOOM_MIN && zoom <= 11 ? zoom : 9);
    if (target || start || stops.length) setTrip(tripOf(start ? {tile: start, label: 'Start'} : target && saved ? saved : null, stops, target ? {tile: target, label: (params.get('name') ?? 'Destination').slice(0, 80)} : null));
    fetch('/world-map/places.json').then(r => {if (!r.ok) throw Error(); return r.json() as Promise<PlacesFile>;}).then(f => setPlaces(readPlaces(f))).catch(() => setError('The map places could not be loaded. Try again in a moment.'));
    // The game's own map icons and area names (lib/world-map-game-icons).
    fetch('/world-map/game-icons.json').then(r => r.ok ? r.json() as Promise<GameIconsFile> : null).then(f => f && setGame(readGameIcons(f))).catch(() => {});
    // What the shortcut and fishing spot icons stand for, for their hover cards (they keep their plain names without it).
    fetch('/world-map/icon-details.json').then(r => r.ok ? r.json() as Promise<IconDetailsFile> : null).then(f => f && setDetails(readIconDetails(f))).catch(() => {});
  }, [go]);
  // A floor or area other than the surface's ground floor is kept in the address, so the link opens there.
  useEffect(() => {
    if (!mounted) return;
    const url = new URL(window.location.href), away = spot.plane > 0 || !onSurface(spot.at);
    if (away) url.searchParams.set('at', `${spot.at.x},${spot.at.y},${spot.plane}`); else {url.searchParams.delete('at'); url.searchParams.delete('zoom');}
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [spot, mounted]);
  // The travel options list loads when routes are first wanted.
  useEffect(() => {
    if ((tab !== 'route' && !optionsOpen) || options) return;
    fetch('/world-map/travel-options.json').then(r => r.ok ? r.json() as Promise<TravelOptionsFile> : null).then(setOptions).catch(() => {});
  }, [tab, optionsOpen, options]);
  useEffect(() => {if (tab === 'route') void plan({type: 'load'});}, [tab, plan]);
  // The Teleports layer: every teleport's landing spot, grouped, with the ones outside the travel options dimmed.
  const showTeleports = layers.includes('teleport');
  useEffect(() => {
    if (!showTeleports) return;
    let live = true;
    void plan({type: 'teleports', settings}).then(reply => {if (live && reply.ok && reply.teleports) setTeleports(groupTeleports(reply.teleports));});
    return () => {live = false;};
  }, [showTeleports, settings, plan]);

  // The trip is planned leg by leg (start to the first stop, stop to stop, to the destination); legs already planned
  // with the same travel options come from the cache, so moving one stop only plans the legs it changed.
  const settingsKey = useMemo(() => JSON.stringify(settings), [settings]);
  const legs = useMemo(() => tripLegs(trip).map(l => ({...l, key: legKey(l.from.tile, l.to.tile, settingsKey)})), [trip, settingsKey]);
  useEffect(() => {
    if (!legs.length) {setStatus({state: 'idle'}); return;}
    const id = ++request.current, known = () => Object.fromEntries(legs.flatMap(l => cache.current.has(l.key) ? [[l.key, cache.current.get(l.key)!]] : []));
    const missing = legs.filter((l, i) => !cache.current.has(l.key) && legs.findIndex(x => x.key === l.key) === i);
    if (!missing.length) {setPlans(known()); setStatus({state: 'idle'}); return;}
    setStatus({state: 'busy'});
    void Promise.all(missing.map(l => plan({type: 'plan', from: l.from.tile, to: l.to.tile, settings}).then(reply => ({l, reply})))).then(replies => {
      if (cache.current.size > 60) cache.current.clear();
      let failed: string | null = null;
      for (const {l, reply} of replies) {
        if (reply.ok) cache.current.set(l.key, reply.routes ?? []);
        else failed ??= (legs.length > 1 ? `${l.from.label} to ${l.to.label}: ` : '') + reply.error;
      }
      if (id !== request.current) return;
      setPlans(known());
      setStatus(failed ? {state: 'error', message: failed} : {state: 'idle'});
    });
  }, [legs, settings, plan]);
  const legPlans = legs.map(l => plans[l.key] ? {routes: plans[l.key], active: Math.min(actives[l.key] ?? 0, Math.max(0, plans[l.key].length - 1))} : null);
  const total = tripTime(legPlans);
  const rowColours = trip.map((_, row) => {const leg = legs.findIndex(l => l.toRow === row); return leg >= 0 ? legColour(leg, legs.length) : legs.length > 1 && row > 0 && row < trip.length - 1 ? MAP_LEG_COLOURS[(row - 1) % MAP_LEG_COLOURS.length] : undefined;});
  const groups = useMemo(() => new Map((options?.groups ?? []).map(g => [g.id, g.icon])), [options]);
  const mapLegs = useMemo<MapLeg[]>(() => legs.flatMap((l, i) => {
    const p = plans[l.key], active = Math.min(actives[l.key] ?? 0, Math.max(0, (p?.length ?? 1) - 1));
    const landings = (p?.[active]?.steps ?? []).flatMap(s => {const src = isHop(s) ? stepImage(s, groups) : null; return src ? [{...s.to, icon: src}] : [];});
    return p ? [{routes: p, active, colour: legColour(i, legs.length), faded: hoverLeg !== null && hoverLeg !== i, landings}] : [];
  }), [legs, plans, actives, hoverLeg, groups]);
  const pins = useMemo<MapTripPin[]>(() => trip.flatMap((r, i) => r.point ? [{...r.point.tile, mark: rowMark(i, trip.length), colour: i > 0 && i < trip.length - 1 ? rowColours[i] : undefined}] : []),
    // rowColours follows trip and legs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip, legs]);

  // Game icons of a kind we have a layer for (banks, quest starts, transport) follow that layer's button.
  const gameShown = useMemo(() => game && {labels: game.labels, details, icons: game.icons.filter(i => {const l = gameIconLayer(i.sprite); return !l || layers.includes(l);})}, [game, details, layers]);
  // Transport stops follow Travel options: a network the player switched off is left off the map.
  const usable = useMemo(() => (places ?? []).filter(p => {const n = KIND_NETWORK[p.kind]; return !n || settings.networks[n];}), [places, settings]);
  const counts = useMemo(() => Object.fromEntries(LAYERS.map(l => [l.id, usable.filter(p => (l.kinds as readonly string[]).includes(p.kind)).length])) as Record<LayerId, number>, [usable]);
  const shown = useMemo(() => {
    const kinds = new Set<string>(['town', ...LAYERS.filter(l => layers.includes(l.id)).flatMap(l => [...l.kinds])]);
    // Grouped teleport markers replace the single landing spots once they arrive.
    const list = usable.filter(p => kinds.has(p.kind) && !(p.kind === 'teleport' && teleports));
    return kinds.has('teleport') && teleports ? [...list, ...teleports] : list;
  }, [usable, layers, teleports]);

  const changeSettings = (s: TravelSettings) => {setSettings(s); save(KEYS.travel, s);};
  const toggleLayer = (id: LayerId) => setLayers(list => {const next = list.includes(id) ? list.filter(l => l !== id) : [...list, id]; save(KEYS.layers, next); return next;});
  const openOptions = (how: 'modal' | 'sheet' = 'modal') => {setOptionsTab('Teleports'); setOptionsOpen(how);};
  // The map's Teleports button opens the teleport options (the Teleports layer itself is switched in Explore). On a
  // phone the options open as a sheet under the map (scrolled to the top of the screen), so the map stays in view.
  const quickTeleports = () => {
    const phone = matchMedia('(max-width: 820px)').matches, map = page.current?.querySelector('.wm-map');
    if (phone && map) window.scrollTo({top: window.scrollY + map.getBoundingClientRect().top, behavior: 'instant'});
    openOptions(phone ? 'sheet' : 'modal');
  };
  const show = (p: Point) => {setSelected(p); go(p.tile);};
  const onExit = (e: MapExit) => {if (onSurface(e.from) && !onSurface(e.to)) entrance.current = e.from; go(e.to, undefined, 9);};
  const back = () => {
    if (onSurface(spot.at)) {setSpot({plane: 0, at: spot.at}); return;}
    const out = entrance.current ?? wayOut(doors?.exits ?? [], area, spot.at, doors?.areas) ?? START;
    entrance.current = null;
    go({x: out.x, y: out.y, plane: 0});
  };
  const backText = backLabel(spot);
  // Where the map is, beside the way back: the underground area, or the town and floor.
  const town = places && spot.plane > 0 ? townNear(places, spot.at) : null;
  const where = !onSurface(spot.at) ? undergroundName(spot.at, doors?.areas) ?? 'Underground' : spot.plane > 0 ? (town ? town + ' · ' : '') + FLOORS[spot.plane] + ' floor' : null;
  const describe = (t: Tile, name?: string): Point => {const near = places && nearestPlace(places, t.x, t.y, t.plane); return {tile: t, label: name ?? (near ? `Near ${near.name}` : `Tile ${t.x}, ${t.y}`)};};
  const pointOf = (p: MapPlace): Point => ({tile: {x: p.x, y: p.y, plane: p.plane}, label: p.name, icon: listIcon(p), place: p});
  const setRowPoint = (id: number, p: Point) => setTrip(t => t.map(r => r.id === id ? {...r, point: p} : r));
  // With a row's pick button on, a click on the map (or a place) fills that row.
  const onTile = (t: Tile) => {if (pick !== null) {setRowPoint(pick, describe(t)); setPick(null);}};
  const onPlace = (p: MapPlace) => {
    if (pick !== null) {setRowPoint(pick, pointOf(p)); setPick(null); return;}
    setMenu(null);
    setSelected(pointOf(p));
  };
  // The map's icons (shops, altars, fishing spots, dungeon entrances) open the same card as a place.
  // An icon's details ("Shrimp, anchovies · 1 Fishing", "Crumbling wall · 5 Agility") are a row in the card, so the long
  // ones are not cut short under the name.
  const onIcon = (i: MapIconPick) => {setMenu(null); setSelected({tile: i.tile, label: i.info.title, icon: i.icon, info: i.exit ? i.info : iconRows(i.info), exit: i.exit});};
  const onMenu = useCallback((m: MapMenuAt) => {if (Date.now() - dismissed.current > 400) {setSelected(null); setMenu(m);}}, []);
  const act = (action: TripAction, p: Point) => {
    setTrip(t => {const next = applyTripAction(t, action, p); return action !== 'from' && !next[0].point && home && !sameTile(home.tile, p.tile) ? setEnd(next, 'from', home) : next;});
    setPick(null); setTab('route'); setSelected(null);
  };
  const fromMenu = (action: TripAction) => {
    if (!menu) return;
    const p = menu.place;
    setMenu(null);
    act(action, p ? pointOf(p) : describe(menu.tile, menu.name));
  };
  const quest = selected?.place?.quest;
  // The selected spot's card: what it is under its name, then its facts (a quest's difficulty and length, the floor).
  const floor = selected?.tile.plane ? FLOORS[selected.tile.plane] + ' floor' : '';
  const way = selected?.exit && exitAction(selected.exit), iconTown = selected?.info && places ? townNear(places, selected.tile) : null;
  const cardKind = quest ? KIND_LABEL.quest : selected?.info ? selected.info.detail || (iconTown ? 'Near ' + iconTown : 'Map icon') : selected?.place ? [KIND_LABEL[selected.place.kind], selected.place.detail].filter(Boolean).join(' · ') : selected ? `Tile ${selected.tile.x}, ${selected.tile.y}` : '';
  const cardFacts = ([['Difficulty', quest?.difficulty], ['Length', quest?.length], ['Floor', floor]] as [string, string | undefined][]).filter((f): f is [string, string] => !!f[1]);
  const pickRow = pick === null ? -1 : trip.findIndex(r => r.id === pick);
  const stops = stopCount(trip);

  return <div className="site"><PublicHeader page="map" onError={setError}/>
    <main ref={page} className="wm-page">
      <aside className="wm-panel" aria-label="World map">
        <div className="wm-head">
          <div className="wtabs wm-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'explore'} onClick={() => {setTab('explore'); setPick(null);}}><img className="wm-tab-icon" src="/icons/map/interface/explore.png" alt="" width={20} height={20}/>Explore</button>
            <button type="button" role="tab" aria-selected={tab === 'route'} onClick={() => setTab('route')}><img className="wm-tab-icon" src="/icons/map/interface/directions.png" alt="" width={20} height={20}/>Directions</button>
          </div>
          <button type="button" className="icon-btn wm-options-btn" aria-label="Teleports & travel" title="Teleports & travel" aria-haspopup="dialog" onClick={() => openOptions()}><img src={LAYER_ICON.teleport} alt="" width={26} height={26}/></button>
        </div>
        <div className="wm-panel-body">
          {error && <p role="alert" className="wm-error">{error}</p>}
          {tab === 'explore' ? <>
            <PlaceField label="Search" value={null} places={places ?? []} onPick={p => show(p)}/>
            <div className="wm-layers" role="group" aria-label="Show on the map">{LAYERS.map(l => {const on = layers.includes(l.id); return <button key={l.id} type="button" aria-pressed={on} onClick={() => toggleLayer(l.id)}>
              <img src={LAYER_ICON[l.id]} alt=""/><span className="wm-layer-name">{l.label}</span><small>{places ? counts[l.id] : ''}</small><span className="wm-layer-check" aria-hidden="true">{on && <Check size={13} strokeWidth={3}/>}</span>
            </button>;})}</div>
            <p className="wm-hint">{places ? 'Zoom in to see every place.' : 'Loading places…'}</p>
          </> : <>
            <div className="wm-trip-box">
              <TripRows trip={trip} colours={rowColours} places={places ?? []} pick={pick} onChange={setTrip} onPick={setRowPoint} onPickMap={setPick}/>
              <button type="button" className="wm-swap" aria-label="Reverse the trip" title="Reverse" onClick={() => setTrip(reverseTrip)}><ArrowUpDown size={16}/></button>
            </div>
            <div className="wm-trip-actions">
              {home && !sameTile(home.tile, from?.tile) ? <button type="button" className="wm-link" onClick={() => setTrip(t => setEnd(t, 'from', home))}><LocateFixed size={15} aria-hidden="true"/>My location</button>
                : from ? <button type="button" className="wm-link" disabled={sameTile(home?.tile, from.tile)} onClick={() => {setHome(from); save(KEYS.home, from);}}><LocateFixed size={15} aria-hidden="true"/>{sameTile(home?.tile, from.tile) ? 'My location' : 'Set as my location'}</button>
                : <span/>}
              <button type="button" className="wm-link" onClick={() => openOptions()}>{travelSummary(settings)}</button>
            </div>
            {pickRow >= 0 && <p className="wm-hint is-picking"><Crosshair size={14} aria-hidden="true"/>Click the map to set the {pickRow === 0 ? 'start' : pickRow === trip.length - 1 ? 'destination' : 'stop'}.</p>}
            {status.state === 'busy' && <p className="wm-hint" role="status"><span className="wm-spinner" aria-hidden="true"/>Finding the quickest routes…</p>}
            {status.state === 'error' && <p className="wm-error" role="alert">{status.message}</p>}
            {status.state === 'idle' && !legs.length && pickRow < 0 && (from || to || stops > 0) && <p className="wm-hint">Choose both ends of the trip.</p>}
            {!legPlans.some(Boolean) && pickRow < 0 && <p className="wm-hint"><MousePointerClick size={14} aria-hidden="true"/>{touch ? 'Tap' : 'Click'} the map to start, end or add a stop.</p>}
            {total !== null && <p className="wm-trip-total"><b>{travelTime(total)}</b><span>total{legs.length > 1 ? ` · ${legs.length} legs` : ''}{stops ? ` · ${stops} stop${stops === 1 ? '' : 's'}` : ''}</span></p>}
            {legs.length > 0 && <ol className={'wm-itin' + (status.state === 'busy' ? ' is-stale' : '')} aria-label="Route">
              {legs.map((l, i) => <Fragment key={l.key + i}>
                {i === 0 && <TimelineNode mark={rowMark(l.fromRow, trip.length)} colour={rowColours[l.fromRow]} label={l.from.label}/>}
                <TimelineLeg key={l.key} plan={legPlans[i]} colour={legColour(i, legs.length)} name={l.to.label} places={places ?? []} groups={groups}
                  onSelect={r => setActives(a => ({...a, [l.key]: r}))} onHover={on => setHoverLeg(h => on ? i : h === i ? null : h)}/>
                <TimelineNode mark={rowMark(l.toRow, trip.length)} colour={rowColours[l.toRow]} label={l.to.label}/>
              </Fragment>)}
            </ol>}
            {legPlans.some(Boolean) && <p className="fine">Running times. Checks only quests, Agility and Magic.</p>}
          </>}
          <p className="fine wm-credit"><a href="/credits#maps">Map data credits &amp; licences</a></p>
        </div>
      </aside>
      <section className="wm-map" aria-label="Map">
        {mounted ? <Suspense fallback={<div className="wm-canvas wm-loading" role="status">Loading the map…</div>}><WorldMapView plane={plane} area={area} areas={doors?.areas ?? []} exits={doors?.exits ?? []} onExit={onExit} places={shown} selected={selected ? {...selected.tile, icon: selected.icon, place: selected.place} : null} pins={pins} legs={mapLegs} focus={focus} picking={pick !== null} onTile={onTile} onPlace={onPlace} game={gameShown} onMenu={onMenu} onMenuClose={closeMenu} onIcon={onIcon}/></Suspense> : <div className="wm-canvas wm-loading" role="status">Loading the map…</div>}
        {backText && <div className="wm-where">
          {where && <span className="wm-where-name">{where}</span>}
          <button type="button" className="map-back wm-back" onClick={back}>{onSurface(spot.at) ? <ArrowDown size={16} aria-hidden="true"/> : <ArrowUp size={16} aria-hidden="true"/>}{backText}</button>
        </div>}
        {menu && <MapMenu at={menu} canStop={canAddStop(trip)} onChoose={fromMenu} onClose={closeMenu} onDismiss={dismissMenu}/>}
        <button type="button" className="wm-quick-teleports" onClick={quickTeleports} aria-haspopup="dialog" aria-label="Teleports" title="Teleports"><img src={LAYER_ICON.teleport} alt=""/></button>
        {selected && <div className="wm-card" role="dialog" aria-label={selected.label}>
          <header>{selected.icon ? <img src={selected.icon} alt=""/> : <MapPin size={24} aria-hidden="true"/>}<div><h2 title={selected.label}>{selected.label}</h2><small>{cardKind}</small></div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => setSelected(null)}><X size={18}/></button></header>
          {cardFacts.length > 0 && <dl className="wm-card-facts">{cardFacts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{k === 'Difficulty' && difficultyIcon(v) ? <span className="diff"><img src={difficultyIcon(v)} alt=""/>{v}</span> : v}</dd></div>)}</dl>}
          {quest?.start && <p className="wm-card-start">{quest.start}</p>}
          {!!selected.info?.rows.length && <ul className="wm-card-rows">{selected.info.rows.map(r => <li key={r.text}><span title={r.text}>{r.text}</span>{r.level && <small>{r.level}</small>}</li>)}</ul>}
          {selected.place?.teleports && <ul className="wm-card-teleports">{selected.place.teleports.map((t, i) => <li key={i} className={t.ok ? '' : 'is-off'} title={[t.label === t.name ? '' : t.name, t.ok ? '' : 'Not in your travel options'].filter(Boolean).join(' · ') || undefined}><img src={t.icon} alt=""/><span>{t.label}</span>{!t.label.startsWith(t.via) && !t.via.startsWith(t.label) && <small>{t.via}</small>}</li>)}</ul>}
          <div className="wm-card-actions">
            {/* A way into another area goes through first (the game's Dungeon icon in, its Map link arrow back out). */}
            {selected.exit && <button type="button" className="btn primary is-wide wm-card-way" onClick={() => {const e = selected.exit!; setSelected(null); onExit(e);}}><img src={GAME_ICON(way === 'Exit' ? GAME_SPRITE.mapLink : GAME_SPRITE.dungeon)} alt=""/>{way}</button>}
            <button type="button" className={'btn is-wide' + (selected.exit ? '' : ' primary')} onClick={() => act('to', selected)}><Navigation size={15} aria-hidden="true"/>Directions to here</button>
            <button type="button" className="btn" onClick={() => act('from', selected)}><Flag size={15} aria-hidden="true"/>Start here</button>
            <button type="button" className="btn" disabled={!canAddStop(trip)} onClick={() => act('stop', selected)}><ListPlus size={15} aria-hidden="true"/>Add a stop</button>
            {quest && <GuideLink activity={quest.name}/>}
          </div>
        </div>}
      </section>
    </main>
    {optionsOpen && <TravelOptions value={settings} options={options} onChange={changeSettings} onClose={() => setOptionsOpen(false)} sheet={optionsOpen === 'sheet'} initialTab={optionsTab}/>}
  </div>;
}
