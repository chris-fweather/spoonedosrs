import {acquisitionEffort,migrateHuntHistory,receivedMethod} from './hunt-history';
import {atLevel, wikiMethod} from './skill-rates';
import {FARMING_RUNS,LEGACY_MIXED_RUN,TREE_RUNS,defaultFarmingRun,isTreeRun,presetTreeRunRate,refreshFarmingRun,refreshTreeRun,treeRunsMethod} from './farming-runs';
import {lapUpgrade} from './agility-laps';
import {treeRow,upgradeTreeMethods} from './tangleroot-trees';
import {COX_POINTS_PER_PERCENT,RAID_DEFAULTS,TOB_HARD,TOB_NORMAL,coxRaidsPerPet,domRunsPerPet,nightmareKillsPerPet,refreshRaidRate,toaRaidsPerPet,type RaidInputs} from './raid-rates';
import type {Journal,Method,Pet} from './model';
import original from './catalogue.json' with {type: 'json'};
import audited from './audited-rates.json' with {type: 'json'};
export const petSkill:Record<string,string>={'Rocky':'Thieving','Giant Squirrel':'Agility','Heron':'Fishing','Baby chinchompa':'Hunter','Herbi':'Hunter','Quetzin':'Hunter','Rock golem':'Mining','Rift guardian':'Runecraft','Beaver':'Woodcutting','Tangleroot':'Farming','Soup':'Sailing'};
/** Units a hiscores activity score counts directly, so sync can fill the method's count. */
export const HISCORES_COUNT_UNITS=['kills','games','raids','runs','completions','subdues','attempts','master clues'];
export const PHOENIX_200M_METHOD='200 million Firemaking';
/** OSRS Wiki (Pet): every skilling pet is fifteen times more likely with 200 million XP in its skill, and the Wiki says
 * the same boost applies to the Phoenix (Firemaking), Quetzin and Mr McGroot (Hunter). Herbi is not on that list. */
export const BOOST_SKILL:Readonly<Record<string,string>>={...Object.fromEntries(Object.entries(petSkill).filter(([name])=>name!=='Herbi')),Phoenix:'Firemaking','Mr McGroot':'Hunter'};
export const XP_200M=200_000_000,BOOST_200M=15;
const boostSkill=(p:Pet)=>BOOST_SKILL[p.name];
/** A method the player can use now: a 200M-only method (`xp200m`) needs 200 million XP in the pet's skill. Without
 * hiscores it is left out. */
export function methodEligible(p:Pet,m:Method,j?:Journal):boolean {
 if(!m.xp200m)return true;
 const xp=j?.hiscores.skills.find(s=>s.name===boostSkill(p))?.xp;
 return xp!=null&&xp>=XP_200M;
}
/** The name of a method's 200 million XP version, from which its base method is found again on load. */
export const boostedName=(skill:string,base:string)=>`200M ${skill}: ${base}`;
/** A method's 200 million XP version: the same unit and pace, the rate divided by 15, and counted only once the synced
 * hiscores show 200 million XP in the pet's skill (`xp200m`). Phoenix keeps its own "200 million Firemaking". */
export function boostedMethod(p:Pet,base:Method):Method|null {
 const skill=BOOST_SKILL[p.name];
 if(!skill||!base.rate||base.xp200m)return null;
 return {name:boostedName(skill,base.name),rate:base.rate/BOOST_200M,kph:base.kph,unit:base.unit,activity:null,kc:null,xp200m:true,rateConfirmed:!!base.rateConfirmed,paceConfirmed:false,
  source:`OSRS Wiki: with 200 million ${skill} XP the pet is 15 times more likely, so this is ${base.name}'s rate divided by 15. It only counts once your synced hiscores show 200 million ${skill} XP; enter what you did after reaching it.${base.unit==='XP'?' XP stops at 200 million, so enter the XP it would have given (actions × XP each), or your hours.':''} https://oldschool.runescape.wiki/w/Pet#Skilling_pets`};
}
/** Tangleroot rows whose sheet pace cannot be kept up because the game has only a few patches for them. */
function fewPatches(p:Pet,m:Method){
 if(p.name!=='Tangleroot'||m.paceConfirmed)return false;
 const row=treeRow(m.name);
 return !!row?.fewPatches&&row.unit===m.unit;
}
/** A method that sets a pet's expected hours: one the player can use now (`methodEligible`), and not a Tangleroot tree
 * with only a few patches at the sheet's example pace (docs/calculations.md, "Expected hours"). A pace the player set
 * on such a tree counts. */
export function countsForExpectedHours(p:Pet,m:Method,j?:Journal):boolean {
 return methodEligible(p,m,j)&&!fewPatches(p,m);
}
/** The method that sets a pet's expected hours at level 99 without 200M XP: its fastest counted method. */
function headlineMethod(p:Pet):Method|undefined {
 return p.methods.filter(m=>m.rate&&m.kph&&!m.xp200m&&!fewPatches(p,m)).sort((a,b)=>a.rate!/a.kph!-b.rate!/b.kph!)[0];
}

const PHOENIX_ROLLS='OSRS Wiki: 1/5,000 per reward roll. 500 points gives 2 rolls; every further 500 points adds one roll; points between those thresholds are a linear extra-roll chance. Supply crates became reward-cart searches on 9 October 2024, with the same per-roll rate. Hiscores Wintertodt score is subdues, not rolls.';

/** Entered crate rolls win. Subdues are only the fallback, and they are never turned into rolls. */
export function phoenixShownCount(rolls: number | null | undefined, subdues: number | null | undefined): {value: number; unit: 'rolls' | 'subdues'} | null {
  if (rolls != null) return {value: rolls, unit: 'rolls'};
  if (subdues != null) return {value: subdues, unit: 'subdues'};
  return null;
}

export function phoenixRollChance(rolls: number | null | undefined, rate: number | null | undefined): number | null {
  if (rolls == null || rate == null || rate < 1) return null;
  return -Math.expm1(rolls * Math.log1p(-1 / rate));
}
const PHOENIX_200M='OSRS Wiki: at 200 million Firemaking XP the phoenix is 15 times more common, so the roll rate is 1/5,000 divided by 15.';
const OLMLET='OSRS Wiki: 1/53 when a unique is received. Unique chance is 1% per 8,676 team points, capped at 65.7% at 570,000 points; further points roll another unique. A 26,025-point raid is about 1/1,765 from that formula, not this account\'s rate. Hiscores raid count is not a unique count.';

