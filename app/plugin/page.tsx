import {notFound} from 'next/navigation';
import {PLUGIN_PAGE} from '@/lib/plugin-page';
import {PluginPage} from './PluginPage';
export const metadata={title:'RuneLite plugin · Spooned OSRS',description:'The Spooned OSRS RuneLite plugin: what it syncs, how to install and link it, and your data.'};
/** Hidden on the live site until the plugin is on the Plugin Hub (lib/plugin-page.ts). */
export default function Page(){if(!PLUGIN_PAGE)notFound();return <PluginPage/>;}
