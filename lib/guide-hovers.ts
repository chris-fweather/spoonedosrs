/** Which hover card a game thing in a guide shows. One place decides it, so every kind of thing gets the same card
 * wherever it appears: items their price card, skills their skill card, travel (teleports, fairy rings, spirit trees and
 * other transport stops) a card with where it lands on the map, prayers and other spells a card with what they do and
 * need (lib/guide-magic). A new kind (a quest, an NPC) adds its card here
 * and in app/EntityHover.tsx. Anything else shows no card, only its name. */
import type {GuideReference} from './guide-references';
import type {TravelKind} from './guide-travel';
import {guideMagic} from './guide-magic';

export type HoverCard = 'price' | 'skill' | 'travel' | 'magic';
/** A thing a guide shows that a card can describe. */
export type HoverTarget =
  | {kind: 'item'; id: string}
  | {kind: 'skill'; name: string}
  /** A travel destination by its kind and name in the travel data (lib/guide-travel). */
  | {kind: 'travel'; travel: TravelKind; name: string}
  /** A prayer, or a spell that is not travel (lib/guide-magic). */
  | {kind: 'prayer' | 'spell'; name: string}
  /** A custom requirement ("10,000 coins, or 33 Magic for Telekinetic Grab"): it only borrows an item's icon, so the
   * item's price would describe the wrong thing. */
  | {kind: 'other-requirement'; label: string; iconItem: string | null};

export function hoverCard(target: HoverTarget): HoverCard | null {
  if (target.kind === 'item') return 'price';
  if (target.kind === 'skill') return 'skill';
  if (target.kind === 'travel') return 'travel';
  if ((target.kind === 'prayer' || target.kind === 'spell') && guideMagic(target.kind, target.name)) return 'magic';
  return null;
}
/** The hover target for an inline [[game term]]: items, skills, travel, prayers and other spells; quests and other terms
 * have none yet. */
export function referenceTarget(r: GuideReference): HoverTarget | null {
  if (r.itemId) return {kind: 'item', id: r.itemId};
  if (r.kind === 'skill') return {kind: 'skill', name: r.name};
  if (r.travel) return {kind: 'travel', travel: r.travel.kind, name: r.travel.name};
  if ((r.kind === 'prayer' || r.kind === 'spell') && guideMagic(r.kind, r.name)) return {kind: r.kind, name: r.name};
  return null;
}
