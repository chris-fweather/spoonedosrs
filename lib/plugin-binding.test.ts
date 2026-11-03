import test from 'node:test';
import assert from 'node:assert/strict';
import {heldBy,pluginAccess,type PluginAccessInput} from './plugin-binding.ts';

const A='discord-a',B='discord-b',C='discord-c';
const at=(over:Partial<PluginAccessInput>)=>pluginAccess({me:A,boundTo:null,claim:null,reservation:null,reviewPending:false,...over});

test('unbound characters keep the old rules: linked syncs and binds, unclaimed can be added, held elsewhere is refused',()=>{
 assert.deepEqual(at({claim:A}),{status:'linked',boundElsewhere:false,bind:true,renamedOwn:false});
 assert.deepEqual(at({}),{status:'can_add',boundElsewhere:false,bind:false,renamedOwn:false},'the first person to press Add links it');
 assert.equal(at({claim:B}).status,'claimed_elsewhere');
 assert.equal(at({claim:B,reviewPending:true}).status,'review_pending');
 assert.equal(at({reservation:B}).status,'claimed_elsewhere','a name another account unlinked stays reserved to it');
 assert.equal(at({reservation:A}).status,'can_add','my own reserved name can be added back');
 assert.equal(at({claim:null,reservation:'moderation-hold:case'}).status,'claimed_elsewhere','a held name is refused');
});

test('bound to me: syncs while linked, and a new unlinked name (a name change) can be added',()=>{
 assert.deepEqual(at({boundTo:A,claim:A}),{status:'linked',boundElsewhere:false,bind:true,renamedOwn:false});
 assert.deepEqual(at({boundTo:A}),{status:'can_add',boundElsewhere:false,bind:false,renamedOwn:true},'renamed, new name unclaimed');
 assert.equal(at({boundTo:A,claim:B}).status,'claimed_elsewhere','renamed to a name someone else linked: review');
 assert.equal(at({boundTo:A,reservation:B}).status,'claimed_elsewhere');
 assert.equal(at({boundTo:A,claim:B,reviewPending:true}).status,'review_pending');
});

test('bound to someone else: refused under every name and never offered Add',()=>{
 const refused={status:'claimed_elsewhere',boundElsewhere:true,bind:false,renamedOwn:false};
 assert.deepEqual(at({boundTo:B,claim:B}),refused,'a friend\'s computer: the owner\'s name');
 assert.deepEqual(at({boundTo:B}),refused,'a friend\'s computer after a name change, or after the owner unlinked');
 assert.deepEqual(at({boundTo:B,claim:A}),refused,'even a name I linked on the site without the plugin');
 assert.deepEqual(at({boundTo:B,claim:C}),refused);
 assert.deepEqual(at({boundTo:B,reservation:A}),refused);
 assert.equal(at({boundTo:B,reviewPending:true}).status,'review_pending');
});

test('heldBy names who holds a name for someone else',()=>{
 assert.equal(heldBy({claim:A,reservation:A},A),null);
 assert.equal(heldBy({claim:B,reservation:A},A),B);
 assert.equal(heldBy({claim:A,reservation:B},A),null,'the link wins over an older reservation');
 assert.equal(heldBy({claim:null,reservation:B},A),B);
 assert.equal(heldBy({claim:null,reservation:null},A),null);
});
