import type {Method} from './model';

/** One crop on a tree run: how many patches of it you plant and check each run. */
export type FarmingPatch={crop:string;count:number};
type Crop={name:string;kind:'tree'|'fruit';level:number;base:number;xp:number;growthHours:number};

/** Tree and fruit-tree crops for a run. Base chance: OSRS Wiki Tangleroot table (snapshot in
 * collection-acquisition.json); the roll happens on check-health. XP = planting + check-health, no fruit picking.
 * XP and growth times are well-known Wiki figures, not in the repo snapshot; see docs/calculations.md. */
export const FARMING_CROPS:Crop[]=[
 {name:'Oak',kind:'tree',level:15,base:22483,xp:14+467.3,growthHours:200/60},
 {name:'Willow',kind:'tree',level:30,base:16059,xp:25+1456.5,growthHours:280/60},
 {name:'Maple',kind:'tree',level:45,base:14052,xp:45+3403.4,growthHours:320/60},
 {name:'Yew',kind:'tree',level:60,base:11242,xp:81+7069.9,growthHours:400/60},
 {name:'Magic',kind:'tree',level:75,base:9368,xp:145.5+13768.3,growthHours:8},
 {name:'Apple',kind:'fruit',level:27,base:9000,xp:22+1199.5,growthHours:16},
 {name:'Banana',kind:'fruit',level:33,base:9000,xp:28+1750.5,growthHours:16},
 {name:'Orange',kind:'fruit',level:39,base:9000,xp:35.5+2470.2,growthHours:16},
 {name:'Curry',kind:'fruit',level:42,base:9000,xp:40+2906.9,growthHours:16},
 {name:'Pineapple',kind:'fruit',level:51,base:9000,xp:57+4605.7,growthHours:16},
 {name:'Papaya',kind:'fruit',level:57,base:9000,xp:72+6146.4,growthHours:16},
 {name:'Palm',kind:'fruit',level:68,base:9000,xp:110.5+10150.1,growthHours:16},
 {name:'Dragonfruit',kind:'fruit',level:81,base:9000,xp:140+17335,growthHours:16},
];

/** Patches open to everyone, no quests: Lumbridge, Varrock, Falador, Taverley and Gnome Stronghold trees;
 * Gnome Stronghold, Tree Gnome Village, Catherby and Brimhaven fruit trees. */
export const DEFAULT_TREE_PATCHES=5,DEFAULT_FRUIT_PATCHES=4;
/** Example active pace: one 9-patch run with teleports in about 10 minutes. */
export const DEFAULT_RUNS_PER_HOUR=6;
export const FARMING_RUNS='Farming runs';

const crop=(name:string)=>FARMING_CROPS.find(c=>c.name===name);
const best=(kind:'tree'|'fruit',level:number)=>FARMING_CROPS.filter(c=>c.kind===kind&&c.level<=level).at(-1);

/** The highest tree and fruit tree the level allows on the free patches. */
export function defaultFarmingRun(level:number):FarmingPatch[]{
 const l=clampLevel(level),tree=best('tree',l),fruit=best('fruit',l);
 return [...(tree?[{crop:tree.name,count:DEFAULT_TREE_PATCHES}]:[]),...(fruit?[{crop:fruit.name,count:DEFAULT_FRUIT_PATCHES}]:[])];
}
function clampLevel(level:number|null|undefined){return Math.max(1,Math.min(99,Math.floor(level??99)));}

export function validFarmingRun(value:unknown):boolean {
 if(value==null)return true;
 return Array.isArray(value)&&value.length>=1&&value.length<=FARMING_CROPS.length&&value.every(p=>p&&typeof p==='object'&&typeof p.crop==='string'&&!!crop(p.crop)&&Number.isInteger(p.count)&&p.count>=1&&p.count<=20)
  &&new Set(value.map(p=>p.crop)).size===value.length;
}

/** Per-run chance at a Farming level: every checked patch is an independent 1/(base − 25 × level) roll. */
export function farmingRunStats(run:FarmingPatch[],level:number|null|undefined){
 const l=clampLevel(level);
 let logMiss=0,xp=0,growthHours=0,patches=0;
 for(const p of run){
  const c=crop(p.crop);if(!c||p.count<1)continue;
  logMiss+=p.count*Math.log1p(-1/(c.base-25*l));xp+=p.count*c.xp;growthHours=Math.max(growthHours,c.growthHours);patches+=p.count;
 }
 const chance=-Math.expm1(logMiss);
 return {chance,runsPerPet:chance>0?1/chance:null,xp,growthHours,patches,level:l};
}

export function describeFarmingRun(run:FarmingPatch[]){
 return run.map(p=>`${p.count} ${p.crop.toLowerCase()}`).join(' + ')+(run.length===1&&run[0].count===1?' tree':' trees');
}

