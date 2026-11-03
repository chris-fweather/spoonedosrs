/**
 * Settings the RuneLite plugin reads hourly, so game updates can be followed without a plugin release.
 * Empty lists mean "not decoded by the site yet"; the plugin still syncs everything else.
 */
import {pluginPetCatalogue} from '@/lib/plugin-profile';
import {PET_VARBITS} from '@/lib/plugin-sync';

const MANIFEST={
 version:4,
 minimumPluginVersion:'0.1.0',
 combatAchievementVarps:[] as number[],
 varbits:[] as number[],
 varps:[] as number[],
 /** Counts toward pets the hiscores don't track, read while pet syncing is on (lib/plugin-sync.ts PET_VARBITS). */
 petVarbits:PET_VARBITS.map(v=>v.varbit),
 collectionEntryScript:4100,
 collectionSetupScript:7797,
 collectionInitScript:2240,
 /** Every pet in the overview's order, for the plugin's empty panel before a lookup, with the hiscores activity or
  * skill its count comes from, for lookups of players without a Spooned profile. */
 pets:pluginPetCatalogue(),
};

export function GET(){
 return Response.json(MANIFEST,{headers:{'Cache-Control':'public, max-age=3600'}});
}
