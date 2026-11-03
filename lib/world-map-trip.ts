/** A world map trip: a start, any number of stops and a destination, planned one leg at a time (start to the first
 * stop, stop to stop, the last stop to the destination). The rows are what the Directions tab lists: the first is the
 * start and the last the destination, whatever order the player drags them into. */

/** The most stops between the start and the destination. */
export const MAX_STOPS = 8;

export type TripRow<P> = {id: number; point: P | null};
type Tile = {x: number; y: number; plane: number};

let lastId = 0;
/** A new row, with an id that stays with it while it is dragged around. */
export function tripRow<P>(point: P | null): TripRow<P> {return {id: ++lastId, point};}
/** An empty trip: no start and no destination. */
export function emptyTrip<P>(): TripRow<P>[] {return [tripRow<P>(null), tripRow<P>(null)];}
/** A trip through these points in order (a missing start or destination stays empty). */
export function tripOf<P>(from: P | null, stops: P[], to: P | null): TripRow<P>[] {
  return [tripRow(from), ...stops.slice(0, MAX_STOPS).map(p => tripRow<P>(p)), tripRow(to)];
}

export const stopCount = (trip: readonly TripRow<unknown>[]) => Math.max(0, trip.length - 2);
export const canAddStop = (trip: readonly TripRow<unknown>[]) => stopCount(trip) < MAX_STOPS || !trip[trip.length - 1]?.point;

/** Set the start or the destination. */
export function setEnd<P>(trip: TripRow<P>[], role: 'from' | 'to', point: P | null): TripRow<P>[] {
  const i = role === 'from' ? 0 : trip.length - 1;
  return trip.map((r, j) => j === i ? {...r, point} : r);
}
/** Set the point of one row. */
export function setRow<P>(trip: TripRow<P>[], index: number, point: P | null): TripRow<P>[] {
  return trip.map((r, j) => j === index ? {...r, point} : r);
}
/** "Add a stop": the point becomes a stop just before the destination. With no destination yet it becomes the
 * destination; with the stops full nothing changes. */
export function addStop<P>(trip: TripRow<P>[], point: P): TripRow<P>[] {
  const last = trip.length - 1;
  if (!trip[last].point) return setRow(trip, last, point);
  if (stopCount(trip) >= MAX_STOPS) return trip;
  return [...trip.slice(0, last), tripRow(point), trip[last]];
}
/** The × on a row: a stop goes; the start or destination of a trip without stops is cleared (a trip always has both
 * rows), and with stops the next stop moves up to be the start (or the last stop becomes the destination). */
export function removeRow<P>(trip: TripRow<P>[], index: number): TripRow<P>[] {
  if (trip.length <= 2) return setRow(trip, index, null);
  return trip.filter((_, j) => j !== index);
}
/** Move a row (drag and drop, or the up and down buttons). */
export function moveRow<P>(trip: TripRow<P>[], from: number, to: number): TripRow<P>[] {
  if (from === to || from < 0 || to < 0 || from >= trip.length || to >= trip.length) return trip;
  const next = [...trip], [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}
/** The trip backwards (the swap button). */
export const reverseTrip = <P>(trip: TripRow<P>[]) => [...trip].reverse();

/** The legs to plan, in order: one between each pair of filled rows, once the start and destination are both set.
 * `fromRow` and `toRow` are the rows' places in the list (an empty row dragged into the middle is skipped). */
export function tripLegs<P>(trip: readonly TripRow<P>[]): {from: P; to: P; index: number; fromRow: number; toRow: number}[] {
  if (!trip[0]?.point || !trip[trip.length - 1]?.point) return [];
  const rows = trip.flatMap((r, row) => r.point === null ? [] : [{point: r.point, row}]);
  return rows.slice(1).map((to, i) => ({from: rows[i].point, to: to.point, index: i, fromRow: rows[i].row, toRow: to.row}));
}
/** A leg's cache key: its two tiles and the travel options it was planned with. */
export const legKey = (from: Tile, to: Tile, settings: string) => `${from.x},${from.y},${from.plane}>${to.x},${to.y},${to.plane}|${settings}`;

/** The letter or number on a row's pin: A for the start, B for the destination, 1, 2… for the stops. */
export const rowMark = (index: number, length: number) => index === 0 ? 'A' : index === length - 1 ? 'B' : String(index);

/** A whole trip from its planned legs: the time of the chosen route of each leg added up, once every leg has one. */
export function tripTime(legs: readonly ({routes: readonly {ticks: number}[]; active: number} | null)[]): number | null {
  let total = 0;
  for (const leg of legs) {
    const route = leg?.routes[leg.active] ?? leg?.routes[0];
    if (!route) return null;
    total += route.ticks;
  }
  return legs.length ? total : null;
}

/** Stops from a link: /map?from=…&via=3093,3243,0&via=…&to=… (at most MAX_STOPS, bad ones left out). */
export function parseStops<T>(values: readonly string[], parse: (v: string) => T | null): T[] {
  return values.map(parse).filter((t): t is T => t !== null).slice(0, MAX_STOPS);
}

/** What the map's menu and a place card can do with a spot. */
export type TripAction = 'from' | 'to' | 'stop';
/** The trip after a menu or card action on a point. "Directions to here" on a trip with stops keeps them and replaces
 * the destination. */
export function applyTripAction<P>(trip: TripRow<P>[], action: TripAction, point: P): TripRow<P>[] {
  return action === 'stop' ? addStop(trip, point) : setEnd(trip, action, point);
}
