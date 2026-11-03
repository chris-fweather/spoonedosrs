import type {SkinTone} from './appearance';
import {SKIN_COLORS,cacheHex,cacheRgb} from './game-colors';
export const BASE_SKIN_RGB=cacheRgb(4550);
export function skinColor(rgb:number[],tone:SkinTone):number[]|null {
 if(tone==='default'||!rgb.every((v,i)=>Math.abs(v-BASE_SKIN_RGB[i])<1e-5))return null;
 return cacheRgb(SKIN_COLORS[tone]);
}
const bytes=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const BASE_SKIN_BYTES=bytes(cacheHex(4550));
/** Item palette textures store colours as 8-bit sRGB, one step off the cache colour after rounding, so the base skin
 * (a face under a helmet, bare hands) is matched within one step. Returns the tone's 8-bit colour, or null. */
export function skinPixel(rgb:ArrayLike<number>,tone:SkinTone):number[]|null {
 if(tone==='default'||![0,1,2].every(i=>Math.abs(rgb[i]-BASE_SKIN_BYTES[i])<=1))return null;
 return bytes(cacheHex(SKIN_COLORS[tone]));
}