function wikiDrop(name:string,rate:number,unit:string,source:string):Method{
 return {name,rate,kph:null,unit,activity:null,kc:null,source,rateConfirmed:true,paceConfirmed:false};
}
function blankRates(p:Pet){return p.methods.every(m=>m.rate==null&&!m.rateOverride);}
function stampWikiPets(j:Journal){
 for(const p of j.pets){
  if(p.name==='Phoenix'){
   if(blankRates(p)){
    p.methods=[wikiDrop('Wintertodt reward cart',5000,'rolls',PHOENIX_ROLLS),{...wikiDrop(PHOENIX_200M_METHOD,5000/15,'rolls',PHOENIX_200M),xp200m:true}];
    p.plannedMethod=0;
   }
   for(const m of p.methods) if(m.unit==='rolls'&&m.rate!=null&&(m.rate===5000||Math.abs(m.rate-5000/15)<1e-6)) m.rateConfirmed=true;
  }else if(p.name==='Olmlet'){
   if(blankRates(p)){
    p.methods=[wikiDrop('Chambers of Xeric unique',53,'uniques',OLMLET),wikiDrop('Challenge Mode unique',53,'uniques',OLMLET+' Challenge Mode changes how often a unique is rolled, not the 1/53 pet chance.')];
    p.plannedMethod=0;
   }
   for(const m of p.methods) if(m.unit==='uniques'&&m.rate===53) m.rateConfirmed=true;
  }
 }
}
/** Mr McGroot: 1/(40,000 − 25 × Hunter level) per goat (OSRS Wiki). */
export const MCGROOT_BASE=40000;
/** `planning`: a figure to plan with, not the Wiki's drop rate (shown as "Planning rate"); `kph` a default pace.
 * `since`: the calculation version that added the row; rows from version 5 on are also added to journals saved before.
 * `replaces`: earlier catalogue values the row corrects in a saved journal while the player has not set their own.
 * `raid`: default raid inputs (lib/raid-rates.ts); the rate is then worked out from them. */
