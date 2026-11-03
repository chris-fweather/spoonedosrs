import models from './appearance-models.json' with {type:'json'};
import {SKIN_COLORS,cacheHex} from './game-colors';
export const SKIN_TONES=Object.fromEntries(Object.entries(SKIN_COLORS).map(([name,color])=>[name,cacheHex(color)])) as Record<keyof typeof SKIN_COLORS,string>;
export type SkinTone=keyof typeof SKIN_TONES;
export const BACKGROUNDS={none:'Plain',castle:'Castle courtyard',riverside:'Riverbank',mine:'Mine',woodland:'Woodland'} as const;
/** Character scenes are off until they are redone. Saved choices stay stored and validated, but the profile, the settings
 * preview and share images show the plain background, and the scene picker is hidden. Set true to bring them back. */
export const CHARACTER_SCENES:boolean=false;
/** The background a character is shown on: the saved scene while scenes are on, otherwise plain. */
export function shownBackground(appearance:{background?:keyof typeof BACKGROUNDS}|undefined,enabled=CHARACTER_SCENES):keyof typeof BACKGROUNDS {
 return enabled?appearance?.background??'none':'none';
}
export type Appearance = {background?:keyof typeof BACKGROUNDS;skin?:SkinTone;body:'male'|'female';hair:'brown'|'blonde'|'black'|'red'|'grey'};
export const DEFAULT_APPEARANCE:Appearance={body:'male',hair:'brown'};
export const HAIR_COLORS=['brown','blonde','black','red','grey'] as const;
export function parseAppearance(value:unknown):Appearance {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose a body type and hair colour.');
 const v=value as Record<string,unknown>;
 if(!['auto','male','female'].includes(v.body as string)||!HAIR_COLORS.includes(v.hair as Appearance['hair']))throw Error('Choose a valid body type and hair colour.');
 if(v.skin!==undefined&&!(typeof v.skin==='string'&&Object.hasOwn(SKIN_TONES,v.skin)))throw Error('Choose a valid skin tone.');
 if(v.background!==undefined&&!(typeof v.background==='string'&&Object.hasOwn(BACKGROUNDS,v.background)))throw Error('Choose a valid background.');
 return {...(v.background!==undefined?{background:v.background as Appearance['background']}:{}),...(v.skin!==undefined?{skin:v.skin as SkinTone}:{}),body:v.body==='auto'?'male':v.body as Appearance['body'],hair:v.hair as Appearance['hair']};
}
export const appearanceModels=models as {femaleItems:Record<string,string>;femaleKits:{id:number;part:number;hide:number;file:string}[];hair:Record<'male'|'female',Record<Appearance['hair'],string>>};
export function equipmentModel(id:string,maleFile:string,appearance:Appearance):string|null {
 return appearance.body==='female'?(appearanceModels.femaleItems[id]??null):maleFile;
}
/** Retain existing saved emblems; offer fewer, stronger milestones in the picker. */
export function featuredEmblem(id:string):boolean {
 if(id.startsWith('pets-'))return ['pets-5','pets-10','pets-20','pets-30','pets-50','pets-all'].includes(id);
 if(id.startsWith('clog-'))return ['clog-172','clog-429','clog-859','clog-1288','clog-1545','clog-all'].includes(id);
 if(id.startsWith('combat-'))return ['combat-50','combat-100','combat-250','combat-350','combat-500'].includes(id);
 return true;
}

/** The head kit (hair, skull and face) in the chosen hair colour, or null under a head item that covers identity slot 8.
 * As in the game, such an item replaces the whole head: helmets, masks and hoods carry their own face, so a kit face
 * underneath would show through visors and eye holes (slayer helmets, Torva, faceguards). Open hats keep the hair. */
export function headModel(appearance:Appearance,wearingHat:boolean):string|null {
 const body=appearance.body==='female'?'female':'male';
 return wearingHat?null:appearanceModels.hair[body][appearance.hair];
}
