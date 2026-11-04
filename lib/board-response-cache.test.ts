import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cachedBoard} from './board-response-cache';
test('public cache reuses same version but cannot retain private data after a version change',async()=>{
 let calls=0;const old=()=>{calls++;return Promise.resolve({rows:['public-player']});};
 assert.equal((await cachedBoard(100,'pets',old)).hit,false);
 assert.equal((await cachedBoard(100,'pets',old)).hit,true);assert.equal(calls,1);
 const next=await cachedBoard(101,'pets',async()=>({rows:[]}));assert.equal(next.hit,false);assert.deepEqual(JSON.parse(next.data),{rows:[]});
});

test('requests that arrive while a board is being worked out share the one result',async()=>{
 let calls=0,finish=(_:unknown)=>{};
 const slow=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const all=Promise.all([cachedBoard(200,'burst',slow),cachedBoard(200,'burst',slow),cachedBoard(200,'burst',slow)]);
 finish({rows:['shared']});
 const results=await all;
 assert.equal(calls,1);
 assert.deepEqual(results.map(r=>JSON.parse(r.data)),[{rows:['shared']},{rows:['shared']},{rows:['shared']}]);
 // A failed query is not remembered: the next request tries again.
 await assert.rejects(cachedBoard(201,'broken',()=>Promise.reject(new Error('D1 down'))));
 assert.equal((await cachedBoard(201,'broken',async()=>({rows:[]}))).hit,false);
});
