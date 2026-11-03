import type {Method} from './model';
import {atLevel,wikiMethod} from './skill-rates';

/** Lap times in seconds, from the OSRS Wiki Giant Squirrel table (snapshot in collection-acquisition.json). */
export const LAP_SECONDS:Record<string,number>={
 'Gnome Stronghold':34,'Shayzien (basic)':51,'Draynor Village Rooftop':43.2,'Al Kharid Rooftop':64.2,'Varrock Rooftop':64.8,
 'Agility Pyramid':138.5,'Penguin':65,'Barbarian Outpost':32,'Canifis Rooftop':43.8,'Shayzien (advanced)':46.8,'Ape Atoll':38,
 'Falador Rooftop':58.2,'Colossal Wyrm Remains (basic)':67.8,'Wilderness':45,"Seers' Village Rooftop":36,'Werewolf':38.3,
 'Colossal Wyrm Remains (advanced)':82.8,'Pollnivneach Rooftop':60.6,'Dorgesh-Kaan':156,'Prifddinas':74,'Rellekka Rooftop':51,'Ardougne Rooftop':45.6,
};

/** The old spreadsheet names for courses, counted in XP, and the Wiki course each one is. */
const SPREADSHEET:Record<string,{name:string;course:string;seconds?:number}>={
 Penguin:{name:'Penguin',course:'Penguin'},
 "Seers' (w/ teleport)":{name:"Seers' Village Rooftop",course:"Seers' Village Rooftop"},
 // Same course without the Camelot teleport: the spreadsheet's 46,600 vs 56,000 XP/hour gives a longer lap.
 "Seers' village":{name:"Seers' Village Rooftop (no teleport)",course:"Seers' Village Rooftop",seconds:36*56000/46600},
 Ardougne:{name:'Ardougne Rooftop',course:'Ardougne Rooftop'},
 Prifddinas:{name:'Prifddinas',course:'Prifddinas'},
 'Agility pyramid':{name:'Agility Pyramid',course:'Agility Pyramid'},
 'Dorgesh-Kaan':{name:'Dorgesh-Kaan',course:'Dorgesh-Kaan'},
 Varrock:{name:'Varrock Rooftop',course:'Varrock Rooftop'},
 'Al Kharid':{name:'Al Kharid Rooftop',course:'Al Kharid Rooftop'},
 Falador:{name:'Falador Rooftop',course:'Falador Rooftop'},
 Draynor:{name:'Draynor Village Rooftop',course:'Draynor Village Rooftop'},
 Wilderness:{name:'Wilderness',course:'Wilderness'},
 Gnome:{name:'Gnome Stronghold',course:'Gnome Stronghold'},
 'Ape atoll':{name:'Ape Atoll',course:'Ape Atoll'},
 Barbarian:{name:'Barbarian Outpost',course:'Barbarian Outpost'},
 Relekka:{name:'Rellekka Rooftop',course:'Rellekka Rooftop'},
 Canifis:{name:'Canifis Rooftop',course:'Canifis Rooftop'},
 Pollnivneach:{name:'Pollnivneach Rooftop',course:'Pollnivneach Rooftop'},
};

export function lapsPerHour(seconds:number){return Math.round(36000/seconds)/10;}

/** A course counted in laps: 1/(base − 25 × level) per lap, pace from the Wiki lap time. */
export function lapMethod(course:string,level:number,name=course,seconds=LAP_SECONDS[course]):Method|null {
 const w=wikiMethod('Giant Squirrel',course),calc=w?atLevel(w,level):null;
 if(!calc)return null;
 return {name,unit:'laps',kc:null,rate:calc.actions,kph:seconds?lapsPerHour(seconds):null,activity:null,rateConfirmed:true,paceConfirmed:false,
  source:`OSRS Wiki: 1/(${w!.base.toLocaleString('en-US')} − 25 × Agility level) per lap.${seconds?` Example pace from a ${Math.round(seconds*10)/10}-second lap; edit to your own.`:''} https://oldschool.runescape.wiki/w/Giant_squirrel`};
}

/** Turns an untouched spreadsheet XP course into the same course counted in laps. Anything with a count, an edit,
 * or an acquisition record stays exactly as saved. */
export function lapUpgrade(m:Method,level:number,inUse:boolean):Method {
 const row=SPREADSHEET[m.name];
 if(!row||inUse||m.unit!=='XP'||m.kc!=null||m.rateOverride||m.paceConfirmed||!m.source.startsWith('Spreadsheet'))return m;
 return lapMethod(row.course,level,row.name,row.seconds??LAP_SECONDS[row.course])??m;
}