type Listed={match:string;rate:number;unit:string;activity?:string|null;source:string;planning?:boolean;kph?:number;since?:number;replaces?:{rate?:number[];kph?:number[]};raid?:RaidInputs};
const WIKI='https://oldschool.runescape.wiki/w/';
const TEMPLE='https://templeosrs.com/pets/hours.php';
/** Example paces from TempleOSRS's pet hours sheet (lib/temple-pet-hours.json). */
const temple=(pace:string)=>` Example pace ${pace} (TempleOSRS pet hours); replace with your own. ${TEMPLE}`;
/** Several independent rolls on one run, as one "1 in N runs". */
const combined=(...rates:number[])=>1/(1-rates.reduce((miss,r)=>miss*(1-1/r),1));
const OLMLET_UNIQUES_PER_HOUR=0.1008,OLMLET_CM_UNIQUES_PER_HOUR=0.1314;
const COX_RAID=`OSRS Wiki: a unique is 1% per 8,676 team points and goes to a player weighted by personal points; only the player who gets it rolls 1/53 for the Olmlet. Your chance per raid is your points ÷ 45,982,800, whatever the team size. Hiscores count the raids. ${WIKI}Ancient_chest`;
/** Raids an hour that give TempleOSRS's uniques an hour at these points: uniques/hour ÷ (points ÷ 867,600). */
const coxPace=(uniquesPerHour:number,points:number)=>Math.round(uniquesPerHour*100*COX_POINTS_PER_PERCENT/points*10)/10;
const TOA_RAID=`OSRS Wiki: 1% per 350,000 − 700 × raid level reward points (levels above 400 count a third, up to 550), a roll separate from the purple; the starting 5,000 points do not count. Enter your own points and raid level. ${WIKI}Chest_(Tombs_of_Amascut)`;
const ZUK=`OSRS Wiki: 1/100 per TzKal-Zuk kill off task and 1/75 on a Slayer task; exchanging the infernal cape is its own 1/100 roll, with no task boost. ${WIKI}Jal-Nib-Rek`;
const SOL=`OSRS Wiki: 1/200 per Fortis Colosseum completion; exchanging Dizana's quiver with Minimus is its own 1/200 roll. ${WIKI}Smol_Heredit`;
const MMG=(kph:number,page:string)=>` Example pace ${kph} kills an hour (OSRS Wiki money making guide); replace with your own. ${WIKI}Money_making_guide/${page}`;
const YAMI_CONTRACT='Yami (Contract)',DOM_RUNS='Delve runs';
/** OSRS Wiki (Chest (The Fractured Archive)) and the 3 November 2026 update: Orion is a flat 1/750 a completion. */
export const ORION=750;
const listed:Record<string,Listed[]>={
 'Jal-Nib-Rek':[
  {match:'TzKal-Zuk',rate:100,unit:'kills',kph:1,source:`${ZUK} This method: off task, keeping the cape.${temple('1 Inferno an hour')}`},
  {match:'Inferno · on task, keep cape',rate:75,unit:'runs',kph:1,since:5,source:`${ZUK} This method: on task, keeping the cape. Include task time in your pace.${temple('1 Inferno an hour')}`},
  {match:'Inferno · off task, sacrifice cape',rate:combined(100,100),unit:'runs',kph:1,since:5,source:`${ZUK} This method: off task, then the cape exchange (1/100 and 1/100, about 1/50.25 a run). Hiscores KC is not copied into it.${temple('1 Inferno an hour')}`},
  {match:'Inferno · on task, sacrifice cape',rate:combined(75,100),unit:'runs',kph:1,since:5,source:`${ZUK} This method: on task, then the cape exchange (1/75 and 1/100, about 1/43.1 a run). Hiscores KC is not copied into it.${temple('1 Inferno an hour')}`},
 ],
 "Lil' Zik":[
  {match:'Theatre of Blood',rate:TOB_NORMAL,unit:'raids',activity:'Theatre of Blood',kph:3.2,source:`OSRS Wiki: a personal 1/650 roll on every Normal Mode completion at full performance (worse with many deaths, down to 1/6,500), whatever your team gets; no purple needed. Entry Mode cannot give the pet. ${WIKI}Lil%27_Zik${temple('3.2 raids an hour')}`},
  {match:"Lil' zik (Hard Mode)",rate:TOB_HARD,unit:'raids',activity:'Theatre of Blood: Hard Mode',kph:2.8,source:`OSRS Wiki: a personal 1/500 roll on every Hard Mode completion at full performance (down to 1/5,000), whatever your team gets; no purple needed. ${WIKI}Lil%27_Zik${temple('2.8 raids an hour')}`},
 ],
 Olmlet:[
  {match:'Chambers of Xeric unique',rate:53,unit:'uniques',kph:OLMLET_UNIQUES_PER_HOUR,source:OLMLET+temple(`${OLMLET_UNIQUES_PER_HOUR} uniques an hour`)},
  {match:'Challenge Mode unique',rate:53,unit:'uniques',kph:OLMLET_CM_UNIQUES_PER_HOUR,source:OLMLET+' Challenge Mode changes how often a unique is rolled, not the 1/53 pet chance.'+temple(`${OLMLET_CM_UNIQUES_PER_HOUR} uniques an hour`)},
  {match:'Chambers of Xeric raids',rate:coxRaidsPerPet(RAID_DEFAULTS.cox.points)!,unit:'raids',activity:'Chambers of Xeric',raid:{kind:'cox',...RAID_DEFAULTS.cox},kph:coxPace(OLMLET_UNIQUES_PER_HOUR,RAID_DEFAULTS.cox.points),since:5,source:`${COX_RAID} Example ${RAID_DEFAULTS.cox.points.toLocaleString('en-US')} points a raid at ${coxPace(OLMLET_UNIQUES_PER_HOUR,RAID_DEFAULTS.cox.points)} raids an hour, which is TempleOSRS's ${OLMLET_UNIQUES_PER_HOUR} uniques an hour; replace both with your own. ${TEMPLE}`},
  {match:'Challenge Mode raids',rate:coxRaidsPerPet(RAID_DEFAULTS.coxChallenge.points)!,unit:'raids',activity:'Chambers of Xeric: Challenge Mode',raid:{kind:'cox',...RAID_DEFAULTS.coxChallenge},kph:coxPace(OLMLET_CM_UNIQUES_PER_HOUR,RAID_DEFAULTS.coxChallenge.points),since:5,source:`${COX_RAID} Challenge Mode uses the same formula with more points a raid. Example ${RAID_DEFAULTS.coxChallenge.points.toLocaleString('en-US')} points a raid at ${coxPace(OLMLET_CM_UNIQUES_PER_HOUR,RAID_DEFAULTS.coxChallenge.points)} raids an hour, which is TempleOSRS's ${OLMLET_CM_UNIQUES_PER_HOUR} uniques an hour; replace both with your own. ${TEMPLE}`},
 ],
 'Tiny tempor':[{match:'Tempoross',rate:8000,unit:'rolls',source:`OSRS Wiki: 1/8,000 from the reward pool. ${WIKI}Tiny_tempor`}],
 'Abyssal protector':[{match:'Abyssal protector',rate:4000,unit:'rewards',kph:39,source:`OSRS Wiki: 1/4,000 per Rewards Guardian search. ${WIKI}Abyssal_protector${temple('39 searches an hour')}`}],
 Yami:[
  {match:'Yama',rate:2500,unit:'kills',kph:20,source:`OSRS Wiki: 1/2,500 from Yama. ${WIKI}Yami${temple('20 kills an hour')}`},
  {match:YAMI_CONTRACT,rate:100,unit:'contracts',kph:15,source:`OSRS Wiki: 1/100 from a Yama fight under the Contract of Familiar Acquisition (a duo partner shares the contract's rate; an ironman needs their own). Count contract fights: the hiscores have no contract count, and Yama's kill count is not copied into it. ${WIKI}Yama#Contracts${temple('15 contracts an hour')}`},
 ],
 'Little Nightmare':[
  {match:'The Nightmare',rate:nightmareKillsPerPet(RAID_DEFAULTS.nightmare.team)!,unit:'kills',activity:'Nightmare',kph:3.75,raid:{kind:'nightmare',...RAID_DEFAULTS.nightmare},source:`OSRS Wiki: 1/800 for a solo kill, 1/1,600 in a duo, 1/2,400 in a trio, 1/3,200 for four and 1/4,000 for five or more, counting the players in the room when the fight started. Enter your team size. ${WIKI}Little_Nightmare${temple('3.75 solo kills an hour')}`},
  {match:"Phosani's Nightmare",rate:1400,unit:'kills',activity:"Phosani's Nightmare",kph:10,source:`OSRS Wiki: 1/1,400 from Phosani's Nightmare. ${WIKI}Little_Nightmare${temple('10 kills an hour')}`},
 ],
 // Before raid inputs these were planning figures: TempleOSRS's pet hours sheet (1/371 at 2.5 raids an hour) and
 // PetCord's driest-record rarity for solo 400s (1/321). They now follow the Wiki formula unless the player set a rate.
 "Tumeken's guardian":[
  {match:'Tombs of Amascut',rate:toaRaidsPerPet(RAID_DEFAULTS.toa.points,RAID_DEFAULTS.toa.level)!,unit:'raids',activity:'Tombs of Amascut',kph:2.5,raid:{kind:'toa',...RAID_DEFAULTS.toa},source:`${TOA_RAID} Normal mode (raid level 150 to 295). Example ${RAID_DEFAULTS.toa.points.toLocaleString('en-US')} points at raid level ${RAID_DEFAULTS.toa.level}.${temple('2.5 raids an hour')}`},
  {match:'Tombs of Amascut: Expert Mode',rate:toaRaidsPerPet(RAID_DEFAULTS.toaExpert.points,RAID_DEFAULTS.toaExpert.level)!,unit:'raids',activity:'Tombs of Amascut: Expert Mode',kph:2.5,raid:{kind:'toa',...RAID_DEFAULTS.toaExpert},source:`${TOA_RAID} Expert mode (raid level 300 and up). Example ${RAID_DEFAULTS.toaExpert.points.toLocaleString('en-US')} points at raid level ${RAID_DEFAULTS.toaExpert.level}; PetCord's 1/321 for solo 400s is about 21,800 points.${temple('2.5 raids an hour')}`},
 ],
 'Smol Heredit':[
  {match:'Sol Heredit',rate:200,unit:'kills',activity:'Sol Heredit',kph:2.7,replaces:{rate:[100]},source:`${SOL} This method: keeping the quiver.${temple('2.7 completions an hour')}`},
  {match:'Colosseum · sacrifice quiver',rate:combined(200,200),unit:'runs',kph:2.7,since:5,source:`${SOL} This method: the completion, then the quiver exchange (two 1/200 rolls, about 1/100.25 a run). Hiscores KC is not copied into it.${temple('2.7 completions an hour')}`},
 ],
 Dom:[
  {match:'Doom of Mokhaiotl',rate:1000,unit:'kills',activity:'Doom of Mokhaiotl',source:`OSRS Wiki: only delve level 6 and deeper can give Dom: 1/1,000 at delve 6, 1/750 at 7, 1/500 at 8 and 1/250 at 9 and beyond. This method uses the delve 6 rate. ${WIKI}Dom`},
  {match:'Delve 9 and deeper',rate:250,unit:'delves',kph:32,since:5,source:`OSRS Wiki: 1/250 for each completed delve at level 9 or deeper. ${WIKI}Doom_of_Mokhaiotl${temple('32 deep delves an hour')}`},
  {match:DOM_RUNS,rate:domRunsPerPet(RAID_DEFAULTS.dom.delve)!,unit:'runs',kph:6,raid:{kind:'dom',...RAID_DEFAULTS.dom},since:6,source:`OSRS Wiki: only delves 6 and deeper can give Dom, each completed delve its own roll: 1/1,000 at 6, 1/750 at 7, 1/500 at 8 and 1/250 at 9 and every delve after. A run from delve 1 to 8 is about 1/231. Enter the deepest delve you finish each run; the hiscores count is not copied into it. ${WIKI}Doom_of_Mokhaiotl Example pace 6 runs to delve 8 an hour (OSRS Wiki money making guide); replace with your own. ${WIKI}Money_making_guide/Killing_the_Doom_of_Mokhaiotl_(Delve_1-8)`},
 ],
 // The awakened fights roll the same pet chance after the drop table; only their unique table is three times as likely.
 ...Object.fromEntries(([['Baron','Duke Sucellus',2500],['Butch','Vardorvis',3000],["Lil'viathan",'The Leviathan',2500],['Wisp','The Whisperer',2000]] as const).map(([pet,boss,rate])=>[pet,[
  {match:`Awakened ${boss}`,rate,unit:'kills',since:6,source:`OSRS Wiki: an awakened kill rolls the same 1/${rate.toLocaleString('en-US')} for ${pet} as a normal kill, after the drop table; only the unique table is three times as likely. Count your awakened kills here; the hiscores kill count is not copied into it. ${WIKI}${boss.replaceAll(' ','_')}#Mechanics`},
 ]])),
 Orion:[
  {match:'The Fractured Archive',rate:ORION,unit:'raids',activity:'The Fractured Archive',kph:3,since:6,source:`OSRS Wiki: a flat 1/750 on every completion, whatever your points, team size or deaths, as long as your chest is not a cabbage (a cabbage rolls no pet). The count fills from the hiscores once they list the raid. ${WIKI}Chest_(The_Fractured_Archive) Example pace 3 completions an hour (OSRS Wiki money making guide, trio); replace with your own. ${WIKI}Money_making_guide/The_Fractured_Archive_(Trio)`},
 ],
 'Maggot marquess':[
  {match:'Maggot King',rate:3500,unit:'kills',activity:'Maggot King',kph:25,source:`OSRS Wiki: 1/3,500 when opening the stomach. ${WIKI}Maggot_marquess${MMG(25,'Killing_the_Maggot_King')}`},
  {match:'Maggot King · take eggs',rate:1/(300/1500/3000+150/1500/2500+33/1500/1250+6/1500/500+3/1500/10+1/1500/2),unit:'kills',kph:25,since:5,source:`OSRS Wiki: taking the eggs instead of opening the stomach averages about 1/1,502 a kill over the six eggs' own pet rates, and gives up the other loot. Hiscores KC is not copied into it. ${WIKI}Maggot_marquess${MMG(25,'Killing_the_Maggot_King')}`},
 ],
 'Mr McGroot':[{match:'Goat hunting',rate:MCGROOT_BASE-25*99,unit:'catches',kph:900,replaces:{rate:[MCGROOT_BASE]},source:`OSRS Wiki: 1/(40,000 − 25 × Hunter level) per goat, 1/37,525 at 99; the rate follows your Hunter level (99 until hiscores sync). ${WIKI}Mr_McGroot Example pace 900 goats an hour with Telekinetic Grab (OSRS Wiki); replace with your own. ${WIKI}Goat_hunting`}],
 Bloodhound:[{match:'Clue Scrolls (master)',rate:1000,unit:'master clues',activity:'Clue Scrolls (master)',kph:10,source:`OSRS Wiki: 1/1,000 per master clue casket. Hiscores count the master clues. ${WIKI}Bloodhound${temple('10 master clues an hour')}`}],
 'Callisto cub':[{match:'Callisto',rate:1500,unit:'kills',activity:'Callisto',kph:25,replaces:{rate:[2000],kph:[65]},source:`OSRS Wiki: 1/1,500 from Callisto (Artio is 1/2,800). ${WIKI}Callisto_cub${MMG(25,'Killing_Callisto')}`}],
 'Venenatis spiderling':[{match:'Venenatis',rate:1500,unit:'kills',activity:'Venenatis',kph:26,replaces:{rate:[2000],kph:[55]},source:`OSRS Wiki: 1/1,500 from Venenatis (Spindel is 1/2,800). ${WIKI}Venenatis_spiderling${MMG(26,'Killing_Venenatis')}`}],
 "Vet'ion jr.":[{match:"Vet'ion",rate:1500,unit:'kills',activity:"Vet'ion",kph:37,replaces:{rate:[2000],kph:[55]},source:`OSRS Wiki: 1/1,500 from Vet'ion (Calvar'ion is 1/2,800). ${WIKI}Vet%27ion_Jr.${MMG(37,'Killing_Vet%27ion')}`}],
 Soup:[
  ...[
   ['Trimming sails',120000],['Sea charting',30000],['The Tempor Tantrum Swordfish',16000],['The Tempor Tantrum Shark',8000],['The Tempor Tantrum Marlin',5334],
   ['The Jubbly Jive Swordfish',11500],['The Jubbly Jive Shark',5750],['The Jubbly Jive Marlin',3834],['The Gwenith Glide Swordfish',9000],['The Gwenith Glide Shark',4500],['The Gwenith Glide Marlin',3000],
   ['Small shipwreck',800000],["Fisherman's shipwreck",500000],['Barracuda shipwreck',300000],['Large shipwreck',280000],['Pirate shipwreck',275000],['Mercenary shipwreck',260000],['Fremennik shipwreck',230000],['Merchant shipwreck',160000],['Deep sea trawling',360000],['Salvage sorting',800000],
  ].map(([match,rate])=>({match:String(match),rate:Number(rate),unit:'actions',source:`OSRS Wiki drop-rate table for Soup. ${WIKI}Soup`})),
  {match:'Courier tasks (Aldarin–Sunset Coast)',rate:4691,unit:'tasks',kph:90,since:5,source:`OSRS Wiki: port tasks roll 1/(6,000 − 2,850 ÷ 98 × (task level − 1)) when you claim the reward; courier tasks between Aldarin and the Sunset Coast average about 1/4,691, the fastest method. ${WIKI}Soup${temple('90 tasks an hour')}`},
 ],
};
/** A new method's count as a hiscores sync would have filled it, so a method added on load starts at the stored score. */
function syncedCount(j:Journal|undefined,m:Method):Method{
 const a=m.activity&&HISCORES_COUNT_UNITS.includes(m.unit)?j?.hiscores.activities.find(a=>a.name.toLowerCase()===m.activity!.toLowerCase()&&a.score>=0):undefined;
 return a?{...m,kc:a.score}:m;
}
function blankMethod(row:Listed):Method{return {name:row.match,rate:row.rate,kph:row.kph??null,unit:row.unit,activity:row.activity??null,kc:null,source:row.source,rateConfirmed:!row.planning,paceConfirmed:false,...(row.raid?{raid:{...row.raid}}:{})};}
function applyListedRates(p:Pet):Pet{
 const rows=listed[p.name];
 if(rows){
  if(!p.methods.length)p={...p,methods:rows.map(blankMethod)};
  else{
   const methods=p.methods.map(m=>{const row=rows.find(r=>r.match===m.name);if(!row||m.rate!=null||m.rateOverride)return m;return {...m,rate:row.rate,unit:row.unit||m.unit,source:row.source,rateConfirmed:!row.planning,...(m.kph==null&&row.kph?{kph:row.kph}:{}),...(row.raid&&!m.raid?{raid:{...row.raid}}:{})};});
   for(const row of rows)if(!methods.some(m=>m.name===row.match))methods.push(blankMethod(row));
   p={...p,methods};
  }
 }
 if(p.name==='Rift guardian'){
  const selected=p.methods[p.plannedMethod??0];
  if(selected&&selected.rate==null&&selected.kph==null){
   const mind=p.methods.findIndex(m=>m.name==='Mind rune'&&m.kph);
   if(mind>=0)p={...p,plannedMethod:mind};
  }
 }
 return p;
}
const near=(a:number|null|undefined,b:number)=>a!=null&&Math.abs(a-b)<=Math.max(1e-6,b*1e-9);
/** Skilling rows from the PetCord sheet whose rate and pace sit four rows below their name in the catalogue (the
 * first four names of each block lost their figures). Checked against the Wiki at level 99 and TempleOSRS: Beaver
 * Teak 22,258,185 XP at 200,000 XP/hour (111 h), Rock golem gems at 115,050 (118 h), Rift guardian Mind runes with
 * four runners at 145,000 (68 h), Rocky's TzHaar-Hur 103.4 XP each. Names past the end keep no sheet figures. */
