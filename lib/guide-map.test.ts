import {existsSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyGuide,parseGuide} from './guides';
import {MAP_LEG_COLOURS,MAP_PIN_GROUPS,MAP_PIN_HINT,MAP_PIN_ICON,MAP_PIN_KINDS,isFightKind,stopIcon,guideMapExits,guideMapFocus,guideMapLegs,guideMapStopColours,hasStopDetails,hasStopText,parseGuideMap,tidyStop,type GuideMapPinKind} from './guide-map';

const map={title:' The Restless Ghost ',x:3222,y:3218,plane:0,zoom:8,pins:[{x:3243,y:3210,plane:0,label:' Father Aereck ',kind:'start'},{x:3147,y:3175,plane:0,label:'Father Urhney',kind:'npc'}]};
test('map sections keep the view and trimmed stops',()=>{
 assert.deepEqual(parseGuideMap(map),{...map,title:'The Restless Ghost',pins:[{...map.pins[0],label:'Father Aereck'},map.pins[1]]});
});
test('map sections reject bad stops and views',()=>{
 assert.throws(()=>parseGuideMap({...map,zoom:20}),/where the map opens/);
 assert.throws(()=>parseGuideMap({...map,plane:4}),/where the map opens/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...map.pins[0],kind:'shop'}]}),/kind/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...map.pins[0],x:1.5}]}),/Place every stop/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...map.pins[0],label:'x'.repeat(61)}]}),/60 characters/);
 assert.throws(()=>parseGuideMap({...map,pins:Array(21).fill(map.pins[0])}),/20 stops/);
});
test('a guide can carry a map section',()=>{
 const g={...emptyGuide(),title:'Restless Ghost',activity:'The Restless Ghost',summary:'Free the ghost haunting Lumbridge.',strategy:'Talk to Father Aereck in the church.',blocks:[{id:'m1',kind:'map',...map}]};
 const parsed=parseGuide(g);
 assert.equal(parsed.blocks?.[0].kind,'map');
});

test('route lines are on unless a map turns them off',()=>{
 assert.equal('lines' in parseGuideMap(map),false);
 assert.equal('lines' in parseGuideMap({...map,lines:true}),false);
 assert.equal(parseGuideMap({...map,lines:false}).lines,false);
 assert.throws(()=>parseGuideMap({...map,lines:'yes'}),/route lines/);
 const g={...emptyGuide(),title:'Restless Ghost',activity:'The Restless Ghost',summary:'Free the ghost haunting Lumbridge.',strategy:'Talk to Father Aereck in the church.',blocks:[{id:'m1',kind:'map',...map,lines:false}]};
 const block=parseGuide(g).blocks?.[0];
 assert.equal(block?.kind==='map'&&block.lines,false);
});
const pin=(x:number,y:number,kind:GuideMapPinKind='stop',plane=0)=>({x,y,plane,label:'',kind});
test('legs join stops in order, skipping teleports in and floor changes',()=>{
 const pins=[pin(1,1,'start'),pin(5,5),pin(9,9,'teleport'),pin(12,9),pin(12,9,'stop',1),pin(14,9,'danger',1),pin(14,9,'stop',1),pin(20,20)];
 assert.deepEqual(guideMapLegs({pins}).map(l=>[l.from,l.to,l.plane]),[[0,1,0],[2,3,0],[4,5,1]]);
 assert.deepEqual(guideMapLegs({pins,lines:false}),[]);
 assert.deepEqual(guideMapLegs({pins:[pin(1,1)]}),[]);
});
test('each drawn leg takes the next colour, and its stop shares it',()=>{
 const pins=Array.from({length:MAP_LEG_COLOURS.length+2},(_,i)=>pin(i*10,0));
 const legs=guideMapLegs({pins});
 assert.deepEqual(legs.map(l=>l.colour),[...MAP_LEG_COLOURS,MAP_LEG_COLOURS[0]]);
 for(let i=1;i<legs.length;i++)assert.notEqual(legs[i].colour,legs[i-1].colour);
 assert.deepEqual(guideMapStopColours({pins}),[null,...legs.map(l=>l.colour)]);
 assert.deepEqual(guideMapStopColours({pins:[pin(0,0,'teleport'),pin(5,0),pin(9,0,'teleport'),pin(12,0)]}),[null,MAP_LEG_COLOURS[0],null,MAP_LEG_COLOURS[1]]);
 assert.deepEqual(guideMapStopColours({pins,lines:false}),pins.map(()=>null));
});
test('a chosen stop focuses the leg that ends there; the first stop takes the leg it starts',()=>{
 const pins=[pin(1,1,'start'),pin(5,5),pin(9,9,'teleport'),pin(12,9)];
 const focus=(i:number,lines?:boolean)=>{const f=guideMapFocus({pins,lines},i);return [f.leg&&[f.leg.from,f.leg.to],f.stops];};
 assert.deepEqual(focus(0),[[0,1],[0,1]]);
 assert.deepEqual(focus(1),[[0,1],[0,1]]);
 assert.deepEqual(focus(2),[null,[2]]);
 assert.deepEqual(focus(3),[[2,3],[2,3]]);
 assert.deepEqual(focus(1,false),[null,[0,1]]);
 assert.deepEqual(guideMapFocus({pins:[pin(1,1)]},0),{leg:null,stops:[0]});
});

