/** The Worker side of the sync queue (lib/sync-queue.ts): reading and saving journals for the consumer. */
import {db,readJournal,saveJournal,saveDiscoveredJournal} from './storage';
import {providerFetch} from './request-controls';
import {syncJournal} from './sync-journal';
import {hydratePublicJournal} from './public-journal';
import type {Journal} from './model';
import {env} from 'cloudflare:workers';
import {handleSyncBatch,type ConsumerDeps,type QueuedSource,type QueueProducer} from './sync-queue';

type Row={data:string;revision:number;owner:string|null;reserved:string|null;visibility:string|null};

export const consumerDeps:ConsumerDeps={
 async load(rsn){
  const row=await db().prepare(`SELECT j.data,j.revision,c.discord_id AS owner,r.discord_id AS reserved,v.visibility FROM journals j
   LEFT JOIN claimed_names c ON c.rsn=j.id LEFT JOIN profile_link_owners r ON r.rsn=j.id LEFT JOIN profile_visibility v ON v.rsn=j.id WHERE j.id=?`).bind(rsn).first<Row>();
  if(!row)return null;
  // A claimed name saves as its owner, with the owner's full journal; the claim check runs again inside the write.
  if(row.owner){
   const owner=row.owner,journal=await readJournal(rsn);
   return {journal,revision:journal.revision??row.revision,save:async next=>{await saveJournal(next,journal.revision??row.revision,owner);return true;}};
  }
  // An unclaimed name saves the way a search does, never over a reservation or a private profile.
  if(row.reserved||row.visibility==='private')return null;
  let stored:Journal;try{stored=JSON.parse(row.data) as Journal;}catch{return null;}
  return {journal:hydratePublicJournal({...stored,revision:row.revision}),revision:row.revision,save:next=>saveDiscoveredJournal(next,row.revision,stored)};
 },
 sync:(source:QueuedSource,journal:Journal)=>syncJournal(source,journal,null,providerFetch),
};

/** build/worker.ts queue(): one batch from spoonedosrs-sync / spoonedosrs-dev-sync. */
export function consumeSyncBatch(batch:MessageBatch<unknown>){
 // Busy sources wait their turn through the same queue (lib/sync-queue.ts).
 return handleSyncBatch(batch.messages,db(),consumerDeps,(env as {SYNC_QUEUE?:QueueProducer}).SYNC_QUEUE??null);
}
