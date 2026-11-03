import {HttpError} from '@/lib/auth';
import {publicMessage,requestJson,RequestError} from '@/lib/request-body';
import {acquireSync,takeBudget} from '@/lib/request-controls';
import {readJournal,saveJournal} from '@/lib/storage';
import {normalizeRates} from '@/lib/estimates';
import {applyPluginSync,parsePluginSync} from '@/lib/plugin-sync';
import {authenticatePlugin,bindCharacter,PluginActionError,recordPluginEvents,recordTokenSync} from '@/lib/plugin-store';

/**
 * Saves what the RuneLite plugin read from the logged-in character. Shares the per-user sync budget and
 * the one-minute gap per profile with the site's Refresh buttons; the plugin waits for Retry-After and
 * keeps its events until they are acknowledged here.
 */
export async function POST(req:Request){
 let release:((saved?:boolean)=>Promise<void>)|undefined,saved=false;
 try{
  const {discordId,tokenId}=await authenticatePlugin(req);
  const sync=parsePluginSync(await requestJson(req,2_000_000));
  await takeBudget('sync-user:'+discordId,30,3600);
  const profile=await bindCharacter(sync.character.name,discordId,sync.character.account);
  release=await acquireSync(profile);
  const prior=await readJournal(profile);
  const {journal,accepted,notes}=applyPluginSync(prior,sync);
  await saveJournal(normalizeRates(journal),prior.revision,discordId);saved=true;
  await recordPluginEvents(discordId,profile,sync.events);
  await recordTokenSync(tokenId,profile,sync.pluginVersion);
  return Response.json({profile,acceptedEvents:accepted,message:notes[0]??null},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  const status=e instanceof HttpError||e instanceof RequestError?e.status:400;
  const headers:Record<string,string>={'Cache-Control':'no-store'};
  if(e instanceof RequestError&&e.retryAfter)headers['Retry-After']=String(e.retryAfter);
  return Response.json({error:publicMessage(e,'The sync could not be saved. Your plugin will try again.'),code:e instanceof PluginActionError?e.code:null},{status,headers});
 }finally{if(release)await release(saved);}
}