const SHEET_SHIFTED=['Beaver','Rock golem','Rift guardian','Rocky'],SHEET_SHIFT=4;
/** Rows that kept a figure from another row: the same fish and XP as its tick-manipulation row. */
const SHEET_FIXED:Record<string,Record<string,{from:number;rate:number}>>={Heron:{'Tuna/Swordfish':{from:11376900,rate:22976550}}};
/** XP per action the Wiki states on the method's own page where the skill-pet snapshot has none, so an XP method's
 * mean XP per pet still follows the level: Knight of Ardougne, 84.3 Thieving XP a pickpocket. */
const XP_EACH:Record<string,Record<string,number>>={Rocky:{'Ardy Knights':84.3}};
function realignSheetRows(p:Pet){
 const catalogue=(original.pets as Pet[]).find(x=>x.id===p.id)?.methods;
 if(!catalogue)return;
 const key=(s?:string|null)=>s?.trim().toLowerCase()??'';
 const used=(m:Method)=>key(p.obtainedMethod)===key(m.name)||!!p.huntHistory?.some(s=>key(s.method)===key(m.name));
 const untouched=(m:Method,old:Method)=>m.unit===old.unit&&m.kc==null&&!m.rateOverride&&!m.paceConfirmed&&m.kph===old.kph&&!used(m);
 if(SHEET_SHIFTED.includes(p.name))for(const m of p.methods){
  const at=catalogue.findIndex(o=>o.name===m.name),old=catalogue[at];
  if(!old||old.unit!=='XP'||!old.source.startsWith('Spreadsheet')||!untouched(m,old))continue;
  const moved=catalogue[at+SHEET_SHIFT];
  m.rate=moved?.unit==='XP'?moved.rate:null;m.kph=moved?.unit==='XP'?moved.kph:null;m.rateConfirmed=false;
  m.source=m.rate==null&&m.kph==null?'PetCord sheet: no level-99 figures for this method. Where the Wiki gives XP per action the rate follows your level; enter your own pace.':'PetCord sheet level-99 estimate (rate and XP/hour realigned with the method name); the Wiki rate replaces it where the Wiki gives XP per action.';
 }
 for(const [name,fix] of Object.entries(SHEET_FIXED[p.name]??{})){
  const m=p.methods.find(x=>x.name===name),old=catalogue.find(o=>o.name===name);
  if(m&&old&&untouched(m,old)&&near(m.rate,fix.from)){m.rate=fix.rate;m.rateConfirmed=false;m.source='PetCord sheet level-99 estimate: the same fish and XP per catch as the tick-manipulation row.';}
 }
}
/** Version 5 (docs/calculations.md): a pace for every pet, raid inputs, and the rate fixes in `listed`. A method the
 * player set keeps its rate (`rateOverride`) and its pace (`paceConfirmed`). */
