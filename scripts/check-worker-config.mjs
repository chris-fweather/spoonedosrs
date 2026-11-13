// Checks the Worker config the build generated (dist/server/wrangler.json, from vite.config.ts) before anything is
// deployed: every binding the code needs is there, pointed at this environment's resources, and Workers Logs are on.
// Run by release:verify after the build and by scripts/deploy-release.mjs before migrating or uploading.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deployEnvironment} from './deployment-config.mjs';

/** What each environment's Worker must bind. Resources are created by hand in Cloudflare (see docs/releases.md). */
export const REQUIRED_BINDINGS={
 production:{r2:{MAP_TILES:'spoonedosrs-map-tiles'},queue:{binding:'SYNC_QUEUE',name:'spoonedosrs-sync',dlq:'spoonedosrs-sync-dlq'}},
 dev:{r2:{MAP_TILES:'spoonedosrs-dev-map-tiles'},queue:{binding:'SYNC_QUEUE',name:'spoonedosrs-dev-sync',dlq:'spoonedosrs-dev-sync-dlq'}},
};

/** Every problem with a generated config, as sentences; an empty list means it is good to deploy. */
export function workerConfigProblems(config,environment='production'){
 const want=REQUIRED_BINDINGS[environment];
 if(!want)return [`Unknown environment ${environment}.`];
 const problems=[];
 if(!config?.d1_databases?.some(d=>d.binding==='DB'))problems.push('The DB database binding is missing.');
 if(config?.assets?.binding!=='ASSETS')problems.push('The ASSETS binding is missing.');
 for(const [binding,bucket] of Object.entries(want.r2)){
  const found=config?.r2_buckets?.find(b=>b.binding===binding);
  if(!found)problems.push(`The ${binding} R2 binding is missing.`);
  else if(found.bucket_name!==bucket)problems.push(`${binding} points at ${found.bucket_name}, not ${bucket}.`);
 }
 const {binding,name,dlq}=want.queue;
 if(!config?.queues?.producers?.some(p=>p.binding===binding&&p.queue===name))problems.push(`The ${binding} producer for ${name} is missing.`);
 const consumer=config?.queues?.consumers?.find(c=>c.queue===name);
 if(!consumer)problems.push(`Nothing consumes ${name}.`);
 else{
  if(consumer.dead_letter_queue!==dlq)problems.push(`${name} must send failed messages to ${dlq}.`);
  if(consumer.max_retries!==5)problems.push(`${name} must retry 5 times (lib/sync-queue.ts MAX_RETRIES).`);
 }
 if(config?.observability?.enabled!==true)problems.push('Workers Logs (observability.enabled) are off.');
 else if(!(config.observability.head_sampling_rate>0))problems.push('Workers Logs sample nothing (head_sampling_rate).');
 return problems;
}

export function checkWorkerConfig(file='dist/server/wrangler.json',environment=deployEnvironment().name){
 const problems=workerConfigProblems(JSON.parse(readFileSync(file,'utf8')),environment);
 if(problems.length)throw Error(`The ${environment} Worker config is not ready to deploy:\n- `+problems.join('\n- '));
 console.log(`Worker config for ${environment}: bindings and logs are in place.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))checkWorkerConfig(process.argv[2]);
