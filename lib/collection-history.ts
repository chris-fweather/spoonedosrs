import type {Journal} from './model';
import {milestoneEvents} from './skill-milestones';

/** Acquisition dates are calendar days, never import or first-seen timestamps. */
export function validCollectionDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2013-02-22' || value > new Date().toISOString().slice(0, 10)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function collectionDate(j: Journal, id: number): string {
  const pet = j.pets.find(p => p.id === String(id));
  return pet ? (pet.obtained ? pet.date : '') : j.collectionDates?.[String(id)] ?? '';
}

export function setCollectionDate(j: Journal, id: number, date: unknown): Journal {
  if (!Number.isSafeInteger(id) || !validCollectionDate(date)) throw Error('Choose a valid collection date, or leave it blank.');
  if (!j.log?.tabs.some(t => t.pages.some(p => p.items.some(i => i.id === id && i.quantity > 0)))) throw Error('Sync this collected item before recording its date.');
  const pet = j.pets.find(p => p.id === String(id));
  // Setting a date, or clearing it, is the player's confirmation of anything the plugin recorded.
  if (pet) return {...j, pets: j.pets.map(p => {
    if (p.id !== pet.id) return p;
    const confirmed = {...p, obtained: true, date};
    delete confirmed.unconfirmed;
    return confirmed;
  })};
  const dates = {...j.collectionDates};
  if (date) dates[String(id)] = date;
  else delete dates[String(id)];
  const unconfirmedDates = j.unconfirmedDates?.filter(other => other !== String(id));
  return {...j, collectionDates: dates, unconfirmedDates: unconfirmedDates?.length ? unconfirmedDates : undefined};
}

export type TimelineKind = 'pets' | 'log' | 'skills';
/** One dated thing on the Player timeline: a pet, a collection log slot or a skill milestone. */
export type CollectionEvent = {id: string; kind: TimelineKind; name: string; date: string; image: string; approximate?: boolean};
export function collectionEvents(j: Journal): {events: CollectionEvent[]; undated: number} {
  if (j.restricted) return {events: [], undated: 0};
  const events: CollectionEvent[] = [];
  let undated = 0;
  const seen = new Set(j.pets.map(p => Number(p.id)));
  if (j.details?.pets !== false) for (const p of j.pets.filter(p => p.obtained)) {
    if (p.date) events.push({id: 'pet:' + p.id, kind: 'pets', name: p.name, date: p.date, image: `/pets/${p.id}.png`});
    else undated++;
  }
  if (j.details?.log !== false) for (const t of j.log?.tabs ?? []) for (const p of t.pages) for (const i of p.items) {
    if (!i.quantity || seen.has(i.id)) continue;
    seen.add(i.id);
    const date = j.collectionDates?.[String(i.id)];
    if (date) events.push({id: 'log:' + i.id, kind: 'log', name: i.name, date, image: `/items/${i.id}.png`});
    else undated++;
  }
  for (const m of milestoneEvents(j)) events.push({id: 'skill:' + m.key, kind: 'skills', name: m.name, date: m.date, image: m.image, ...(m.approximate ? {approximate: true} : {})});
  return {events: events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)), undated};
}