/** The `listed` rows for one version step: rows added in that version (`since`) join the pet's methods; a method the
 * player has not set gets the row's rate, inputs and pace where it had none or had a value the row `replaces`. */
function upgradeListed(p:Pet,version:number,j?:Journal){
 for(const row of listed[p.name]??[]){
  const m=p.methods.find(x=>x.name===row.match);
  if(!m){if(row.since===version&&p.methods.length<100)p.methods.push(syncedCount(j,blankMethod(row)));continue;}
  let changed=false;
  if(!m.rateOverride&&(m.rate==null||row.replaces?.rate?.some(r=>near(m.rate,r))||(row.raid&&!m.raid))){
   if(m.rate==null){m.unit=row.unit;if(row.activity!==undefined&&m.activity==null)m.activity=row.activity;}
   m.rate=row.rate;m.rateConfirmed=!row.planning;changed=true;
   if(row.raid&&!m.raid)m.raid={...row.raid};
  }
  if(row.kph&&!m.paceConfirmed&&(m.kph==null||row.replaces?.kph?.includes(m.kph))){m.kph=row.kph;changed=true;}
  if(changed&&!m.rateOverride)m.source=row.source;
 }
}
function upgradeToV5(j:Journal){
 for(const p of j.pets){
  upgradeListed(p,5,j);
  // The rate-less "Offtask" spreadsheet row is replaced by the Inferno methods, unless the player used it.
  if(p.name==='Jal-Nib-Rek'){
   const at=p.methods.findIndex(m=>m.name==='Jal-nib-rek (Offtask)'&&m.rate==null&&m.kc==null&&!m.rateOverride&&!m.paceConfirmed&&m.name!==p.obtainedMethod);
   if(at>=0&&p.methods.length>1){const planned=p.plannedMethod??0;p.methods.splice(at,1);p.plannedMethod=planned===at?0:planned>at?planned-1:planned;}
  }
  // Raid counts come from the hiscores, so an untouched unique method stops being the default.
  if(p.name==='Olmlet'&&!p.obtained){
   const selected=p.methods[p.plannedMethod??0],raids=p.methods.findIndex(m=>m.name==='Chambers of Xeric raids');
   if(raids>=0&&selected?.unit==='uniques'&&selected.kc==null&&!selected.rateOverride&&!selected.paceConfirmed)p.plannedMethod=raids;
  }
  // Soup's default had no pace; courier tasks are the Wiki's fastest method.
  if(p.name==='Soup'&&!p.obtained){
   const selected=p.methods[p.plannedMethod??0],courier=p.methods.findIndex(m=>m.name==='Courier tasks (Aldarin–Sunset Coast)');
   if(courier>=0&&(!selected||(selected.kc==null&&selected.kph==null&&!selected.rateOverride&&!selected.paceConfirmed)))p.plannedMethod=courier;
  }
  realignSheetRows(p);
 }
}
const CHOMPY_DIARY=' The pet needs the elite Western Provinces Diary completed and its reward claimed. https://oldschool.runescape.wiki/w/Chompy_chick';
/** Version 6 (docs/calculations.md): Orion, the 200 million XP methods, Nightmare team size and Dom delve runs as
 * method inputs, awakened DT2 kills, Yami contracts counted in contracts. A method the player set keeps its rate
 * (`rateOverride`) and its pace (`paceConfirmed`); counts are never moved or cleared. */