/** A tree run counted in runs, with its own trees (`Method.farmingRun`). It was briefly the default; saved ones keep
 * working, untouched ones are replaced by Tree runs on load (`upgradeFarming` in estimates.ts). */
export function farmingRunsMethod(level:number|null|undefined,run=defaultFarmingRun(clampLevel(level))):Method {
 const s=farmingRunStats(run,level);
 return {name:FARMING_RUNS,unit:'runs',kc:null,kph:DEFAULT_RUNS_PER_HOUR,rate:s.runsPerPet,farmingRun:run,rateOverride:false,rateConfirmed:true,paceConfirmed:false,activity:null,
  source:`OSRS Wiki: one 1/(base − 25 × Farming level) roll per tree checked. Default run: the best tree and fruit tree your level allows on the free patches (5 tree + 4 fruit-tree). Example pace ${DEFAULT_RUNS_PER_HOUR} runs/hour active, excluding growth time. https://oldschool.runescape.wiki/w/Tangleroot`};
}

/** Keeps a farming-runs method's chance in step with its crops and the player's level. */
export function refreshFarmingRun(m:Method,level:number|null|undefined):Method {
 if(!m.farmingRun||m.rateOverride)return m;
 const rate=farmingRunStats(m.farmingRun,level).runsPerPet;
 return rate&&rate!==m.rate?{...m,rate,rateConfirmed:true}:m;
}

/** The name the previous default gave the old 6 magic + 6 palm XP preset; it now loads as Tree runs. */
export const LEGACY_MIXED_RUN='Tree runs: 6 magic + 6 palm (XP)';

/** Tangleroot's default: the standard tree run already modelled by the old mixed preset (`mixedFarmingMethod`),
 * 6 magic + 6 palm trees in about 15 active minutes. Counted in Farming XP, so the hiscores XP is the count; the rate
 * is mean XP per pet = XP per run ÷ −ln(chance of no pet in a run). */
export const TREE_RUNS='Tree runs';
/** Source prefix shared with the old preset, so saved records and new ones are recognised the same way. */
export const TREE_RUN_SOURCE='Mixed tree-run estimate:';
export const TREE_RUN={magic:6,palm:6,activeMinutes:15} as const;
const MAGIC=FARMING_CROPS.find(c=>c.name==='Magic')!,PALM=FARMING_CROPS.find(c=>c.name==='Palm')!;

export function isTreeRun(m:Pick<Method,'unit'|'source'>|undefined):boolean {return m?.unit==='XP'&&m.source.startsWith(TREE_RUN_SOURCE);}

/** One standard tree run at a Farming level: XP, the chance of a pet, and mean XP per pet. */
export function treeRunStats(level:number|null|undefined){
 const l=clampLevel(level),logMiss=TREE_RUN.magic*Math.log1p(-1/(MAGIC.base-25*l))+TREE_RUN.palm*Math.log1p(-1/(PALM.base-25*l));
 const xp=TREE_RUN.magic*MAGIC.xp+TREE_RUN.palm*PALM.xp,chance=-Math.expm1(logMiss);
 return {level:l,xp,chance,runsPerPet:1/chance,xpPerPet:xp/-logMiss,xpPerHour:Math.round(xp*60/TREE_RUN.activeMinutes)};
}

/** The default Tangleroot method. Pace is the example active XP/hour of a 15-minute run: time estimates and pet luck
 * (rate ÷ pace) need one. The calendar estimate uses runs a day instead. */
export function treeRunsMethod(level:number|null|undefined):Method {
 const s=treeRunStats(level);
 return {name:TREE_RUNS,unit:'XP',kc:null,kph:s.xpPerHour,rate:s.xpPerPet,rateOverride:false,rateConfirmed:true,paceConfirmed:false,activity:null,
  source:`${TREE_RUN_SOURCE} six magic and six palm trees per run, ${s.xp.toLocaleString('en-US')} planting and check-health XP, one 1/(base − 25 × Farming level) roll per tree checked. Example active pace ${s.xpPerHour.toLocaleString('en-US')} XP/hour (a ${TREE_RUN.activeMinutes}-minute run), excluding growth time. https://oldschool.runescape.wiki/w/Tree_farming_guide https://oldschool.runescape.wiki/w/Tangleroot`};
}

/** True when a saved rate is exactly what the old preset filled in at some Farming level, so it was never edited. */
export function presetTreeRunRate(rate:number|null|undefined):boolean {
 if(rate==null)return false;
 for(let l=1;l<=99;l++)if(Math.abs(treeRunStats(l).xpPerPet-rate)<=rate*1e-9)return true;
 return false;
}

/** Keeps a tree run's mean XP per pet on the player's current Farming level unless they typed their own. */
export function refreshTreeRun(m:Method,level:number|null|undefined):Method {
 if(!isTreeRun(m)||m.rateOverride)return m;
 const rate=treeRunStats(level).xpPerPet;
 return rate!==m.rate?{...m,rate,rateConfirmed:true}:m;
}
