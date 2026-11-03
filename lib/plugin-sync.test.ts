import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from './model.ts';
import {PET_VARBITS,applyPluginSync,eventDate,itemIdForName,levelForXp,parsePluginSync,pluginAccountMode} from './plugin-sync.ts';
import {setCollectionDate} from './collection-history.ts';
import {applyPetEdit} from './pet-edit.ts';

const ACCOUNT='a'.repeat(64);
const NOW=new Date('2026-10-15T08:00:00Z');
function fixture(){
 const j=structuredClone(initial);
 j.username='Rocky Tester';
 j.pets=j.pets.map(p=>({...p,obtained:false,date:''}));
 j.log=null;j.collectionDates=undefined;
 return j;
}
function body(extra:Record<string,unknown>={}){
 return {plugin:{version:'0.1.0'},character:{name:'Rocky Tester',account:ACCOUNT,accountType:1},sections:['skills','quests','log','pets','combat','diaries'],...extra};
}
function event(o:Record<string,unknown>){return {id:'e-'+Math.random().toString(36).slice(2),occurredAt:NOW.getTime(),localDate:'2026-10-15',skills:{},killCounts:{},...o};}

test('a witnessed pet is recorded with its date and kill count, marked unconfirmed', ()=>{
 const sync=parsePluginSync(body({events:[event({type:'PET',name:'Pet snakeling',detail:'FOLLOWING',killCounts:{zulrah:812}})]}));
 const {journal,accepted}=applyPluginSync(fixture(),sync,NOW);
 const pet=journal.pets.find(p=>p.id==='12921')!;
 assert.equal(accepted.length,1);
 assert.equal(pet.obtained,true);
 assert.equal(pet.date,'2026-10-15');
 assert.equal(pet.obtainedCount,812);
 assert.equal(pet.obtainedUnit,'kills');
 assert.equal(pet.unconfirmed,true);
 assert.equal(journal.log!.tabs.flatMap(t=>t.pages).flatMap(p=>p.items).find(i=>i.id===12921)!.quantity,1);
});

test('a skilling pet records the skill XP at the moment of the drop', ()=>{
 const sync=parsePluginSync(body({events:[event({type:'PET',name:'Rocky',detail:'BACKPACK',skills:{Thieving:13_034_431}})]}));
 const pet=applyPluginSync(fixture(),sync,NOW).journal.pets.find(p=>p.name==='Rocky')!;
 assert.equal(pet.obtainedUnit,'XP');
 assert.equal(pet.obtainedCount,13_034_431);
});

test('a date the player already entered is never replaced', ()=>{
 const j=fixture();
 j.pets=j.pets.map(p=>p.id==='12921'?{...p,obtained:true,date:'2020-01-01'}:p);
 const sync=parsePluginSync(body({events:[event({type:'PET',name:'Pet snakeling',detail:'FOLLOWING'})]}));
 const pet=applyPluginSync(j,sync,NOW).journal.pets.find(p=>p.id==='12921')!;
 assert.equal(pet.date,'2020-01-01');
 assert.equal(pet.unconfirmed,undefined);
});

test('duplicate pets and unnamed pets change nothing but are still accepted', ()=>{
 const sync=parsePluginSync(body({events:[event({type:'PET',name:'Pet snakeling',detail:'DUPLICATE'}),event({type:'PET',name:null,detail:'FOLLOWING'})]}));
 const {journal,accepted}=applyPluginSync(fixture(),sync,NOW);
 assert.equal(accepted.length,2);
 assert.equal(journal.pets.find(p=>p.id==='12921')!.obtained,false);
});

test('a new collection log item gets an unconfirmed date; editing it confirms it', ()=>{
 const sync=parsePluginSync(body({events:[event({type:'COLLECTION_ITEM',name:'Tanzanite fang'})]}));
 const j=applyPluginSync(fixture(),sync,NOW).journal;
 assert.equal(j.collectionDates!['12922'],'2026-10-15');
 assert.deepEqual(j.unconfirmedDates,['12922']);
 const confirmed=setCollectionDate(j,12922,'2026-10-14');
 assert.equal(confirmed.collectionDates!['12922'],'2026-10-14');
 assert.equal(confirmed.unconfirmedDates,undefined);
});

