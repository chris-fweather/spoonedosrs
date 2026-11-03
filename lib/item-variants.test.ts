import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {FIXED_FROM,KIT_PAIRS,UPGRADES,STYLE_PAIRS,VARIANT_NAMES,wearableUnlocks,styleGroups,styleLabels} from './item-variants.ts';
import {wearables,coerceFlair,assertFlair,emptyEquipped} from './flair.ts';
import {appearanceModels} from './appearance.ts';
import {initial,type Journal} from './model.ts';
import template from './log-template.json' with {type:'json'};
import names from './item-names.json' with {type:'json'};

const logIds=new Set(template.tabs.flatMap(t=>t.pages.flatMap(p=>p.items.map(i=>String(i.id)))));
const logName=(id:string)=>(names as Record<string,string>)[id];

test('every unlocked variant is a wearable with a male and female model and an item icon',()=>{
 const unlocked=[...Object.values(FIXED_FROM).flat(),...Object.values(KIT_PAIRS).flat(2),...UPGRADES.map(u=>u.gives),...STYLE_PAIRS.flat()];
 for(const id of unlocked){
  const item=wearables.items[id];assert.ok(item,id);
  assert.ok(existsSync('public/models/look/'+item.file),id+' model');
  assert.ok(appearanceModels.femaleItems[id]&&existsSync('public/models/look/'+appearanceModels.femaleItems[id]),id+' female model');
  assert.ok(existsSync(`public/items/${id}.png`),id+' icon');
 }
});

test('broken and kit sources are collection log items, and each pair shares a slot',()=>{
 for(const id of [...Object.keys(FIXED_FROM),...Object.keys(KIT_PAIRS)])assert.ok(logIds.has(id),id);
 for(const [kit,pairs] of Object.entries(KIT_PAIRS))for(const [normal,ornamented] of pairs){
  assert.equal(wearables.items[normal].slot,wearables.items[ornamented].slot,kit);
  assert.notEqual(normal,ornamented);
 }
 assert.match(logName('26376'),/Torva full helm \(damaged\)/);assert.equal(wearables.items['26382'].name,'Torva full helm');
 assert.match(logName('25744'),/Sanguine ornament kit/);assert.equal(wearables.items['28254'].name,'Sanguine torva full helm');
 assert.match(logName('27695'),/Dragon pickaxe \(broken\)/);assert.equal(wearables.items['11920'].name,'Dragon pickaxe');
 // Every renamed variant really repeats another item's cache name.
 for(const id of Object.keys(VARIANT_NAMES))assert.ok(Object.entries(wearables.items).some(([other,item])=>other!==id&&item.name===wearables.items[id].name),id);
});

test('broken items unlock the fixed item only; kits unlock both versions',()=>{
 const fromBroken=wearableUnlocks(['26376']);
 assert.ok(fromBroken.has('26382'));assert.ok(!fromBroken.has('28254'));
 const fromKit=wearableUnlocks(['25744']);
 for(const id of ['26382','28254','26384','28256','26386','28258','22325','25739'])assert.ok(fromKit.has(id),id);
 assert.deepEqual([...wearableUnlocks(['4151'])],['4151']);
});

test('saved outfits accept unlocked variants and still refuse items the log does not cover',()=>{
 const j=structuredClone(initial) as Journal;
 j.log={obtained:2,total:2,tabs:[{name:'Bosses',pages:[{name:'Nex',obtained:2,total:2,items:[{id:26376,name:'Torva full helm (damaged)',quantity:1},{id:25744,name:'Sanguine ornament kit',quantity:1}]}]}]} as unknown as Journal['log'];
 for(const head of ['26382','28254'])assert.equal(coerceFlair(j,{equipped:{...emptyEquipped(),head}}).equipped.head,head);
 assert.equal(coerceFlair(j,{equipped:{...emptyEquipped(),body:'28256'}}).equipped.body,'28256');
 assert.throws(()=>assertFlair(j,{equipped:{...emptyEquipped(),weapon:'25736'}}));
});

const display=(id:string)=>VARIANT_NAMES[id]??wearables.items[id].name;
const model=(id:string)=>readFileSync('public/models/look/'+wearables.items[id].file,'utf8');

test('every style really changes the look, and upgrades need log items and keep the slot',()=>{
 for(const [normal,styled] of [...Object.values(KIT_PAIRS).flat(),...STYLE_PAIRS]){
  assert.notEqual(model(normal),model(styled),`${normal} → ${styled}`);
  assert.equal(wearables.items[normal].slot,wearables.items[styled].slot);
 }
 for(const id of STYLE_PAIRS.flat())if(!STYLE_PAIRS.some(([normal])=>normal===id))assert.ok(logIds.has(id),id);
 for(const {needs,gives} of UPGRADES){
  for(const id of needs)assert.ok(logIds.has(id),id);
  const base=needs.find(id=>wearables.items[id]);assert.ok(base,gives);
  assert.equal(wearables.items[base].slot,wearables.items[gives].slot,gives);
  assert.notEqual(model(base),model(gives),gives);
 }
 // Picker names are unique within the graceful family, so each colour reads clearly.
 const graceful=Object.keys(wearables.items).filter(id=>STYLE_PAIRS.some(p=>p.includes(id))||Object.values(KIT_PAIRS).flat().some(p=>p.includes(id))).filter(id=>/^Graceful/.test(display(id)));
 for(const slot of ['head','cape','body','legs','hands','feet']){const names=graceful.filter(id=>wearables.items[id].slot===slot).map(display);assert.equal(new Set(names).size,names.length,slot);assert.equal(names.length,10,slot);}
});

