/** Per-method inputs for pets whose roll depends on how you do the content (docs/calculations.md, "Raid pets" and
 * "Inputs on a method"): your raid points and raid level, your Nightmare team size, how deep you delve for Dom. A
 * method with inputs has its rate recomputed from them on every load unless the player typed their own
 * (`rateOverride`), like Tree runs. Saved journals keep the field name `raid` for all of them. Theatre of Blood needs
 * no inputs: Lil' Zik is a flat personal roll per completion. */
export type RaidKind='cox'|'toa'|'nightmare'|'dom';
export type RaidInputs=
 |{kind:'cox';/** Your own points per raid. */points:number}
 |{kind:'toa';/** Your own points per raid. */points:number;/** Tombs of Amascut raid level. */level:number}
 |{kind:'nightmare';/** Players in the room when the fight started. */team:number}
 |{kind:'dom';/** The deepest delve level each run finishes. */delve:number};

/** OSRS Wiki (Ancient chest): 1% unique chance per 8,676 team points; the unique goes to a player weighted by personal
 * points; only that player rolls 1/53 for the Olmlet. Uncapped, team points cancel out: your chance per raid is
 * your points ÷ 867,600 × 1/53. Points past the 65.7% cap (570,000) roll a further unique, so it stays linear. */
export const COX_POINTS_PER_PERCENT=8676,OLMLET_PER_UNIQUE=53;
export const COX_RAIDS_PER_PET_POINTS=100*COX_POINTS_PER_PERCENT*OLMLET_PER_UNIQUE; // 45,982,800
/** OSRS Wiki (Chest (Tombs of Amascut)): 1% pet chance per 350,000 − 700 × L reward points, a separate roll from the
 * purple, L the scaled raid level. The starting 5,000 points are not counted. */
export const TOA_PET_BASE=350_000,TOA_PET_PER_LEVEL=700;
/** OSRS Wiki (Lil' Zik): a personal roll on every completion, best performance; Entry Mode cannot give it. */
export const TOB_NORMAL=650,TOB_HARD=500;
/** OSRS Wiki (Little Nightmare): 1/800 solo, 1/1,600 duo, 1/2,400 trio, 1/3,200 for four and 1/4,000 for five or more,
 * counting the players in the room when the fight started. Phosani's Nightmare is solo only, a flat 1/1,400. */
export const NIGHTMARE_SOLO=800,NIGHTMARE_TEAM_CAP=5;
/** OSRS Wiki (Doom of Mokhaiotl, unique rates per delve level): Dom drops only on completing delve 6 or deeper: 1/1,000
 * at 6, 1/750 at 7, 1/500 at 8 and 1/250 at 9 and every deeper delve. Each completed delve is its own roll. */
export const DOM_DELVE_RATES:Readonly<Record<number,number>>={6:1000,7:750,8:500},DOM_DEEP_RATE=250;

export const RAID_DEFAULTS={
 cox:{points:30_000},
 coxChallenge:{points:45_000},
 toa:{points:20_000,level:150},
 toaExpert:{points:20_000,level:400},
 nightmare:{team:1},
 /** The Wiki's Doom of Mokhaiotl money making guide counts runs from delve 1 to 8. */
 dom:{delve:8},
} as const;

/** Raid levels above 400 count a third, up to 550; above 550 nothing more. */
export function toaScaledLevel(level:number):number {
 const l=Math.max(0,level);
 return l<=400?l:l<=550?400+(l-400)/3:450;
}
export function coxRaidsPerPet(points:number):number|null {return points>0?COX_RAIDS_PER_PET_POINTS/points:null;}
export function toaRaidsPerPet(points:number,level:number):number|null {
 const per=TOA_PET_BASE-TOA_PET_PER_LEVEL*toaScaledLevel(level);
 return points>0&&per>0?Math.max(1,100*per/points):null;
}
/** The Nightmare: kills per pet for the players in the room; five or more are all 1/4,000. */
export function nightmareKillsPerPet(team:number):number|null {
 return Number.isFinite(team)&&team>=1?NIGHTMARE_SOLO*Math.min(Math.floor(team),NIGHTMARE_TEAM_CAP):null;
}
/** Doom of Mokhaiotl: runs per pet when every run finishes delves 1 to `delve`, each delve from 6 on its own roll.
 * Shallower runs cannot give Dom. */
