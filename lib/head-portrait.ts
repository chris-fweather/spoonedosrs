import heads from './head-portraits.json' with {type: 'json'};
import {parseAppearance,type Appearance} from './appearance';
import {wearables} from './flair';

/** x, y, width, height in portrait units: the bare-head portrait (public/portraits) fills 0 0 40 44. */
export type PortraitBox = [number, number, number, number];
export type HeadLayer = {src: string; box: PortraitBox};
/** A character head wearing its head-slot item: pre-drawn layers (scripts/build-head-portraits.mjs) stacked in one frame. */
export type HeadPortrait = {frame: PortraitBox; layers: HeadLayer[]};

const manifest = heads as unknown as {jaw: Record<'male'|'female', PortraitBox>; male: Record<string, PortraitBox>; female: Record<string, PortraitBox>};
const BASE: PortraitBox = [0, 0, 40, 44];
/** Tall hats are cut at the top and wide ones at the sides, so the face never shrinks below about two thirds. */
const MAX_WIDTH = 60, MAX_HEIGHT = 66;
const VERSION = 'h1';

/** The frame around every layer, kept to the size limits with the chin at the bottom and the face centred. */
function frame(boxes: PortraitBox[]): PortraitBox {
  let left = Math.min(...boxes.map(b => b[0])), top = Math.min(...boxes.map(b => b[1]));
  let right = Math.max(...boxes.map(b => b[0] + b[2]));
  const bottom = Math.max(...boxes.map(b => b[1] + b[3]));
  if (right - left > MAX_WIDTH) { left = 20 - MAX_WIDTH / 2; right = 20 + MAX_WIDTH / 2; }
  if (bottom - top > MAX_HEIGHT) top = bottom - MAX_HEIGHT;
  return [left, top, right - left, bottom - top];
}

/** The head with its worn head-slot item, or null when nothing (or nothing drawn) is worn there, so the plain
 * portrait shows. As on the 3D character (lib/appearance.ts headModel), an item that covers the head (identity slot 8)
 * replaces it, keeping only the jaw when the item leaves slot 11 open. Skin faces take the tone from the URL fragment. */
export function headPortrait(appearance: Appearance, headItem: string | null | undefined, portrait: string): HeadPortrait | null {
  if (!headItem) return null;
  const look = parseAppearance(appearance), item = wearables.items[headItem];
  const box = Object.hasOwn(manifest[look.body], headItem) ? manifest[look.body][headItem] : undefined;
  if (!item || item.slot !== 'head' || !box) return null;
  const tone = look.skin && look.skin !== 'default' ? `#${look.skin}` : '';
  const layers: HeadLayer[] = [];
  if (!item.wear.includes(8)) layers.push({src: portrait, box: BASE});
  else if (!item.wear.includes(11)) layers.push({src: `/portraits/heads/${look.body}-jaw.svg?v=${VERSION}${tone}`, box: manifest.jaw[look.body]});
  layers.push({src: `/portraits/heads/${look.body}-${headItem}.svg?v=${VERSION}${tone}`, box});
  return {frame: frame(layers.map(layer => layer.box)), layers};
}
