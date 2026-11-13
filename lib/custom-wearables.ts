/** Worn items the site adds that the game does not have, joined to the game's own (lib/wearables.json) for profile
 * characters only: they are left out of guide items, prices and searches. Each reuses a game model. */
import type {StaffRole} from './staff-policy';
import {IS_DEV_ENVIRONMENT} from './environment';
import {COMPLETIONIST_CAPE,MAX_CAPE,MAX_CAPE_VARIANTS,SKILL_CAPES} from './item-variants';

/** The completionist cape: the max cape's model and colours, with embers falling from its hem (app/cape-embers.ts).
 * An ID far above the game's own, so it never meets a real item. Each of the game's max cape versions has a
 * completionist version too: that version's model and colours, with the same embers (lib/item-variants.ts). */
export {COMPLETIONIST_CAPE};
type CustomWearable = {name: string; slot: 'cape'; wear: number[]; blocks: []; file: string; effect: 'embers'};
const completionist = (name: string, model: string): CustomWearable => ({name, slot: 'cape', wear: [1], blocks: [], file: `items/${model}.gltf`, effect: 'embers'});
export const CUSTOM_WEARABLES: Record<string, CustomWearable> = {
  [COMPLETIONIST_CAPE]: completionist('Completionist cape', MAX_CAPE),
  ...Object.fromEntries(MAX_CAPE_VARIANTS.map(v => [v.completionist, completionist(`${v.label} completionist cape`, v.id)])),
};
/** Female body models for the custom items, by ID (the game's own are in lib/appearance-models.json). */
export const CUSTOM_FEMALE_MODELS: Record<string, string> = {
  [COMPLETIONIST_CAPE]: `female/items/${MAX_CAPE}.gltf`,
  ...Object.fromEntries(MAX_CAPE_VARIANTS.map(v => [v.completionist, `female/items/${v.id}.gltf`])),
};
export const isCustomWearable = (id: string) => Object.hasOwn(CUSTOM_WEARABLES, id);
/** Items a staff rank may wear without earning them: for now the completionist cape is for admins and the owner only
 * (its versions still need the cape each one is made with, lib/item-variants.ts capeVariantUnlocks). On the dev site
 * they may also wear every skill cape and the max cape, to try outfits; the live site keeps the 99 rules. */
export function staffWearables(role: StaffRole | null | undefined, dev = IS_DEV_ENVIRONMENT): string[] {
  if (role !== 'admin' && role !== 'owner') return [];
  return dev ? [COMPLETIONIST_CAPE, ...Object.values(SKILL_CAPES).flat(), MAX_CAPE] : [COMPLETIONIST_CAPE];
}