function upgradeToV6(j:Journal){
 // Pets the catalogue gained (Orion) join the journal next to the pet before them in the catalogue.
 const catalogue=original.pets as Pet[];
 catalogue.forEach((c,i)=>{
  if(j.pets.some(p=>p.id===c.id))return;
  const after=catalogue.slice(0,i).reverse().map(x=>j.pets.findIndex(p=>p.id===x.id)).find(at=>at>=0)??j.pets.length-1;
  j.pets.splice(after+1,0,applyListedRates(structuredClone(c)));
 });
 for(const p of j.pets){
  upgradeListed(p,6,j);
  if(p.name==='Yami'){
   const contract=p.methods.find(m=>m.name===YAMI_CONTRACT&&['kills','attempts'].includes(m.unit)&&m.activity==null);
   if(contract){
    contract.unit='contracts';
    if(!contract.rateOverride)contract.source=listed.Yami.find(r=>r.match===YAMI_CONTRACT)!.source;
    if(p.obtainedMethod===YAMI_CONTRACT&&['kills','attempts'].includes(p.obtainedUnit??''))p.obtainedUnit='contracts';
   }
  }
  // Delve runs become the default over an untouched kill method with no pace.
  if(p.name==='Dom'&&!p.obtained){
   const selected=p.methods[p.plannedMethod??0],runs=p.methods.findIndex(m=>m.name===DOM_RUNS);
   if(runs>=0&&selected&&selected.kph==null&&selected.kc==null&&!selected.rateOverride&&!selected.paceConfirmed)p.plannedMethod=runs;
  }
  if(p.name==='Chompy chick')for(const m of p.methods)if(m.name==='Chompy'&&!m.rateOverride&&!m.source.includes('Western Provinces'))m.source+=CHOMPY_DIARY;
 }
}
/** One 200 million XP method for each pet with the boost, made from the method that sets its expected hours. Run on
 * rates already brought up to date, so the base is the method the pet window shows as fastest. */
function addBoostedMethods(j:Journal){
 for(const p of j.pets){
  if(!BOOST_SKILL[p.name]||p.methods.some(m=>m.xp200m||m.name===PHOENIX_200M_METHOD)||p.methods.length>=100)continue;
  const base=headlineMethod(p),boosted=base&&boostedMethod(p,base);
  if(boosted)p.methods.push(boosted);
 }
}
/** The calculation version a journal is upgraded to on load. Each step runs once and keeps the player's own rates
 * (`rateOverride`) and paces (`paceConfirmed`). */
export const CALCULATION_VERSION=6;
export function upgradeEstimates(j:Journal):Journal{
 if((j.calculationVersion??0)<4)upgradeToV4(j);
 if((j.calculationVersion??0)<5){upgradeToV5(j);j.calculationVersion=5;}
 if((j.calculationVersion??0)<6){upgradeToV6(j);normalizeRates(j);addBoostedMethods(j);j.calculationVersion=6;}
 return normalizeRates(j);
}
function upgradeToV4(j:Journal){
 if((j.calculationVersion??0)<2){
  const defaults=original.pets as Pet[];
  j.pets=j.pets.map(p=>{
   const old=defaults.find(x=>x.id===p.id);
   p={...p,plannedMethod:0,methods:p.methods.map(m=>{const om=old?.methods.find(o=>o.name===m.name);const custom=!om||(m.rate!==om.rate||m.kph!==om.kph);const a=(audited as Record<string,{rate:number;url:string;date:string}>)[p.id+'|'+m.name];return {...m,...(!custom&&a?{rate:a.rate,source:`OSRS Wiki rate checked ${a.date}; old spreadsheet pace needs review.`}:{}),rateConfirmed:custom||!!a,paceConfirmed:custom};})};
   const method=(name:string,rate:number,kph:number,unit:string,activity:string|null,source:string):Method=>({name,rate,kph,unit,activity,kc:null,source,rateConfirmed:true,paceConfirmed:true});
   if(p.name==='TzRek-Jad'&&!p.methods.some(m=>m.paceConfirmed)){
    const kc=p.methods.find(m=>m.activity==='TzTok-Jad')?.kc??null;
    const historical=p.methods.filter(m=>m.activity!=='TzTok-Jad'&&m.kc!==null);
    p.methods=[{...method('Fight Caves · off task, keep cape',200,j.username.toLowerCase()==='obifloat'?2:60/45,'runs','TzTok-Jad','OSRS Wiki: 1/200 per off-task completion. Pace: '+(j.username.toLowerCase()==='obifloat'?'your stated 30':'example 45')+' minutes per successful full run.'),kc},method('Fight Caves · off task, sacrifice cape',1/(1-(199/200)**2),j.username.toLowerCase()==='obifloat'?2:60/45,'runs',null,'OSRS Wiki: completion 1/200 plus independent cape exchange 1/200. Historical KC is not copied into this mode.'),method('Fight Caves · on task, sacrifice cape',1/(1-(99/100)*(199/200)),j.username.toLowerCase()==='obifloat'?2:60/45,'runs',null,'OSRS Wiki: on-task completion 1/100 plus cape exchange 1/200. Task acquisition time must be included in your pace.')];
    p.methods.push(...historical);
   }
   if(p.name==="Lil' Creator"&&!p.methods.some(m=>m.paceConfirmed))p.methods=[method(SPOILS_OF_WAR,400,150/ZEAL_PER_CRATE,'crates',null,'OSRS Wiki: one 1/400 pet roll per Spoils of war; each costs 30 Zeal. Pace 150 Zeal an hour (about three games at up to 50 Zeal) = 5 crates an hour; enter your own Zeal per hour.'),...p.methods.filter(m=>m.kc!==null)];
   if(p.name==='Rocky'){
    const level=j.hiscores.skills.find(s=>s.name==='Thieving')?.level||99;
    p.methods=[method('Ardougne knights',257211-25*level,2000,'pickpockets',null,`OSRS Wiki: 1 / (257,211 − 25 × level). Level ${level}; example 2,000 successful pickpockets/hour. One roll per successful pickpocket.`),method('Seed stall',36490-25*level,1200,'thefts',null,`OSRS Wiki: 1 / (36,490 − 25 × level). Level ${level}; example 1,200 successful thefts/hour. Setup and guards affect pace.`),...p.methods.map(m=>({...m,rateConfirmed:false,paceConfirmed:false}))];
   }
   return p;
  });
 }
 stampWikiPets(j);
 j.pets=j.pets.map(applyListedRates);
 for(const p of j.pets) if(p.name==='Phoenix') for(const m of p.methods) {
  if(m.unit==='rolls' && m.kph==null && m.source.startsWith('OSRS Wiki:')) {
   m.kph=50;m.paceConfirmed=false;
   m.source+=' Planning pace: Temple/Petcord reference 50 reward rolls/hour; replace with your measured rolls/hour. https://templeosrs.com/pets/hours.php';
  }
 }
 // The Wiki's Nex denominator is a base roll before contribution, not a personal kill rate.
 for(const p of j.pets) if(p.name==='Nexling') for(const m of p.methods) {
  if(m.name==='Nex' && m.rate===500 && /spreadsheet pace|OSRS Wiki rate checked/.test(m.source)) {
   m.rate=4100;m.rateConfirmed=false;
   m.source='Temple/Petcord planning benchmark: 1/4,100 at 23.5 kills/hour (about 174 h). Nex has a base 1/500 roll adjusted by contribution and MVP. This is not a verified personal rate. https://oldschool.runescape.wiki/w/Nex';
  }
 }
 j.calculationVersion=4;
}
export function selectedMethod(p:Pet){return p.methods[p.plannedMethod??0];}
export function lifetimeSkill(p:Pet,j:Journal){return j.hiscores.skills.find(s=>s.name===petSkill[p.name]);}
/** One live activity count cannot be assigned to several alternative methods at once. */
export function countedMethods(p:Pet):Method[]{
 const planned=selectedMethod(p),seen=new Set<string>();
 return [planned,...p.methods.filter(m=>m!==planned)].filter((m):m is Method=>{
  if(!m||m.kc==null)return false;
  if(m.activity){const key=m.activity.toLowerCase();if(seen.has(key))return false;seen.add(key);}
  return true;
 });
}
export function effortTime(p:Pet,_j?:Journal):number|null{
 // Hours already spent, when entered, are the time spent; otherwise count ÷ pace.
 if(p.obtained||p.recordedHours!=null)return acquisitionEffort(p).hours;
 // Lifetime skill XP includes lamps, quests and unrelated methods. Never treat it as hunt time.
 const counted=countedMethods(p);
 if(!counted.length||counted.some(m=>!m.kph))return null;
 return counted.reduce((s,m)=>s+m.kc!/m.kph!,0);
}
export function totalEffort(j:Journal){return j.pets.reduce((hours,p)=>hours+(effortTime(p,j)??0),0);}

