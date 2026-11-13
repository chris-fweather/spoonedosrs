import type {Journal, Method, Pet} from './model';
import {countedMethods, lifetimeSkill, oddsMethod, selectedMethod, usesAcquisition} from './estimates';
import {receivedMethod} from './hunt-history';
import {attemptsFor, chanceAfter} from './ui';

/** What a pet's odds graph draws, and what an obtained pet's luck reads (`lib/pet-luck.ts`), so the two always agree.
 * A missing acquisition count is never invented.
 * - The obtained count, when it is recorded.
 * - Otherwise the method the player chose ("Got it from" once obtained, the planned method before), at its count.
 * - An obtained pet with no method chosen shows the method that has a count, by name (Tangleroot at its Hespori
 *   kills), or the planned method when none has one.
 * - A method without a rate borrows the pet's first rated method in the same unit, so every pet with a rate has a graph.
 * - A skilling method counted in XP with no count is marked at lifetime XP in its skill (`Lifetime XP`). Lifetime XP
 *   includes lamps, quests and other methods, so it is the most the player can have spent, not the hunt. */
/** A method counted in actions and the same method counted in XP, for pets whose default is the action count (Rocky
 * defaults to Ardougne knight pickpockets). Before the pet is obtained, a method with no count is shown at lifetime XP
 * through its XP twin. */
const XP_TWIN: Record<string, Record<string, string>> = {Rocky: {'Ardougne knights': 'Ardy Knights'}};

export function petChartRecord(pet: Pet, journal?: Journal): {method: Method | undefined; label: string; chosen: boolean} {
  if (usesAcquisition(pet)) return {method: oddsMethod(pet), label: 'Obtained', chosen: true};
  // An obtained count in another unit than its method is not replaced by today's count: no marker.
  if (pet.obtained && pet.obtainedCount != null) return {method: oddsMethod(pet), label: 'Obtained', chosen: true};
  const chosen = pet.obtained ? receivedMethod(pet) : selectedMethod(pet);
  const counted = pet.obtained && !chosen ? countedMethods(pet).find(m => m.rate) : undefined;
  let method = chosen ?? counted ?? selectedMethod(pet);
  let label = counted && counted !== selectedMethod(pet) ? `Current progress (${counted.name})` : 'Current progress';
  if (method && !method.rate) {
    const unit = method.unit, rated = pet.methods.find(m => m.rate && m.unit === unit) ?? pet.methods.find(m => m.rate);
    if (rated) method = rated;
  }
  if (method?.kc == null && journal) {
    const twin = !pet.obtained && method && method.unit !== 'XP' ? pet.methods.find(m => m.unit === 'XP' && m.rate && m.name === XP_TWIN[pet.name]?.[method!.name]) : undefined;
    const xpMethod = method?.unit === 'XP' && method.rate ? method : twin;
    const skill = xpMethod && journal.hiscores?.skills ? lifetimeSkill(pet, journal) : undefined;
    if (xpMethod && skill && skill.xp >= 0) {method = {...xpMethod, kc: skill.xp}; label = 'Lifetime XP';}
  }
  return {method, label, chosen: !!chosen};
}

/** Include the exact marker in the hover dataset, not just the evenly spaced curve samples. */
export function oddsCurve(probability: number, current: number | null | undefined, continuous = false, steps = 60) {
  const count = current != null && Number.isFinite(current) && current >= 0 ? current : null;
  const chance = (n: number) => continuous ? -Math.expm1(-n * probability) : chanceAfter(n, probability);
  const at = (p: number) => continuous ? -Math.log1p(-p) / probability : attemptsFor(p, probability);
  const max = Math.max(at(.99), (count ?? 0) * 1.1);
  const counts = Array.from({length: steps + 1}, (_, i) => continuous ? i * max / steps : Math.round(i * max / steps));
  if (count != null) counts.push(count);
  const curve = [...new Set(counts)].sort((a, b) => a - b).map(a => ({a, c: chance(a)}));
  return {curve, max, count, chance: count == null ? null : chance(count), at};
}