test('a route that changes floor or goes underground gets an exit at the stop before, unless the map already has one',()=>{
 const pins=[pin(2933,3250),pin(2928,3256),pin(2927,3253,'fight',1),pin(2931,3253,'stop',1),pin(3105,3162),pin(3104,9576),pin(3222,3218,'teleport')];
 const exits=guideMapExits(pins);
 assert.deepEqual(exits.map(e=>[e.stop,e.dir,e.from.x,e.to.plane]),[[2,'up',2928,1],[4,'down',2931,0],[5,'down',3105,0]]);
 const ladder={from:{x:3105,y:3162,plane:0},to:{x:3104,y:9576,plane:0},name:'Climb-down Ladder',dir:'down' as const};
 assert.deepEqual(guideMapExits(pins,[ladder]).map(e=>e.stop),[2,4]);
 // A walk between the surface and the underground on the same floor draws no line.
 assert.deepEqual(guideMapLegs({pins:[pin(3105,3162),pin(3104,9576)]}),[]);
});

test('the new stop kinds parse, and maps saved with the old ones still do',()=>{
 for(const kind of ['stop','start','npc','item','bank','teleport','danger','fight','fight-melee','fight-ranged','fight-magic','dig','search','cutscene'])assert.equal(parseGuideMap({...map,pins:[{...map.pins[0],kind}]}).pins[0].kind,kind);
});