/** Tangleroot's default is one standard tree run (6 magic + 6 palm) counted in Farming XP, named Tree runs.
 * - The old XP preset ("Farming runs", later "Tree runs: 6 magic + 6 palm (XP)") is that run: it is renamed with its
 *   acquisition record and hunt history, and an unedited preset rate follows the level again.
 * - The briefly default "Farming runs" counted in runs is dropped while untouched; anything a player used stays.
 * - Tree runs is added once and becomes the selected method over an untouched catalogue or dropped method. */
function upgradeFarming(p:Pet,level:number|undefined){
 const key=(s?:string|null)=>s?.trim().toLowerCase()??'';
 const has=(name:string)=>p.methods.some(m=>key(m.name)===key(name));
 const used=(m:Method)=>key(p.obtainedMethod)===key(m.name)||!!p.huntHistory?.some(s=>key(s.method)===key(m.name));
 const legacy=p.methods.find(m=>isTreeRun(m)&&[FARMING_RUNS,LEGACY_MIXED_RUN].map(key).includes(key(m.name)));
 if(legacy&&!has(TREE_RUNS)){
  const old=key(legacy.name);
  legacy.name=TREE_RUNS;
  if(legacy.rateOverride&&presetTreeRunRate(legacy.rate)){legacy.rateOverride=false;legacy.rateConfirmed=true;}
  if(key(p.obtainedMethod)===old)p.obtainedMethod=TREE_RUNS;
  if(p.huntHistory)p.huntHistory=p.huntHistory.map(s=>key(s.method)===old&&s.unit==='XP'?{...s,method:TREE_RUNS}:s);
 }
 let planned=p.plannedMethod??0,reselect=false;
 const runs=p.methods.findIndex(m=>m.unit==='runs'&&!!m.farmingRun&&key(m.name)===key(FARMING_RUNS));
 if(runs>=0){
  const m=p.methods[runs],trees=JSON.stringify(m.farmingRun);
  const untouched=m.kc==null&&!m.rateOverride&&!m.paceConfirmed&&m.farmingRunsPerDay==null&&!used(m)&&Array.from({length:99},(_,i)=>JSON.stringify(defaultFarmingRun(i+1))).includes(trees);
  if(untouched){
   p.methods=p.methods.filter((_,i)=>i!==runs);
   if(planned===runs)reselect=true;else if(planned>runs)planned--;
   p.plannedMethod=Math.min(planned,Math.max(0,p.methods.length-1));
  }
 }
 if(has(TREE_RUNS)||p.methods.length>=100)return;
 const current=reselect?undefined:p.methods[p.plannedMethod??0];
 p.methods=[...p.methods,treeRunsMethod(level)];
 if(!current||(current.kc==null&&!current.rateOverride&&!current.paceConfirmed&&current.source.startsWith('Spreadsheet')))p.plannedMethod=p.methods.length-1;
}
function skillLevel(j:Journal,p:Pet){return j.hiscores.skills.find(s=>s.name===petSkill[p.name])?.level;}

