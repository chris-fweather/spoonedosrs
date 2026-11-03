/** Site areas that can be switched off for a release while their code stays in place. */
import {IS_DEV_ENVIRONMENT} from './environment';

/** The world map page (/map) is live: the Map button in the header (desktop and phone menu), /map itself and the
 * "Directions on the world map" link on guide map stops. Set WORLD_MAP_LIVE false to take it off the live site again
 * (no Map button, /map shows the not-found page, no directions links; guide maps keep working); the dev environment (a
 * build with SPOONED_ENV=dev) always shows it. */
export const WORLD_MAP_LIVE:boolean=false;
export function worldMapShown(dev=IS_DEV_ENVIRONMENT,live=WORLD_MAP_LIVE):boolean{return live||dev;}
export const WORLD_MAP_PAGE:boolean=worldMapShown();

/** The Squire name prefix (the rank below Sir, for helpers and guide writers; lib/name-prefix.ts). Off on the live site
 * for now: with it off, staff pick Sir as before and nobody shows Squire. The dev environment always shows it. */
export const SQUIRE_LIVE:boolean=false;
export function squireShown(dev=IS_DEV_ENVIRONMENT,live=SQUIRE_LIVE):boolean{return live||dev;}
export const SQUIRE_PREFIX:boolean=squireShown();

export type NavLink={path:string;label:string;key:string;image:string};
const NAV_LINKS:NavLink[]=[
 {path:'',label:'Home',image:'/brand/rocky-mascot.webp',key:'home'},
 {path:'leaderboard',label:'Leaderboard',image:'/icons/navigation/stats-icon.png',key:'leaderboard'},
 {path:'guides',label:'Guides',image:'/icons/navigation/collection-log-icon.png',key:'guides'},
 {path:'map',label:'Map',image:'/icons/navigation/world-map-icon.png',key:'map'},
 {path:'support',label:'Support',image:'/icons/community/support-coins.png',key:'support'},
];
/** The site header's feature buttons, without the ones switched off. */
export function navLinks(worldMap=WORLD_MAP_PAGE):NavLink[]{return NAV_LINKS.filter(l=>l.key!=='map'||worldMap);}
/** The world map with directions to a spot, or null while the world map page is off. */
export function worldMapDirections(to:{x:number;y:number;plane:number},name:string,worldMap=WORLD_MAP_PAGE):string|null{
 return worldMap?`/map?to=${to.x},${to.y},${to.plane}&name=${encodeURIComponent(name)}`:null;
}
