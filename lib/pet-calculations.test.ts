import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalogue from './catalogue.json' with {type: 'json'};
import type {Journal,Method,Pet} from './model';
import {initial,validatePet} from './model';
import {CALCULATION_VERSION,HISCORES_COUNT_UNITS,normalizeRates,upgradeEstimates} from './estimates';
import {petExpectedHours,petLuck} from './pet-luck';
import {hiscoresCount} from './pet-record';
import {COX_RAIDS_PER_PET_POINTS,coxRaidsPerPet,raidRate,toaRaidsPerPet,toaScaledLevel,validRaid} from './raid-rates';

const close=(a:number|null|undefined,b:number,eps=1e-6)=>assert.ok(a!=null&&Math.abs(a-b)<=eps,`${a} ≈ ${b}`);
const SKILLS=['Attack','Woodcutting','Fishing','Firemaking','Mining','Thieving','Runecraft','Hunter','Farming','Agility','Sailing'];
const journal=(xp=13_034_431,level=99):Journal=>{
 const j=structuredClone(initial);
 j.hiscores={skills:SKILLS.map(name=>({name,level,xp,rank:1})),activities:[]};
 return normalizeRates(j);
};
const pet=(j:Journal,name:string)=>j.pets.find(p=>p.name===name)!;
const method=(p:Pet,name:string)=>p.methods.find(m=>m.name===name)!;

test('Phoenix: the 200M Firemaking rate only counts at 200M XP',()=>{
 // 57M Firemaking and no pet: the normal 1/5,000 at 50 rolls an hour, 100 h (not the 200M 6.7 h).
 const j=journal();j.hiscores.skills.find(s=>s.name==='Firemaking')!.xp=57_000_000;
 const phoenix=pet(j,'Phoenix');
 assert.equal(method(phoenix,'200 million Firemaking').xp200m,true);
 close(petExpectedHours(phoenix,j),100);
 close(petLuck(phoenix,j).expected,100);
 // No hiscores: the 200M method cannot be shown to apply.
 close(petExpectedHours(pet(initial,'Phoenix')),100);
 close(petExpectedHours(pet(initial,'Phoenix'),initial),100);
 // At 200M it does: 5,000 ÷ 15 ÷ 50.
 j.hiscores.skills.find(s=>s.name==='Firemaking')!.xp=200_000_000;
 close(petExpectedHours(phoenix,j),5000/15/50);
});

test('every pet has expected hours, including the eleven that had none',()=>{
 const missing=initial.pets.filter(p=>petExpectedHours(p,initial)===null).map(p=>p.name);
 assert.deepEqual(missing,[]);
 const hours=(name:string)=>petExpectedHours(pet(initial,name),initial);
 close(hours('Olmlet'),53/0.1314);
 close(hours('Jal-Nib-Rek'),1/(1-(74/75)*(99/100)));
 close(hours("Lil' Zik"),500/2.8);
 close(hours('Abyssal protector'),4000/39);
 close(hours('Yami'),100/15);
 close(hours('Little Nightmare'),1400/10);
 close(hours('Dom'),250/32);
 close(hours('Soup'),4691/90);
 close(hours('Bloodhound'),1000/10);
 close(hours('Maggot marquess'),1/(300/1500/3000+150/1500/2500+33/1500/1250+6/1500/500+3/1500/10+1/1500/2)/25);
 close(hours('Mr McGroot'),37525/900);
 // Mr McGroot follows the Hunter level.
 const low=journal(13_034_431,70);
 assert.equal(method(pet(low,'Mr McGroot'),'Goat hunting').rate,40000-25*70);
});

test("Lil' Zik is a flat personal roll per completion: 1/650 normal, 1/500 Hard Mode",()=>{
 const zik=pet(initial,"Lil' Zik");
 assert.deepEqual(zik.methods.map(m=>[m.name,m.rate,m.unit,m.activity,m.kph]),[['Theatre of Blood',650,'raids','Theatre of Blood',3.2],["Lil' zik (Hard Mode)",500,'raids','Theatre of Blood: Hard Mode',2.8]]);
 assert.ok(zik.methods.every(m=>!m.raid&&m.rateConfirmed));
});