test('looks and upgrades unlock what the owner can really show',()=>{
 const heads=wearableUnlocks(['7980']);
 for(const id of ['11864','11865','19639','21012','25918'])assert.ok(heads.has(id),id);
 assert.ok(!wearableUnlocks(['4151']).has('11865'),'the imbued helmet needs a slayer helmet source');
 const stars=wearableUnlocks(['25547']);
 for(const id of ['12013','25549','12014','25551','12015','25553','12016','25555'])assert.ok(stars.has(id),id);
 assert.ok(wearableUnlocks(['11785','26372']).has('26374'));assert.ok(!wearableUnlocks(['26372']).has('26374'),'a horn alone is not a crossbow');
 assert.ok(wearableUnlocks(['11824','22966']).has('22978'));assert.ok(!wearableUnlocks(['22966']).has('22978'));
 assert.ok(!heads.has('21888'));
 const grace=wearableUnlocks(['11849']);
 for(const id of ['11850','13579','13591','13603','13615','13627','13637','13667','13677'])assert.ok(grace.has(id),id);
 assert.ok(!grace.has('24743'),'Hallowed needs the dark dye');assert.ok(!grace.has('21061'),'Agility Arena graceful is its own log item');
 assert.ok(wearableUnlocks(['24729']).has('24743'));
 assert.ok(!wearableUnlocks(['24517']).has('24425'),'an orb alone is not a staff');
 assert.ok(wearableUnlocks(['24422','24517']).has('24425'));
 assert.ok(wearableUnlocks(['27695','13233']).has('13243'),'a fixed broken pickaxe takes the smouldering stone');
 assert.ok(!wearableUnlocks(['12800','13233']).has('13243'),'a kit-unlocked look is not an owned base');
 assert.ok(wearableUnlocks(['12829','12833','12819']).has('12817'));assert.ok(!wearableUnlocks(['12829','12819']).has('12817'));
});

test('the picker groups versions of one item under clear style names',()=>{
 const pick=(ids:string[])=>styleGroups(ids.map(id=>({id,name:display(id)})),display);
 const torva=pick(['28254','26382']);assert.equal(torva.length,1);
 assert.deepEqual(torva[0].map(i=>i.id),['26382','28254']);assert.deepEqual(styleLabels(torva[0]),['Torva','Sanguine torva']);
 const hoods=pick(['11850','13579','21061','24743','30045']);assert.equal(hoods.length,1);
 assert.deepEqual(styleLabels(hoods[0]),['Standard','Arceuus','Agility Arena','Hallowed','Varlamore']);
 const helms=pick(['11864','19639','23073']);assert.deepEqual(styleLabels(helms[0]),['Slayer','Black slayer','Hydra slayer']);
 const imbued=pick(['11865','19639','11864']);assert.equal(imbued.length,1);
 assert.deepEqual(imbued[0].map(i=>i.id),['11864','11865','19639']);assert.deepEqual(styleLabels(imbued[0]),['Slayer','Slayer (i)','Black slayer']);
 assert.deepEqual(styleLabels(pick(['11864','11865'])[0]),['Standard','Slayer (i)']);
 const kourend=pick(['11850','13667']);assert.equal(kourend.length,1);assert.deepEqual(styleLabels(kourend[0]),['Standard','Kourend']);
 const prospector=pick(['25551','12014']);assert.equal(prospector.length,1);assert.deepEqual(styleLabels(prospector[0]),['Prospector','Golden prospector']);
 const trims=pick(['2615','2623','4151']);assert.equal(trims.length,2);
 assert.deepEqual(styleLabels(trims[0]),['Gold (g)','Trimmed (t)']);
 assert.deepEqual(styleLabels(pick(['21012','25916','25918'])[0]),['Standard','Vorkath (t)','King Black Dragon (b)']);
 assert.deepEqual(styleLabels(pick(['27251','27253'])[0]),['Standard','Ornament (or)']);
 // Every group a full log could show stays in one slot and has distinct labels.
 const all=[...wearableUnlocks(logIds)].filter(id=>wearables.items[id]);
 for(const slot of new Set(all.map(id=>wearables.items[id].slot))){
  for(const group of pick(all.filter(id=>wearables.items[id].slot===slot))){const labels=styleLabels(group);assert.equal(new Set(labels).size,labels.length,group.map(i=>i.name).join());}
 }
});

test('saved outfits accept every unlocked style and refuse styles the log does not cover',()=>{
 const j=structuredClone(initial) as Journal;
 j.log={obtained:3,total:3,tabs:[{name:'Other',pages:[{name:'Rooftop Agility',obtained:3,total:3,items:[{id:11849,name:'Mark of grace',quantity:12},{id:24422,name:'Nightmare staff',quantity:1},{id:7980,name:'Kbd heads',quantity:1}]}]}]} as unknown as Journal['log'];
 const equipped={...emptyEquipped(),head:'19639',body:'13583',weapon:'25918'};
 assert.deepEqual(assertFlair(j,{equipped}).equipped,equipped);
 assert.throws(()=>assertFlair(j,{equipped:{...emptyEquipped(),body:'24749'}}),'Hallowed graceful needs the dark dye');
 assert.throws(()=>assertFlair(j,{equipped:{...emptyEquipped(),weapon:'24425'}}),'Eldritch staff needs the orb');
 assert.throws(()=>assertFlair(j,{equipped:{...emptyEquipped(),head:'21888'}}),'Turquoise needs Vorkath\'s head');
});
