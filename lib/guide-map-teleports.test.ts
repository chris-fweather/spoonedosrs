import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {namedTeleport,stopLook,teleportStopIcon,teleportStopMethod,teleportsNear,travelMethod} from './guide-map-teleports';
import {MAP_PIN_ICON,parseGuideMap,tidyStop} from './guide-map';
import {TRAVEL_ICON} from './world-map-places';
import {existsSync} from 'node:fs';
import type {TravelData} from './world-map-routing';

const data=JSON.parse(readFileSync('public/world-map/travel.json','utf8')) as TravelData;
test('a teleport stop lists the teleports that land there, and the one its label names',()=>{
 const edgeville=teleportsNear(data,{x:3087,y:3496,plane:0},'Glory teleport to Edgeville');
 assert.ok(edgeville.some(t=>t.name==='Amulet of glory: Edgeville'));
 assert.ok(edgeville.some(t=>t.name==='Edgeville Home Teleport'));
 assert.deepEqual(edgeville.filter(t=>t.named).map(t=>t.name),['Amulet of glory: Edgeville']);
 assert.equal(edgeville.find(t=>t.named)?.icon,'/items/1712.png');
 const lumbridge=teleportsNear(data,{x:3222,y:3218,plane:0},'Lumbridge teleport');
 assert.deepEqual(lumbridge.map(t=>t.name).sort(),['Lumbridge Home Teleport','Lumbridge Teleport','Lumbridge tablet']);
 // Spells first, with their spellbook art.
 assert.equal(lumbridge[0].name,'Lumbridge Teleport');assert.equal(lumbridge[0].icon,'/icons/spells/lumbridge-teleport.png');
 assert.deepEqual(lumbridge.filter(t=>t.named).map(t=>t.name),['Lumbridge Teleport']);
 assert.deepEqual(teleportsNear(data,{x:3222,y:3218,plane:0},'Lumbridge spawn / Home Teleport').filter(t=>t.named).map(t=>t.name),['Lumbridge Home Teleport']);
});
test('a label naming no teleport, or two equally, highlights none',()=>{
 const list=[{name:'Amulet of glory: Edgeville',via:'Amulet of glory'},{name:'Edgeville Home Teleport',via:'Home teleport'}];
 assert.equal(namedTeleport('Teleport to Edgeville',list),-1);
 assert.equal(namedTeleport('',list),-1);
 assert.equal(namedTeleport('Glory to Edgeville',list),0);
 assert.equal(namedTeleport('Lumbridge tab',[{name:'Lumbridge Teleport',via:'Standard spellbook'},{name:'Lumbridge tablet',via:'Teleport tablets'}]),1);
});
test('a stop far from any teleport lists none, and other floors do not count',()=>{
 assert.deepEqual(teleportsNear(data,{x:2935,y:9657,plane:0}),[]);
 assert.deepEqual(teleportsNear(data,{x:3087,y:3496,plane:1}),[]);
});

test('a teleport stop shows how it is reached: item art, a tablet, a spell, or the transport icon',()=>{
 const m=(t:string)=>travelMethod(t);
 assert.deepEqual(m('Glory teleport to Edgeville'),{name:'Amulet of glory',icon:'/items/1712.png'});
 assert.equal(m('Skills necklace teleport')?.name,'Skills necklace');
 assert.deepEqual(m('Varrock teleport'),{name:'Varrock Teleport',icon:'/icons/spells/varrock-teleport.png'});
 assert.equal(m('Camelot teleport')?.icon,'/icons/spells/camelot-teleport.png');
 assert.equal(m('Lumbridge spawn / Home Teleport')?.icon,'/icons/spells/lumbridge-home-teleport.png');
 assert.match(m('Use a Varrock tab')?.icon??'',/^\/items\/\d+\.png$/);
 for(const t of ['Spirit tree','Fairy ring CKS','Gnome glider to Ta Quir Priw','Boat to Brimhaven'])assert.equal(m(t)?.icon,TRAVEL_ICON.transport,t);
 assert.equal(m('Arrive in Brimhaven'),null);
 for(const t of ['Glory teleport','Varrock teleport','Spirit tree','Home Teleport','Varrock tab'])assert.ok(existsSync('public'+m(t)!.icon),t);
});
test('the writer\'s via wins, then the label, then the travel data; the Home Teleport icon only when nothing matches',()=>{
 const pin={kind:'teleport' as const,label:'Arrive in Brimhaven'};
 assert.equal(teleportStopIcon(pin),MAP_PIN_ICON.teleport);
 assert.equal(teleportStopIcon({...pin,via:'Boat'}),TRAVEL_ICON.transport);
 assert.equal(teleportStopMethod({...pin,label:'Edgeville'},[{name:'Amulet of glory: Edgeville',via:'Amulet of glory',icon:'/items/1712.png',named:true}])?.name,'Amulet of glory: Edgeville');
 assert.equal(teleportStopMethod({...pin,via:'Amulet of glory',label:'Spirit tree'})?.name,'Amulet of glory');
 assert.equal(stopLook({x:0,y:0,plane:0,...pin,label:'Spirit tree'},[],()=>null).hint,'Spirit tree');
 assert.equal(stopLook({x:0,y:0,plane:0,...pin,label:'Glory teleport'},[],()=>null).hint,'Teleport · Amulet of glory');
 assert.equal(stopLook({x:0,y:0,plane:0,kind:'npc',label:'Oziach'},[],()=>null).hint,'Talk to');
});
test('via is saved on teleport stops only, trimmed and short',()=>{
 const map={title:'',x:3222,y:3218,plane:0,zoom:8};
 assert.equal(parseGuideMap({...map,pins:[{x:1,y:1,plane:0,label:'Edgeville',kind:'teleport',via:' Amulet of glory '}]}).pins[0].via,'Amulet of glory');
 assert.equal(parseGuideMap({...map,pins:[{x:1,y:1,plane:0,label:'Oziach',kind:'npc',via:'Amulet of glory'}]}).pins[0].via,undefined);
 assert.throws(()=>parseGuideMap({...map,pins:[{x:1,y:1,plane:0,label:'x',kind:'teleport',via:'x'.repeat(61)}]}),/60 characters/);
 assert.equal(tidyStop({x:1,y:1,plane:0,label:'x',kind:'teleport',via:'  '}).via,undefined);
});