test('Smol Heredit is 1/200 a completion, with the quiver exchange as its own 1/200 roll',()=>{
 const smol=pet(initial,'Smol Heredit');
 assert.equal(method(smol,'Sol Heredit').rate,200);
 close(method(smol,'Colosseum · sacrifice quiver').rate,1/(1-(199/200)**2));
 assert.equal(method(smol,'Colosseum · sacrifice quiver').activity,null);
});

test('Jal-Nib-Rek: 1/100 off task, 1/75 on task, and the cape exchange as a further 1/100',()=>{
 const zuk=pet(initial,'Jal-Nib-Rek');
 assert.deepEqual(zuk.methods.map(m=>m.name),['TzKal-Zuk','Inferno · on task, keep cape','Inferno · off task, sacrifice cape','Inferno · on task, sacrifice cape']);
 assert.equal(method(zuk,'TzKal-Zuk').rate,100);assert.equal(method(zuk,'TzKal-Zuk').activity,'TzKal-Zuk');
 assert.equal(method(zuk,'Inferno · on task, keep cape').rate,75);
 close(method(zuk,'Inferno · off task, sacrifice cape').rate,50.251256281407);
 close(method(zuk,'Inferno · on task, sacrifice cape').rate,1/(1-(74/75)*(99/100)));
});

test('raid formulas: Chambers of Xeric needs a purple, Tombs of Amascut follows points and raid level',()=>{
 assert.equal(COX_RAIDS_PER_PET_POINTS,45_982_800);
 close(coxRaidsPerPet(30_000),1532.76);
 close(coxRaidsPerPet(50_000),919.656);
 // The Wiki's own example: 26,025 points is about 1/1,765.
 assert.ok(Math.abs(coxRaidsPerPet(26_025)!-1765)<3);
 assert.equal(coxRaidsPerPet(0),null);
 assert.equal(toaScaledLevel(300),300);assert.equal(toaScaledLevel(400),400);
 close(toaScaledLevel(500),400+100/3);assert.equal(toaScaledLevel(550),450);assert.equal(toaScaledLevel(600),450);
 close(toaRaidsPerPet(20_000,400),350);
 close(toaRaidsPerPet(25_000,300),560);
 close(toaRaidsPerPet(30_000,550),100*(350_000-700*450)/30_000);
 assert.equal(toaRaidsPerPet(30_000,600),toaRaidsPerPet(30_000,550));
 // PetCord's 1/321 for solo 400s is about 21,800 points.
 assert.ok(Math.abs(toaRaidsPerPet(21_800,400)!-321)<1);
 assert.equal(raidRate({kind:'cox',points:45_000}),coxRaidsPerPet(45_000));
 assert.ok(validRaid({kind:'toa',points:20_000,level:400})&&validRaid({kind:'cox',points:30_000})&&validRaid(undefined));
 for(const bad of [{kind:'tob',points:1},{kind:'cox',points:0},{kind:'toa',points:20_000},{kind:'cox',points:1,level:300},{kind:'toa',points:1,level:700},{kind:'cox',points:1,extra:1},[]])assert.equal(validRaid(bad),false);
});