test('editing a pet confirms what the plugin recorded', ()=>{
 const sync=parsePluginSync(body({events:[event({type:'PET',name:'Pet snakeling',detail:'FOLLOWING'})]}));
 const j=applyPluginSync(fixture(),sync,NOW).journal;
 const pet=j.pets.find(p=>p.id==='12921')!;
 applyPetEdit(j,{...pet});
 assert.equal(j.pets.find(p=>p.id==='12921')!.unconfirmed,undefined);
});

test('a full log read only ever adds unlocks', ()=>{
 const j=fixture();
 const first=applyPluginSync(j,parsePluginSync(body({collectionLog:{uniqueObtained:2,uniqueTotal:1717,complete:true,items:{'12922':1,'12932':3}}})),NOW).journal;
 const second=applyPluginSync(first,parsePluginSync(body({collectionLog:{uniqueObtained:1,uniqueTotal:1717,complete:true,items:{'12922':1}}})),NOW).journal;
 const quantity=(id:number)=>second.log!.tabs.flatMap(t=>t.pages).flatMap(p=>p.items).find(i=>i.id===id)!.quantity;
 assert.equal(quantity(12932),3);
 assert.equal(second.log!.obtained,2);
});

test('owned pets in a log read are marked obtained without inventing a date', ()=>{
 const j=applyPluginSync(fixture(),parsePluginSync(body({collectionLog:{uniqueObtained:1,uniqueTotal:1717,complete:true,items:{'12921':1}}})),NOW).journal;
 const pet=j.pets.find(p=>p.id==='12921')!;
 assert.equal(pet.obtained,true);
 assert.equal(pet.date,'');
 assert.equal(pet.unconfirmed,undefined);
});

test('sections switched off in the plugin are left untouched', ()=>{
 const sync=parsePluginSync(body({sections:['skills'],skills:{Attack:13_034_431},events:[event({type:'PET',name:'Pet snakeling',detail:'FOLLOWING'})],collectionLog:{uniqueObtained:1,uniqueTotal:1717,complete:true,items:{'12922':1}}}));
 const {journal,accepted}=applyPluginSync(fixture(),sync,NOW);
 assert.equal(accepted.length,1);
 assert.equal(journal.log,null);
 assert.equal(journal.pets.find(p=>p.id==='12921')!.obtained,false);
 assert.equal(journal.hiscores.skills.find(s=>s.name==='Attack')!.level,99);
});

test('skill XP sets levels and the overall total, and never goes backwards', ()=>{
 const j=fixture();
 j.hiscores={skills:[{name:'Overall',level:100,xp:1000,rank:5},{name:'Attack',level:50,xp:101_333,rank:9}],activities:[]};
 const up=applyPluginSync(j,parsePluginSync(body({skills:{Attack:13_034_431,Strength:0}})),NOW).journal;
 assert.equal(up.hiscores.skills.find(s=>s.name==='Attack')!.level,99);
 const overall=up.hiscores.skills.find(s=>s.name==='Overall')!;
 assert.equal(overall.level,100);
 assert.equal(overall.rank,5);
 const down=applyPluginSync(up,parsePluginSync(body({skills:{Attack:5}})),NOW).journal;
 assert.equal(down.hiscores.skills.find(s=>s.name==='Attack')!.xp,13_034_431);
});

test('quests update the existing quest list only', ()=>{
 const j=fixture();
 j.profile={quests:[{id:1,name:"Cook's Assistant",points:1,type:'',state:'not_started'}],diaries:[],combat:[],syncedAt:''};
 const out=applyPluginSync(j,parsePluginSync(body({quests:[{id:1,name:"Cook's Assistant",state:'finished'},{id:2,name:'Unknown quest',state:'finished'}]})),NOW);
 assert.deepEqual(out.journal.profile!.quests.map(q=>q.state),['finished']);
 const none=applyPluginSync(fixture(),parsePluginSync(body({quests:[{id:1,name:"Cook's Assistant",state:'finished'}]})),NOW);
 assert.equal(none.journal.profile,undefined);
 assert.equal(none.notes.length,1);
});

test('the account type follows the game', ()=>{
 assert.equal(pluginAccountMode(0),'normal');
 assert.equal(pluginAccountMode(3),'hardcore_ironman');
 assert.equal(pluginAccountMode(99),null);
 assert.equal(applyPluginSync(fixture(),parsePluginSync(body()),NOW).journal.accountMode,'ironman');
});

