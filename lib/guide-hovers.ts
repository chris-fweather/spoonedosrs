/** Which hover card a game thing in a guide shows. One place decides it, so every kind of thing gets the same card
 * wherever it appears: items their price card, skills their skill card, travel (teleports, fairy rings, spirit trees and
 * other transport stops) a card with where it lands on the map, prayers and other spells a card with what they do and
 * need (lib/guide-magic), quests a card with their difficulty, start and requirements (lib/quest-info). A new kind (an NPC) adds its card here
 * and in app/EntityHover.tsx. Anything else shows no card, only its name. */
import type {GuideReference} from './guide-references';
import type {TravelKind} from './guide-travel';
import {guideMagic} from './guide-magic';
import {questInfo} from './quest-info';

export type HoverCard = 'price' | 'skill' | 'travel' | 'magic' | 'quest';
/** A thing a guide shows that a card can describe. */
export type HoverTarget =
  | {kind: 'item'; id: string}
  | {kind: 'skill'; name: string}
  /** A travel destination by its kind and name in the travel data (lib/guide-travel). */
  | {kind: 'travel'; travel: TravelKind; name: string}
  /** A prayer, or a spell that is not travel (lib/guide-magic). */
  | {kind: 'prayer' | 'spell'; name: string}
  /** A quest on the site's quest list (lib/quest-info). */
  | {kind: 'quest'; name: string}
  /** A custom requirement ("Anti-venom+", "Fairy ring access"): one with an item's icon shows that item's price card, like
   * the item requirements; one without shows none. */
  | {kind: 'other-requirement'; label: string; iconItem: string | null};

export function hoverCard(target: HoverTarget): HoverCard | null {
  if (target.kind === 'item' || (target.kind === 'other-requirement' && target.iconItem)) return 'price';
  if (target.kind === 'skill') return 'skill';
  if (target.kind === 'travel') return 'travel';
  if ((target.kind === 'prayer' || target.kind === 'spell') && guideMagic(target.kind, target.name)) return 'magic';
  if (target.kind === 'quest' && questInfo(target.name)) return 'quest';
  return null;
}
/** The hover target for an inline [[game term]]: items, skills, travel, prayers, other spells and quests; other terms
 * have none yet. */
export function referenceTarget(r: GuideReference): HoverTarget | null {
  if (r.itemId) return {kind: 'item', id: r.itemId};
  if (r.kind === 'skill') return {kind: 'skill', name: r.name};
  if (r.travel) return {kind: 'travel', travel: r.travel.kind, name: r.travel.name};
  if ((r.kind === 'prayer' || r.kind === 'spell') && guideMagic(r.kind, r.name)) return {kind: r.kind, name: r.name};
  if (r.kind === 'quest' && questInfo(r.name)) return {kind: 'quest', name: r.name};
  return null;
}
