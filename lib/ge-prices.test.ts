import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemPriceCard} from './ge-prices';

test('item price card joins the latest trades with alchemy values and the buy limit',async()=>{
 const real=globalThis.fetch,asked:string[]=[];
 globalThis.fetch=(async(url:string|URL)=>{const u=String(url);asked.push(u);
  if(u.endsWith('/latest'))return Response.json({data:{4151:{high:1520000,highTime:1760000000,low:1500000,lowTime:1760000100}}});
  if(u.endsWith('/mapping'))return Response.json([{id:4151,name:'Abyssal whip',members:true,limit:70,highalch:72000,lowalch:48000}]);
  if(u.includes('api.php')&&new URL(u).searchParams.get('titles')==="Elvarg's head")return Response.json({query:{pages:[{revisions:[{slots:{main:{content:'{{Infobox Item\n|quest = [[Dragon Slayer I]]\n|tradeable = No\n}}'}}}]}]}});
  return new Response('',{status:404});}) as typeof fetch;
 try{
  const whip=await itemPriceCard('4151');
  assert.deepEqual(whip,{id:'4151',tradeable:true,name:'Abyssal whip',members:true,limit:70,high:1520000,highTime:1760000000,low:1500000,lowTime:1760000100,highAlch:72000,lowAlch:48000});
  // Items missing from the mapping are not on the Grand Exchange; both lists stay cached between cards.
  assert.deepEqual(await itemPriceCard('19496'),{id:'19496',tradeable:false,highAlch:null,quests:[]});
  // An untradeable item keeps its high alchemy value from the Wiki drop tables (the small rune pouch is not sold).
  assert.deepEqual(await itemPriceCard('5509'),{id:'5509',tradeable:false,highAlch:90,quests:[]});
  // An untradeable quest item names its quest from its Wiki page's infobox.
  assert.deepEqual(await itemPriceCard('11279'),{id:'11279',tradeable:false,highAlch:null,quests:['Dragon Slayer I']});
  // The two price lists once, then one Wiki page per untradeable item.
  assert.equal(asked.filter(u=>!u.includes('api.php')).length,2);
  assert.equal(asked.filter(u=>u.includes('api.php')).length,3);
 }finally{globalThis.fetch=real;}
});