const guideWith=(pins:unknown[])=>({...emptyGuide(),title:'Dragon Slayer I',activity:'Dragon Slayer I',summary:'Rebuild the map to Crandor and slay Elvarg.',strategy:'Talk to the Guildmaster in the Champions\' Guild.',blocks:[{id:'m1',kind:'map',...map,pins}]});
test('stops can carry items, chat options and a note; older stops parse unchanged',()=>{
 const door={x:3050,y:9840,plane:0,label:'Use the four items on the magic door',kind:'stop',items:[{id:'301',quantity:1},{id:'1791',quantity:1},{id:'950',quantity:1},{id:'1907',quantity:1}],note:' Do not drink the mind bomb. '};
 const oziach={x:3068,y:3517,plane:0,label:'Oziach',kind:'npc',dialogue:[' Can you sell me a rune platebody? ','','I thought you were going to give me a quest.','A dragon, that sounds like fun.']};
 const block=parseGuide(guideWith([door,oziach,map.pins[1]])).blocks?.[0];
 assert.ok(block&&block.kind==='map');
 assert.deepEqual(block.pins[0].items,door.items);
 assert.equal(block.pins[0].note,'Do not drink the mind bomb.');
 assert.deepEqual(block.pins[1].dialogue,['Can you sell me a rune platebody?','I thought you were going to give me a quest.','A dragon, that sounds like fun.']);
 assert.deepEqual(block.pins[2],map.pins[1]);
 assert.equal(hasStopDetails(block.pins[2]),false);
 assert.equal(hasStopDetails(block.pins[1]),true);
 // Empty details are left out, so a stop saved with none reads like an older stop.
 assert.deepEqual(parseGuideMap({...map,pins:[{...map.pins[1],items:[],dialogue:['  '],note:''}]}).pins[0],map.pins[1]);
});
test('stop details have strict limits',()=>{
 const pin=map.pins[1],item=(id:string,quantity=1)=>({id,quantity});
 assert.throws(()=>parseGuide(guideWith([{...pin,items:[item('999999999')]}])),/known items/);
 assert.throws(()=>parseGuide(guideWith([{...pin,items:[item('301'),item('301')]}])),/each once/);
 assert.throws(()=>parseGuide(guideWith([{...pin,items:[item('301',0)]}])),/quantity/);
 assert.throws(()=>parseGuide(guideWith([{...pin,items:[item('301',1.5)]}])),/quantity/);
 assert.throws(()=>parseGuide(guideWith([{...pin,items:['301','950','1907','1791','960','1539','2347','995','552'].map(id=>item(id))}])),/up to 8/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...pin,dialogue:Array(9).fill('Yes.')}]}),/up to 8 chat options/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...pin,dialogue:['x'.repeat(101)]}]}),/100 characters/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...pin,dialogue:'Yes.'}]}),/chat option/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...pin,note:'x'.repeat(201)}]}),/200 characters/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...pin,items:{id:'301'}}]}),/known items/);
});
test('the editor tidies a stop the way the server saves it',()=>{
 assert.deepEqual(tidyStop({x:1,y:2,plane:0,label:' Oziach ',kind:'npc',items:[],dialogue:['',' Yes. '],note:' '}),{x:1,y:2,plane:0,label:'Oziach',kind:'npc',dialogue:['Yes.']});
});
test('a stop can say what to do there, which makes the map a step by itself',()=>{
 const steps=parseGuideMap({...map,pins:[{...map.pins[0],text:' Teleport to [[Varrock Teleport]]. '},{...map.pins[1],text:'   '}]});
 assert.equal(steps.pins[0].text,'Teleport to [[Varrock Teleport]].');
 assert.equal('text' in steps.pins[1],false);
 assert.equal(hasStopText(steps),true);
 // Maps saved before stops had instructions read as before.
 assert.equal(hasStopText(parseGuideMap(map)),false);
 assert.equal(hasStopDetails({...map.pins[1],text:'Walk here.'}),false);
 assert.throws(()=>parseGuideMap({...map,pins:[{...map.pins[0],text:'x'.repeat(241)}]}),/240 characters/);
 assert.throws(()=>parseGuideMap({...map,pins:[{...map.pins[0],text:['Walk']}]}),/what to do/);
 assert.deepEqual(tidyStop({x:1,y:2,plane:0,label:'Tree patch',kind:'stop',text:' Plant. '}),{x:1,y:2,plane:0,label:'Tree patch',kind:'stop',text:'Plant.'});
 assert.equal('text' in tidyStop({x:1,y:2,plane:0,label:'Tree patch',kind:'stop',text:' '}),false);
 // A whole guide keeps the instructions through the server's check.
 const g=parseGuide(guideWith([{...map.pins[0],text:'Teleport to Varrock.'}]));
 const block=g.blocks?.find(b=>b.kind==='map');
 assert.ok(block&&block.kind==='map');
 assert.equal(block.pins[0].text,'Teleport to Varrock.');
});
test('the editor offers every stop kind once: a plain fight in any style, then a fight per recommended style',()=>{
 const listed=MAP_PIN_GROUPS.flatMap(g=>g.kinds.map(k=>k.kind));
 assert.deepEqual([...listed].sort(),[...MAP_PIN_KINDS].sort());
 assert.equal(new Set(listed).size,listed.length);
 const fights=MAP_PIN_GROUPS.find(g=>g.label==='Fight')?.kinds;
 assert.deepEqual(fights?.map(k=>k.kind),['fight','fight-melee','fight-ranged','fight-magic','danger']);
 assert.equal(fights?.[0].label,'Fight (any style)');
 // Any style is the plain hitsplat; a recommended style adds its weapon.
 assert.equal(MAP_PIN_ICON.fight,'/icons/game/hitsplat.png');
 for(const k of ['melee','ranged','magic'])assert.equal(MAP_PIN_ICON[`fight-${k}` as GuideMapPinKind],`/icons/game/fight-${k}.png`);
 assert.equal(MAP_PIN_HINT.fight,'Fight · any style');
 assert.equal(MAP_PIN_HINT['fight-melee'],'Fight · Melee recommended');
 assert.equal(MAP_PIN_HINT['fight-magic'],'Fight · Magic recommended');
 assert.deepEqual(MAP_PIN_KINDS.filter(isFightKind),['fight','fight-melee','fight-ranged','fight-magic']);
 for(const kind of MAP_PIN_KINDS){const icon=MAP_PIN_ICON[kind];if(icon)assert.ok(existsSync('public'+icon),icon);}
});
test('a stop saved as fight before the styles were split stays a fight, now in any style',()=>{
 const saved=parseGuideMap({...map,pins:[{...map.pins[0],kind:'fight',label:'Kill the zombie rat for the red key'}]}).pins[0];
 assert.equal(saved.kind,'fight');assert.equal(MAP_PIN_HINT[saved.kind],'Fight · any style');
});
test('an item stop that lists items shows its first item as its icon',()=>{
 const image=(id:string)=>`/items/${id}.png`;
 assert.equal(stopIcon({kind:'item',items:[{id:'1536',quantity:1}]},image),'/items/1536.png');
 assert.equal(stopIcon({kind:'item'},image),MAP_PIN_ICON.item);
 // Other kinds keep their own icon even with items (the magic door's four items).
 assert.equal(stopIcon({kind:'stop',items:[{id:'301',quantity:1}]},image),MAP_PIN_ICON.stop);
 assert.equal(stopIcon({kind:'item',items:[{id:'0',quantity:1}]},()=>null),MAP_PIN_ICON.item);
});