export function domRunsPerPet(delve:number):number|null {
 if(!Number.isFinite(delve)||delve<6)return null;
 let miss=1;
 for(let level=6;level<=Math.floor(delve);level++)miss*=1-1/(DOM_DELVE_RATES[level]??DOM_DEEP_RATE);
 return 1/(1-miss);
}
/** "1 in N" raids, kills or runs for a method's inputs. */
export function raidRate(raid:RaidInputs|null|undefined):number|null {
 if(!raid)return null;
 const rate=raid.kind==='cox'?coxRaidsPerPet(raid.points):raid.kind==='toa'?toaRaidsPerPet(raid.points,raid.level??0):raid.kind==='nightmare'?nightmareKillsPerPet(raid.team):domRunsPerPet(raid.delve);
 return rate==null?null:Math.max(1,rate);
}
const int=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
export function validRaid(value:unknown):boolean {
 if(value==null)return true;
 if(typeof value!=='object'||Array.isArray(value))return false;
 const r=value as Record<string,unknown>,keys=Object.keys(r),only=(...allowed:string[])=>keys.every(k=>allowed.includes(k));
 if(r.kind==='nightmare')return only('kind','team')&&int(r.team,1,100);
 if(r.kind==='dom')return only('kind','delve')&&int(r.delve,1,1000);
 const points=typeof r.points==='number'&&Number.isFinite(r.points)&&r.points>=1&&r.points<=10_000_000;
 if(r.kind==='cox')return only('kind','points')&&points;
 if(r.kind==='toa')return only('kind','points','level')&&points&&int(r.level,0,600);
 return false;
}
/** Keeps a method's rate in step with its inputs unless the player typed their own. Inputs that cannot give the pet
 * (a delve shallower than 6) leave no rate. */
export function refreshRaidRate<M extends {raid?:RaidInputs|null;rate:number|null;rateOverride?:boolean;rateConfirmed?:boolean}>(m:M):M {
 if(!m.raid||m.rateOverride)return m;
 const rate=raidRate(m.raid);
 if(rate==null)return m.rate==null?m:{...m,rate:null};
 return rate!==m.rate||!m.rateConfirmed?{...m,rate,rateConfirmed:true}:m;
}
/** A fresh allowlisted copy, so saved or public journals never carry extra fields. */
export function raidInputs(raid:RaidInputs):RaidInputs {
 switch(raid.kind){
  case 'toa':return {kind:'toa',points:raid.points,level:raid.level};
  case 'nightmare':return {kind:'nightmare',team:raid.team};
  case 'dom':return {kind:'dom',delve:raid.delve};
  default:return {kind:'cox',points:raid.points};
 }
}
/** One short line under a method's rate: what the chance assumes. */
export function raidFact(raid:RaidInputs):string {
 if(raid.kind==='nightmare')return raid.team<=1?'Solo kills: 1/800':`Team of ${raid.team}: 1/800 × ${Math.min(raid.team,NIGHTMARE_TEAM_CAP)}${raid.team>NIGHTMARE_TEAM_CAP?' (five or more players is 1/4,000)':''}`;
 if(raid.kind==='dom')return raid.delve<6?'Delves shallower than 6 cannot give Dom':`Runs to delve ${raid.delve}: one roll at each delve from 6`;
 const pts=Math.round(raid.points).toLocaleString('en-US');
 return raid.kind==='cox'?`At ${pts} of your points a raid; needs a purple (1/53 on yours)`:`At ${pts} points, raid level ${raid.level}; separate from the purple roll`;
}
