import {env} from 'cloudflare:workers';
import {syncJournal,type SyncedJournal,type SyncResult} from '@/lib/sync-journal';
import {db,readJournal,saveJournal} from '@/lib/storage';
import {HttpError,requireLinkedWriter,readSession} from '@/lib/auth';
import {publicMessage,requestJson,RequestError} from '@/lib/request-body';
import {acquireSync,providerFetch,takeBudget} from '@/lib/request-controls';
import {logEvent} from '@/lib/log';
import {enqueueSources,isQueuedSource,type QueuedSource} from '@/lib/sync-queue';

const SOURCE_NAMES:Record<QueuedSource,string>={runeprofile:'RuneProfile',temple:'TempleOSRS',wom:'Wise Old Man'};
const queuedLine=(source:QueuedSource):SyncResult=>({source,status:'queued',message:'Queued. It appears here when '+SOURCE_NAMES[source]+' answers.'});

/** A refresh. With the sync queue bound (lib/sync-queue.ts), "Refresh all" saves the official Hiscores at once and queues
 * the slower sources, and a single RuneProfile, TempleOSRS or Wise Old Man refresh is queued; the answer is the saved
 * journal with `status: 'sync_queued'`. Hiscores and file imports always run here. Without the binding (local runs),
 * every source runs in this request as before. */
export async function POST(req:Request){
 let release:((saved?:boolean)=>Promise<void>)|undefined,saved=false;
 try{
  const {source,data,username}=await requestJson(req,2_000_000);
  if(!username)throw new RequestError(400,'Enter an account name.');
  const name=await requireLinkedWriter(req,username);
  if(!['hiscores','runeprofile','temple','wom','all','import'].includes(source))throw new RequestError(400,'Unknown sync source.');
  release=await acquireSync(name);
  const session=await readSession(req);
  await takeBudget('sync-user:'+session!.id,30,3600);
  const prior=await readJournal(name);
  const queue=env.SYNC_QUEUE;
  if(queue&&(source==='all'||isQueuedSource(source))){
   const report:SyncResult[]=[];let result:SyncedJournal=prior,wom=false;
   if(source==='all'){
    try{
     const next=await syncJournal('hiscores',prior,null,providerFetch);
     result=await saveJournal(next,prior.revision,session!.id);
     report.push({source:'hiscores',status:'updated',message:'Updated.'});
    }catch(error){
     // Wise Old Man fills the skills when the Hiscores have no answer (lib/provider-fallback.ts).
     report.push({source:'hiscores',status:'unavailable',message:publicMessage(error,'Source unavailable.')});wom=true;
    }
   }
   const wanted:QueuedSource[]=source==='all'?['runeprofile','temple',...(wom?['wom' as const]:[])]:[source as QueuedSource];
   await enqueueSources(db(),queue,name,wanted);
   // Already-waiting sources show as queued too: the same source is never queued twice.
   report.push(...wanted.map(queuedLine));
   if(source==='all'&&!wom)report.push({source:'wom',status:'skipped',message:'Not needed: OSRS Hiscores answered.'});
   saved=true;
   logEvent('sync',{rsn:name,source,queued:wanted.join(','),hiscores:report.find(r=>r.source==='hiscores')?.status});
   return Response.json({...result,syncReport:report,status:'sync_queued'},{headers:{'Cache-Control':'private, no-store'}});
  }
  const next=await syncJournal(source,prior,data,providerFetch);
  const result=await saveJournal(next,prior.revision,session!.id);saved=true;
  logEvent('sync',{rsn:name,source,...Object.fromEntries((next.syncReport??[]).map(r=>[r.source,r.status]))});
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const status=e instanceof HttpError||e instanceof RequestError?e.status:400;logEvent('sync-failed',{status,message:publicMessage(e,'Sync failed.').slice(0,160)},status>=500?'error':'warn');return Response.json({error:publicMessage(e,'Sync failed. Your saved progress is unchanged.')},{status,headers:{'Cache-Control':'no-store',...(e instanceof RequestError&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});}
 finally{if(release)await release(saved);}
}
