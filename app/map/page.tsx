import {notFound} from 'next/navigation';
import {WORLD_MAP_PAGE} from '@/lib/features';
import {WorldMap} from '../WorldMap';
export const metadata={title:'World map · Spooned OSRS',description:'Explore the OSRS world map: quest starts, banks, fairy rings and the quickest routes with your teleports.'};
// The world map page is switched off for now (lib/features.ts); guide maps keep working.
export default function Page(){if(!WORLD_MAP_PAGE)notFound();return <WorldMap/>;}