test('raid methods count hiscores raids and their rate follows the inputs unless the player set one',()=>{
 const olmlet=pet(initial,'Olmlet'),toa=pet(initial,"Tumeken's guardian");
 const cox=method(olmlet,'Chambers of Xeric raids'),cm=method(olmlet,'Challenge Mode raids');
 assert.equal(olmlet.methods[olmlet.plannedMethod??0],cox);
 assert.deepEqual([cox.unit,cox.activity,cox.raid,cox.kph],['raids','Chambers of Xeric',{kind:'cox',points:30_000},2.9]);
 assert.deepEqual([cm.activity,cm.raid,cm.kph],['Chambers of Xeric: Challenge Mode',{kind:'cox',points:45_000},2.5]);
 close(cox.rate,45_982_800/30_000);close(cm.rate,45_982_800/45_000);
 assert.deepEqual(toa.methods.map(m=>[m.name,m.rate,m.raid]),[['Tombs of Amascut',1225,{kind:'toa',points:20_000,level:150}],['Tombs of Amascut: Expert Mode',350,{kind:'toa',points:20_000,level:400}]]);
 const synced=structuredClone(initial);synced.hiscores.activities=[{name:'Chambers of Xeric',score:250,rank:1},{name:'Tombs of Amascut: Expert Mode',score:90,rank:1}];
 assert.equal(hiscoresCount(olmlet,synced,cox)?.value,250);assert.equal(hiscoresCount(toa,synced,toa.methods[1])?.value,90);
 // The player changes their points: the rate follows. A typed rate stays.
 const j=structuredClone(initial),expert=()=>method(pet(j,"Tumeken's guardian"),'Tombs of Amascut: Expert Mode');
 expert().raid={kind:'toa',points:30_000,level:500};normalizeRates(j);
 close(expert().rate,100*(350_000-700*(400+100/3))/30_000);
 Object.assign(expert(),{rate:400,rateOverride:true,raid:{kind:'toa',points:10_000,level:300}});normalizeRates(j);
 assert.equal(expert().rate,400);
 assert.ok(validatePet(pet(j,"Tumeken's guardian")));
 expert().raid={kind:'toa',points:-1,level:300} as never;
 assert.equal(validatePet(pet(j,"Tumeken's guardian")),false);
});

test('skilling sheet rows: rate and pace sit on the right method, and a sync at 99 changes nothing',()=>{
 const synced=journal();
 for(const name of ['Beaver','Rock golem','Rift guardian','Heron','Rocky'])close(petExpectedHours(pet(synced,name),synced),petExpectedHours(pet(initial,name),initial)!,1e-6);
 // TempleOSRS's benchmarks: Beaver teak 111 h, Rock golem gems 118 h, Rift guardian mind runes with runners 68 h.
 const beaver=pet(initial,'Beaver'),golem=pet(initial,'Rock golem'),rift=pet(initial,'Rift guardian');
 assert.deepEqual([method(beaver,'Teak (1.5t)').rate,method(beaver,'Teak (1.5t)').kph],[22_258_185,200_000]);
 assert.equal(beaver.plannedMethod??0,0);
 close(petExpectedHours(beaver),22_258_185/200_000);
 assert.deepEqual([method(golem,'Gemstones (3t)').kph,method(golem,'Adamantite').kph],[115_050,13_000]);
 close(method(golem,'Adamantite').rate,(59328-25*99)*95);
 close(petExpectedHours(golem),(211886-25*99)*65/115_050);
 assert.equal(method(rift,'Mind rune (4 runners)').kph,145_000);
 assert.equal(method(pet(initial,'Heron'),'Tuna/Swordfish').rate,22_976_550);
 // Rocky: the 534,036 XP stall figure is not Ardougne knights; knights follow the Wiki at 84.3 XP a pickpocket.
 const rocky=pet(initial,'Rocky');
 close(method(rocky,'Ardy Knights').rate,(257211-25*99)*84.3,1e-3);
 assert.equal(method(rocky,'Ardy Knights').kph,null);
 assert.equal(method(rocky,'Relekka stalls').kph,30_065);
});

test('hiscores fill attempts and master clue counts',()=>{
 assert.ok(HISCORES_COUNT_UNITS.includes('attempts')&&HISCORES_COUNT_UNITS.includes('master clues'));
 const j=structuredClone(initial);j.hiscores.activities=[{name:'Clue Scrolls (master)',score:420,rank:1},{name:'Artio',score:77,rank:1}];
 const hound=pet(j,'Bloodhound'),cub=pet(j,'Callisto cub');
 assert.deepEqual(hiscoresCount(hound,j,hound.methods[0]),{value:420,label:'Clue Scrolls (master) master clues'});
 assert.equal(hiscoresCount(cub,j,method(cub,'Callisto cub (Artio)'))?.value,77);
 // The big Wilderness bosses no longer use their small variants' paces.
 assert.deepEqual(['Callisto cub','Venenatis spiderling',"Vet'ion jr."].map(n=>pet(initial,n).methods[0].kph),[25,26,37]);
});