test('payloads are validated and bounded', ()=>{
 assert.throws(()=>parsePluginSync(null));
 assert.throws(()=>parsePluginSync({character:{name:'A',account:'short'}}));
 assert.throws(()=>parsePluginSync(body({character:{name:'Name that is far too long',account:ACCOUNT}})));
 assert.throws(()=>parsePluginSync(body({events:Array.from({length:201},()=>event({type:'COMBAT_TASK',name:'x'}))})));
 const cleaned=parsePluginSync(body({sections:['skills','admin'],events:[event({type:'HACK'}),event({id:'bad id!',type:'PET'}),event({type:'PET',name:'Vorki',detail:'WHATEVER'})]}));
 assert.deepEqual([...cleaned.sections],['skills']);
 assert.equal(cleaned.events.length,1);
 assert.equal(cleaned.events[0].detail,null);
});

test('names resolve to items only when they are unambiguous', ()=>{
 assert.equal(itemIdForName('pet snakeling'),12921);
 assert.equal(itemIdForName('Graceful hood'),null);
 assert.equal(itemIdForName(null),null);
});

test('event dates use the player\'s day, falling back to the server\'s when it is ahead', ()=>{
 const base={id:'x',type:'PET' as const,name:null,detail:null,skills:{},killCounts:{}};
 assert.equal(eventDate({...base,occurredAt:Date.parse('2026-01-02T03:00:00Z'),localDate:'2026-01-02'}),'2026-01-02');
 assert.equal(eventDate({...base,occurredAt:Date.parse('2026-01-02T03:00:00Z'),localDate:'2999-01-01'}),'2026-01-02');
 assert.equal(eventDate({...base,occurredAt:Date.parse('2026-01-02T03:00:00Z'),localDate:null}),'2026-01-02');
});

test('levels match the XP table', ()=>{
 assert.equal(levelForXp(0),1);
 assert.equal(levelForXp(83),2);
 assert.equal(levelForXp(13_034_430),98);
 assert.equal(levelForXp(13_034_431),99);
 assert.equal(levelForXp(200_000_000),99);
});

test('plugin tokens are short, grouped and forgiving to paste', async ()=>{
 const {newToken,normalizeToken,tokenHash:hashToken}=await import('./plugin-token.ts');
 const token=newToken();
 assert.match(token,/^SPN(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
 assert.equal(normalizeToken(token.toLowerCase().replaceAll('-',' ')),normalizeToken(token));
 assert.equal(await hashToken(' '+token.toLowerCase()+' '),await hashToken(token));
 assert.equal(normalizeToken('SPN-IIII-OOOO-LLLL-UUUU'),null);
 assert.equal(normalizeToken('SPN-0000'),null);
 assert.notEqual(newToken(),newToken());
});

test('the Barbarian Assault gamble count fills in the Penance Queen count, and the count a new one came at', ()=>{
 const queen=()=>fixture().pets.find(p=>p.name==='Pet Penance Queen')!;
 assert.ok(queen().methods.some(m=>m.name===PET_VARBITS[0].method),'the catalogue still has the gamble method');
 const sync=parsePluginSync(body({varbits:{'4768':312}}));
 let pet=applyPluginSync(fixture(),sync,NOW).journal.pets.find(p=>p.name==='Pet Penance Queen')!;
 assert.equal(pet.methods.find(m=>m.name==='High-level gambles')!.kc,312);
 // With pets switched off, nothing changes.
 pet=applyPluginSync(fixture(),parsePluginSync(body({sections:['skills'],varbits:{'4768':312}})),NOW).journal.pets.find(p=>p.name==='Pet Penance Queen')!;
 assert.equal(pet.methods.find(m=>m.name==='High-level gambles')!.kc,queen().methods.find(m=>m.name==='High-level gambles')!.kc);
 // A Penance Queen that drops in the same sync came at that gamble count.
 pet=applyPluginSync(fixture(),parsePluginSync(body({varbits:{'4768':640},events:[event({type:'PET',name:'Pet penance queen',detail:'BACKPACK'})]})),NOW).journal.pets.find(p=>p.name==='Pet Penance Queen')!;
 assert.equal(pet.obtained,true);
 assert.deepEqual({unit:pet.obtainedUnit,count:pet.obtainedCount},{unit:'gambles',count:640});
});
