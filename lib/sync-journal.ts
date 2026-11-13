import {parseProfileProgress} from './import-progress';
import {accountMode} from './account-mode';
import {templeLog,womHiscores,sourceJson} from './import-sources';
import {mergeLog,parseLog,type Journal} from './model';
import {HISCORES_COUNT_UNITS,normalizeRates} from './estimates';
import {publicHiscores} from './hiscores';
import {publicMessage} from './request-body';
import {mergeMilestones,recordCrossed,womMilestones} from './skill-milestones';
import {SOURCE_ORDER,inOrder} from './provider-fallback';
export type SyncSource='hiscores'|'runeprofile'|'temple'|'wom';
/** `skipped`: not asked, because an earlier source in its fallback order already answered. */
export type SyncResult={source:SyncSource;status:'updated'|'unavailable'|'skipped'|'queued';message:string};
export type SyncedJournal=Journal & {syncReport?:SyncResult[]};
const sourceNames:Record<SyncSource,string>={hiscores:'OSRS Hiscores',runeprofile:'RuneProfile',temple:'TempleOSRS',wom:'Wise Old Man'};
const sourceUrl=(source:SyncSource,name:string)=>({hiscores:'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=',runeprofile:'https://api.runeprofile.com/v1/accounts/',temple:'https://templeosrs.com/api/collection-log/player_collection_log.php?player=',wom:'https://api.wiseoldman.net/v2/players/'}[source]+encodeURIComponent(name)+(source==='runeprofile'?'/full':source==='temple'?'&categories=all&includecount=1':''));
const achievementsUrl=(name:string)=>sourceUrl('wom',name)+'/achievements';
/** Wise Old Man's dated skill achievements (99s, base levels, maxed) as timeline milestones. Optional: any failure
 * keeps the milestones already saved. */
