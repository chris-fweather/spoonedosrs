import test from 'node:test';
import assert from 'node:assert/strict';
import {workerConfigProblems} from './check-worker-config.mjs';

const good=(env='production')=>({
 d1_databases:[{binding:'DB'}],assets:{binding:'ASSETS'},
 r2_buckets:[{binding:'MAP_TILES',bucket_name:env==='dev'?'spoonedosrs-dev-map-tiles':'spoonedosrs-map-tiles'}],
 observability:{enabled:true,head_sampling_rate:1},
 queues:{producers:[{binding:'SYNC_QUEUE',queue:env==='dev'?'spoonedosrs-dev-sync':'spoonedosrs-sync'}],consumers:[{queue:env==='dev'?'spoonedosrs-dev-sync':'spoonedosrs-sync',max_retries:5,dead_letter_queue:env==='dev'?'spoonedosrs-dev-sync-dlq':'spoonedosrs-sync-dlq'}]},
});

test('a complete config passes for both environments',()=>{
 assert.deepEqual(workerConfigProblems(good(),'production'),[]);
 assert.deepEqual(workerConfigProblems(good('dev'),'dev'),[]);
});
test('a missing or misdirected binding, or logs turned off, fails the build',()=>{
 assert.match(workerConfigProblems({...good(),r2_buckets:[]}).join(),/MAP_TILES R2 binding is missing/);
 assert.match(workerConfigProblems(good('dev'),'production').join(),/points at spoonedosrs-dev-map-tiles/,'dev bucket on the live Worker');
 assert.match(workerConfigProblems({...good(),observability:undefined}).join(),/Workers Logs/);
 assert.match(workerConfigProblems({...good(),observability:{enabled:true,head_sampling_rate:0}}).join(),/sample nothing/);
 assert.match(workerConfigProblems({...good(),d1_databases:[]}).join(),/DB database/);
 assert.match(workerConfigProblems(good(),'staging').join(),/Unknown environment/);
});
test('the sync queue needs its producer, a consumer and its dead-letter queue',()=>{
 const q=good().queues;
 assert.match(workerConfigProblems({...good(),queues:{...q,producers:[]}}).join(),/SYNC_QUEUE producer/);
 assert.match(workerConfigProblems({...good(),queues:{...q,consumers:[]}}).join(),/Nothing consumes spoonedosrs-sync/);
 assert.match(workerConfigProblems({...good(),queues:{...q,consumers:[{...q.consumers[0],dead_letter_queue:undefined}]}}).join(),/spoonedosrs-sync-dlq/);
 assert.match(workerConfigProblems({...good(),queues:{...q,consumers:[{...q.consumers[0],max_retries:2}]}}).join(),/retry 5 times/);
});
