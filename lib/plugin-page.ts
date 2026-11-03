import {IS_DEV_ENVIRONMENT} from './environment';

/** The Spooned RuneLite plugin is on the RuneLite Plugin Hub. Until then the plugin page says "coming soon".
 * Set true once the plugin is approved: the page's wording switches to "available". */
export const PLUGIN_ON_HUB:boolean=false;
/** The plugin page is on the live site before the plugin is approved, saying it is coming soon. Set false to take the
 * page and its header link off the live site until PLUGIN_ON_HUB. */
export const PLUGIN_PAGE_LIVE:boolean=true;
/** The plugin page and its header link: on once it is live or on the Plugin Hub, and always in the dev environment (a
 * build with SPOONED_ENV=dev) so it can be reviewed there. */
export const PLUGIN_PAGE:boolean=pluginPageShown();
export function pluginPageShown(dev=IS_DEV_ENVIRONMENT,onHub=PLUGIN_ON_HUB,live=PLUGIN_PAGE_LIVE):boolean{return live||onHub||dev;}
/** What needs the plugin itself: plugin tokens in Account settings, characters the plugin has seen and verified badges.
 * Off on the live site until the plugin is on the Plugin Hub, even while the page says it is coming soon; always on in dev. */
export const PLUGIN_FEATURES:boolean=pluginFeaturesShown();
export function pluginFeaturesShown(dev=IS_DEV_ENVIRONMENT,onHub=PLUGIN_ON_HUB):boolean{return onHub||dev;}

export type FeatureLink={path:string;label:string;key:string;image:string};
/** The header button for the plugin page; none while the page is off. */
export function pluginNavLinks(shown=PLUGIN_PAGE):FeatureLink[]{
 return shown?[{path:'plugin',label:'Plugin',image:'/icons/runelite/runelite-logo.png',key:'plugin'}]:[];
}