async function womAchievements(j:Journal,fetch:typeof globalThis.fetch){
 try{const response=await fetch(achievementsUrl(j.username),{signal:AbortSignal.timeout(15000)});if(!response.ok){await response.body?.cancel();return;}j.skillMilestones=mergeMilestones(j.skillMilestones,womMilestones(await sourceJson(response)));}catch{/* Achievements are extra; the stats sync stands without them. */}
}
/** `detect` is internal: a combined sync records crossed milestones once, across all its sources. */
export async function syncJournal(source:string,original:Journal,data:unknown,fetch:typeof globalThis.fetch=globalThis.fetch,detect=true):Promise<SyncedJournal>{
const j:SyncedJournal=structuredClone(original);
const crossed=()=>{if(detect)recordCrossed(j,original.hiscores.skills,!!original.statsSyncedAt);};
delete j.syncReport;
if(!['hiscores','runeprofile','import','all','temple','wom'].includes(source))throw Error('Unknown sync source.');
const hiscores=()=>fetch('https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player='+encodeURIComponent(j.username),{signal:AbortSignal.timeout(15000)});
const runeprofile=()=>fetch('https://api.runeprofile.com/v1/accounts/'+encodeURIComponent(j.username)+'/full',{signal:AbortSignal.timeout(15000)});
if(source==='all'){
 // Skills come from the first source that answers, Hiscores before Wise Old Man; the collection log combines RuneProfile
 // and Temple (lib/provider-fallback.ts). Everything that waits on no other source starts at once, and the merges run in
 // a fixed order so the result never depends on which answer arrives first.
 const get=async(s:SyncSource)=>{const response=await fetch(sourceUrl(s,j.username),{signal:AbortSignal.timeout(15000)});return {status:response.status,raw:await sourceJson(response)};};
 const started=new Map<SyncSource,ReturnType<typeof get>>();
 for(const s of new Set<SyncSource>([SOURCE_ORDER.skills[0],...SOURCE_ORDER.collectionLog])){const pending=get(s);pending.catch(()=>{});started.set(s,pending);}
 // Achievements ride along with the WOM lane and never count as a source of their own.
 const achievements=fetch(achievementsUrl(j.username),{signal:AbortSignal.timeout(15000)}).then(async r=>{if(r.ok)return await sourceJson(r);await r.body?.cancel();return null;}).catch(()=>null);
 let merged:SyncedJournal=j;
 const report:SyncResult[]=[];
 const merge=async(s:SyncSource)=>{
  try{
   const value=await (started.get(s)??get(s));
   merged=await syncJournal(s,merged,null,(async(url:string)=>String(url).endsWith('/achievements')?new Response(null,{status:404}):Response.json(value.raw,{status:value.status})) as typeof globalThis.fetch,false);
   report.push({source:s,status:'updated',message:s==='wom'?'Tracked snapshot imported.':'Updated.'});return true;
  }catch(error){report.push({source:s,status:'unavailable',message:publicMessage(error,'Source unavailable.')});return false;}
 };
 const skills=await inOrder(SOURCE_ORDER.skills,merge);
 for(const s of skills.skipped)report.push({source:s,status:'skipped',message:`Not needed: ${sourceNames[skills.used[0]]} answered.`});
 await inOrder(SOURCE_ORDER.collectionLog,merge,true);
 // A first sync has no earlier log to compare with: a pet one source adds after another is not newly obtained.
 if(!original.logSyncedAt)merged.pets=merged.pets.map(p=>{const before=original.pets.find(x=>x.id===p.id);return before&&!before.obtained&&p.obtained?{...p,date:before.date,obtainedMethod:before.obtainedMethod,obtainedUnit:before.obtainedUnit,obtainedCount:before.obtainedCount,obtainedApproximate:before.obtainedApproximate}:p;});
 const dated=await achievements;
 if(dated)merged.skillMilestones=mergeMilestones(merged.skillMilestones,womMilestones(dated));
 if(merged.statsSyncedAt!==original.statsSyncedAt)recordCrossed(merged,original.hiscores.skills,!!original.statsSyncedAt);
 if(!report.some(r=>r.status==='updated'))throw Error('No sources could be refreshed. Your saved journal is unchanged. '+report.map(r=>sourceNames[r.source]+': '+r.message).join(' '));
 merged.syncReport=report.sort((a,b)=>['hiscores','runeprofile','temple','wom'].indexOf(a.source)-['hiscores','runeprofile','temple','wom'].indexOf(b.source));
 return merged;
}
if(source==='hiscores'){const response=await hiscores();if(response.status===404)throw Error('No public OSRS HiScores record for '+j.username+'. Check the spelling; the player may be unranked.');if(!response.ok)throw Error('OSRS hiscores are unavailable. Try again shortly.');const hs=publicHiscores(await sourceJson(response));if(!hs)throw Error('No public OSRS HiScores record for '+j.username+'. The player may be unranked.');j.hiscores=hs;crossed();for(const p of j.pets)for(const m of p.methods){const a=hs.activities.find(a=>a.name.toLowerCase()===m.activity?.toLowerCase());if(a&&a.score>=0&&HISCORES_COUNT_UNITS.includes(m.unit)){m.kc=a.score;}}j.statsSyncedAt=new Date().toISOString();}
if(source==='runeprofile'){const response=await runeprofile();if(response.status===404)throw Error(j.username+' has no RuneProfile yet. Open your Collection Log in RuneLite and sync with the RuneProfile plugin, then retry.');if(!response.ok)throw Error('RuneProfile is unavailable or rate limited. Try again shortly.');const raw=await sourceJson(response) as Record<string,unknown>;const mode=accountMode(raw.accountType);if(mode)j.accountMode=mode;mergeLog(j,parseLog(raw));const quests=Array.isArray(raw.quests)?raw.quests:[];const diaries=Array.isArray(raw.achievementDiaries)?raw.achievementDiaries:[];const combat=Array.isArray(raw.combatAchievements)?raw.combatAchievements:[];if(quests.every(q=>typeof q.name==='string'&&Number.isFinite(q.points)&&typeof q.state==='string')&&diaries.every(d=>typeof d.area==='string'&&Array.isArray(d.tiers)&&d.tiers.every((t:{completed:number;total:number;tier:string})=>Number.isFinite(t.completed)&&Number.isFinite(t.total)&&typeof t.tier==='string'))&&combat.every(c=>typeof c.name==='string'&&Number.isFinite(c.completed)&&Number.isFinite(c.total)))j.profile=parseProfileProgress({quests,achievementDiaries:diaries,combatAchievements:combat});}
else if(source==='temple'){
 const raw=await sourceJson(await fetch('https://templeosrs.com/api/collection-log/player_collection_log.php?player='+encodeURIComponent(j.username)+'&categories=all&includecount=1',{signal:AbortSignal.timeout(15000)}));mergeLog(j,templeLog(raw,j));
}else if(source==='wom'){
 const raw=await sourceJson(await fetch('https://api.wiseoldman.net/v2/players/'+encodeURIComponent(j.username),{signal:AbortSignal.timeout(15000)}));j.hiscores=womHiscores(raw,j);j.statsSyncedAt=new Date().toISOString();crossed();
 await womAchievements(j,fetch);
 for(const p of j.pets)for(const m of p.methods){const a=j.hiscores.activities.find(a=>a.name.toLowerCase()===m.activity?.toLowerCase());if(a&&a.score>=0&&HISCORES_COUNT_UNITS.includes(m.unit))m.kc=a.score;}
}else if(source==='import'){
 const raw=data as Record<string,unknown>;
 if(raw?.data&&typeof raw.data==='object'&&'items' in raw.data)mergeLog(j,templeLog(raw,j));
 else if(raw?.latestSnapshot){j.hiscores=womHiscores(raw,j);j.statsSyncedAt=new Date().toISOString();crossed();for(const p of j.pets)for(const m of p.methods){const a=j.hiscores.activities.find(a=>a.name.toLowerCase()===m.activity?.toLowerCase());if(a&&a.score>=0&&HISCORES_COUNT_UNITS.includes(m.unit))m.kc=a.score;}}
 else {const mode=accountMode(raw?.accountType);if(mode)j.accountMode=mode;mergeLog(j,parseLog(data));if(Array.isArray(raw?.quests)&&Array.isArray(raw?.achievementDiaries)&&Array.isArray(raw?.combatAchievements)){
  return syncJournal('runeprofile',j,null,(async()=>Response.json(raw)) as typeof globalThis.fetch);
 }}
}
return normalizeRates(j);
}