test('version 5 reaches saved journals without overwriting what the player set',()=>{
 const v4=structuredClone(catalogue) as unknown as Journal;
 v4.calculationVersion=4;
 const get=(name:string)=>v4.pets.find(p=>p.name===name)!,find=(p:Pet,name:string)=>p.methods.find(m=>m.name===name)!;
 // Smol: one player kept the old 1/100 on purpose; Lil' Zik normal has a measured pace; Callisto's pace is theirs.
 const sol=find(get('Smol Heredit'),'Sol Heredit');sol.rateOverride=true;
 const zik=find(get("Lil' Zik"),'Theatre of Blood');Object.assign(zik,{rate:650,kph:4,paceConfirmed:true});
 const callisto=find(get('Callisto cub'),'Callisto');callisto.paceConfirmed=true;
 const venenatis=find(get('Venenatis spiderling'),'Venenatis');
 // Tumeken's guardian as version 4 saved it: one planning rate kept, one typed by the player.
 const toaRows:Method[]=[{name:'Tombs of Amascut',rate:371,kph:2.5,unit:'raids',activity:'Tombs of Amascut',kc:120,source:'Planning rate',rateConfirmed:false,paceConfirmed:false},{name:'Tombs of Amascut: Expert Mode',rate:250,kph:3,unit:'raids',activity:'Tombs of Amascut: Expert Mode',kc:40,source:'mine',rateOverride:true,rateConfirmed:false,paceConfirmed:true}];
 get("Tumeken's guardian").methods=toaRows;
 // A Beaver row the player counted stays where it was.
 const camphor=find(get('Beaver'),'Camphor');camphor.kc=5_000_000;
 const upgraded=upgradeEstimates(v4);
 assert.equal(upgraded.calculationVersion,CALCULATION_VERSION);
 assert.equal(CALCULATION_VERSION,6);
 const after=(name:string,m:string)=>upgraded.pets.find(p=>p.name===name)!.methods.find(x=>x.name===m)!;
 assert.deepEqual([after('Smol Heredit','Sol Heredit').rate,after('Smol Heredit','Sol Heredit').kph],[100,2.7]);
 assert.ok(after('Smol Heredit','Colosseum · sacrifice quiver'),'the new method is added');
 assert.deepEqual([after("Lil' Zik",'Theatre of Blood').kph,after("Lil' Zik","Lil' zik (Hard Mode)").rate,after("Lil' Zik","Lil' zik (Hard Mode)").kph],[4,500,2.8]);
 assert.deepEqual([after('Callisto cub','Callisto').kph,venenatis.kph],[65,26]);
 const [normal,expert]=upgraded.pets.find(p=>p.name==="Tumeken's guardian")!.methods;
 assert.deepEqual([normal.rate,normal.kc,normal.raid,normal.rateConfirmed],[1225,120,{kind:'toa',points:20_000,level:150},true]);
 assert.deepEqual([expert.rate,expert.kph,expert.kc,expert.raid],[250,3,40,undefined]);
 // Its rate still follows the Wiki (143.5 XP a camphor log); its pace is left as the player had it.
 close(after('Beaver','Camphor').rate,(145013-25*99)*143.5);assert.deepEqual([after('Beaver','Camphor').kph,after('Beaver','Camphor').kc],[200_000,5_000_000]);
 assert.equal(after('Beaver','Teak (1.5t)').kph,200_000);
 assert.equal(upgraded.pets.find(p=>p.name==='Jal-Nib-Rek')!.methods.some(m=>m.name==='Jal-nib-rek (Offtask)'),false);
 // Once is enough: a second load changes nothing.
 const again=upgradeEstimates(structuredClone(upgraded));
 assert.deepEqual(again.pets.map(p=>p.methods.length),upgraded.pets.map(p=>p.methods.length));
 assert.deepEqual(again.pets.find(p=>p.name==='Beaver')!.methods,upgraded.pets.find(p=>p.name==='Beaver')!.methods);
});