/** Keep all views on the current-level method denominator; never turn game KC into reward rolls. */
/** Penance Queen comes from high-level gambles, not kills; a gamble costs Honour points from every role. */
/** PetCord's planning pace for Tiny tempor: reward permits spent per hour. */
export const TEMPOROSS_PERMITS_PER_HOUR=80;
export const PENANCE_GAMBLES='High-level gambles', HONOUR_PER_GAMBLE=2000;
/** Lil' Creator: one pet roll per Spoils of war, bought for 30 Zeal; the pace is entered as Zeal per hour. */
export const SPOILS_OF_WAR='Spoils of war', ZEAL_PER_CRATE=30;
const OLD_SPOILS='Spoils of war · 150 Zeal/hour example';
const PENANCE_SOURCE='OSRS Wiki: 1/1,000 per high-level gamble; each costs 500 Honour points in each of the four roles (2,000 in all). Example pace 4 gambles/hour (PetCord sheet) = 8,000 points/hour; enter your own points per hour.';
export function normalizeRates(j:Journal):Journal {
 for(const p of j.pets) {
  // A pet saved before the catalogue had any methods for it (Tumeken's guardian before raid inputs) gets them now;
  // a player cannot remove a catalogue method, so a pet with none never chose that.
  if(!p.methods.length&&listed[p.name]){p.methods=listed[p.name].map(row=>syncedCount(j,blankMethod(row)));p.plannedMethod=0;}
  // The Spoils of war method lost its "150 Zeal/hour example" name: the pace is now entered as Zeal per hour.
  if(p.name==="Lil' Creator"){
   const rename=(n:string|null|undefined)=>n===OLD_SPOILS?SPOILS_OF_WAR:n;
   p.methods=p.methods.map(m=>m.name===OLD_SPOILS?{...m,name:SPOILS_OF_WAR,source:m.source?.replace('Example pace 150 Zeal/hour = 5 crates/hour. Adjust to your measured pace.','Pace 150 Zeal an hour (about three games at up to 50 Zeal) = 5 crates an hour; enter your own Zeal per hour.')}:m);
   if(p.obtainedMethod)p.obtainedMethod=rename(p.obtainedMethod)??p.obtainedMethod;
   if(p.huntHistory)p.huntHistory=p.huntHistory.map(h=>h.method===OLD_SPOILS?{...h,method:SPOILS_OF_WAR}:h);
  }
  if(p.name==='Tangleroot'){upgradeFarming(p,skillLevel(j,p));upgradeTreeMethods(p,skillLevel(j,p));}
  if(p.name==='Giant Squirrel'){
   const used=new Set([p.obtained?p.obtainedMethod:null,...(p.huntHistory??[]).map(s=>s.method)].filter(Boolean).map(s=>s!.trim().toLowerCase()));
   p.methods=p.methods.map(m=>lapUpgrade(m,skillLevel(j,p)??99,used.has(m.name.trim().toLowerCase())));
  }
  p.methods=p.methods.map(m=>m.farmingRun?refreshFarmingRun(m,skillLevel(j,p)):p.name==='Tangleroot'&&m.name===TREE_RUNS?refreshTreeRun(m,skillLevel(j,p)):m.raid?refreshRaidRate(m):m);
  for(const m of p.methods) {
   if(p.name==='Phoenix'&&m.name===PHOENIX_200M_METHOD)m.xp200m=true;
   if(p.name==='Mr McGroot'&&m.name==='Goat hunting'&&m.unit==='catches'&&!m.rateOverride){
    const hunter=j.hiscores.skills.find(s=>s.name==='Hunter')?.level??99;
    m.rate=MCGROOT_BASE-25*Math.max(1,Math.min(99,hunter));m.rateConfirmed=true;
   }
   if(p.name==='Tangleroot'&&m.unit==='XP'&&m.kph==null&&!m.paceConfirmed&&m.source.startsWith('Mixed tree-run estimate:')){m.kph=mixedFarmingMethod(99).kph;m.source+=' Example active pace: 6 magic and 6 palm trees in 15 minutes, excluding growth time; edit to your route.';}
   if(p.name==='Tiny tempor' && m.name==='Tempoross' && m.rate===8000 && (m.unit==='games'||m.activity==='Tempoross')) {
    m.unit='rolls'; m.kc=null; m.kph=null; m.activity=null;
    m.source='OSRS Wiki: 1/8,000 per reward-pool roll. Hiscores games do not count as reward rolls. https://oldschool.runescape.wiki/w/Tiny_tempor';
   }
   if(p.name==='Tiny tempor' && m.unit==='rolls' && m.kph==null && !m.paceConfirmed) {
    m.kph=TEMPOROSS_PERMITS_PER_HOUR;
    m.source+=` Example pace ${TEMPOROSS_PERMITS_PER_HOUR} permits/hour (PetCord sheet); enter your own permits per hour.`;
   }
   if(p.name==='Pet Penance Queen' && m.name==='Penance' && m.unit==='kills') {
    m.name=PENANCE_GAMBLES; m.unit='gambles'; m.kc=null; m.activity=null; m.rate=1000; m.rateConfirmed=true;
    if(!m.paceConfirmed) m.kph=4;
    m.source=PENANCE_SOURCE;
   }
   if(p.name==='Phoenix' && m.unit==='rolls') {
    const xp=j.hiscores.skills.find(s=>s.name==='Firemaking')?.xp;
    // Selecting a future boosted method must not retroactively boost earlier rolls.
    m.kc=m.rate===5000 && xp!=null && xp<200_000_000 ? p.crateRolls??null : null;
   }
   // Level 99 until hiscores sync, so a first sync at 99 does not change any rate.
   const wm=wikiMethod(p.name,m.name), level=skillLevel(j,p)??99;
   if(!wm||m.rateOverride) continue;
   const extraXp=wm.xp==null&&m.unit==='XP'?XP_EACH[p.name]?.[m.name]:undefined;
   const calc=atLevel(extraXp?{...wm,xp:extraXp}:wm,level);
   if(!calc) continue;
   const rate=m.unit==='XP'?calc.expectedXp:calc.actions;
   if(rate!=null && rate>0) {m.rate=rate;m.rateConfirmed=true;}
  }
  // A 200 million XP method follows its base method's rate (÷ 15) and, until the player sets one, its pace.
  const skill=BOOST_SKILL[p.name];
  if(skill)for(const m of p.methods){
   if(!m.xp200m||m.rateOverride||!m.name.startsWith(boostedName(skill,'')))continue;
   const base=p.methods.find(b=>!b.xp200m&&boostedName(skill,b.name)===m.name);
   if(!base?.rate)continue;
   m.rate=base.rate/BOOST_200M;m.rateConfirmed=!!base.rateConfirmed;
   if(!m.paceConfirmed&&base.kph)m.kph=base.kph;
  }
  // After the renames and rate refreshes above, so segments meet each method as it now stands.
  migrateHuntHistory(p);
 }
 return j;
}

/** Acquisition is a separate observation, never copied into live KC or another unit. */
export function usesAcquisition(p:Pet):boolean {
 const m=receivedMethod(p);return !!(p.obtained&&p.obtainedCount!=null&&(p.obtainedStartCount??0)<=p.obtainedCount&&m?.rate&&(p.name==='Tiny tempor'&&p.obtainedUnit==='permits'?'rolls':p.obtainedUnit??(petSkill[p.name]?'XP':m.unit))===m.unit);
}
export function oddsMethod(p:Pet):Method|undefined {
 const received=receivedMethod(p),m=p.obtained?(received??selectedMethod(p)):selectedMethod(p);
 return m&&p.obtained?{...m,...(received&&m.unit==='XP'&&p.historicalXph!=null?{kph:p.historicalXph,paceConfirmed:true}:{}),kc:usesAcquisition(p)?Math.max(0,p.obtainedCount!-(p.obtainedStartCount??0)):null}:m;
}
/** Optional approximation, not a reconstruction of the player's actual crop history. */
export function mixedFarmingMethod(level:number,kind:'mixed'|'fruit'='mixed'):Method {
 const l=Math.max(1,Math.min(99,level));
 // Wiki: planting + health check XP. Equal numbers of magic and palm trees.
 const xpPerPair=kind==='fruit'?10260.6:13913.8+10260.6;
 const rate=-xpPerPair/((kind==='fruit'?0:Math.log1p(-1/(9368-25*l)))+Math.log1p(-1/(9000-25*l)));
 const minutes=kind==='fruit'?10:15,kph=Math.round(xpPerPair*6*60/minutes);
 return {name:kind==='fruit'?'Fruit-tree runs':'Farming runs',unit:'XP',kc:null,kph,rate,rateOverride:true,rateConfirmed:false,paceConfirmed:false,activity:null,source:`${kind==='fruit'?'Fruit-tree estimate: six palm trees in 10 active minutes.':'Mixed tree-run estimate: six magic and six palm trees in 15 active minutes.'} Example active pace ${kph.toLocaleString()} XP/hour, excluding growth/wait time; edit to your actual route. Planting plus health-check XP, no fruit-harvest XP. Fixed level ${l}. Assumes the entered XP came from this mix; earlier levels, other crops, quests and lamps are not reconstructed. https://oldschool.runescape.wiki/w/Tree_farming_guide https://oldschool.runescape.wiki/w/Tangleroot`};
}
