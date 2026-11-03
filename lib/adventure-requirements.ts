import {requirementParts,type Requirement} from './requirements';
/** stage: only part of the quest is needed. noCheck: an alternative may stand in ("or a Slayer cape"), so no tick or cross. */
export type AdventureRequirement=Requirement & {points?:number;note?:string;stage?:'started'|'partial';noCheck?:boolean};
export type RequirementItem={id:number;name:string};
/** One item tile: a single item, or alternatives ("Dramen staff or Lunar staff") that each keep their own icon. */
export type ItemRequirement={label:string;items:RequirementItem[];quantity?:number;note?:string};
/** Requirement tiles by kind, then plain notes (short muted lines, no tile). */
export type AdventureRequirements={skills:AdventureRequirement[];quests:AdventureRequirement[];items:ItemRequirement[];notes:string[]};
/** A diary requirement line split into tiles (scripts/build-diary-items.mjs): items with their quantity, a skill or quest
 * tile, or a plain note. */
export type DiaryItemTile={items:RequirementItem[];quantity?:number;note?:string;label?:string}|{skill:string;level:number;note?:string;noCheck?:boolean}|{quest:string;note?:string;stage?:'started'|'partial';noCheck?:boolean}|{text:string};
/** Kudos has no skill icon: the Varrock Museum's own item, the Museum map, stands for it. */
export const KUDOS_ICON='/items/11184.png';
/** OSRS item names start with a capital letter ("Coins", not "coins"). */
export function itemName(name:string){return name.charAt(0).toUpperCase()+name.slice(1);}
/** Tile notes read like the quest panel's ("Ironman only", "Boostable"): capitalised, no full stop. */
export function tileNote(note:string|undefined){const n=(note??'').trim().replace(/[.]$/,'');return n?n.charAt(0).toUpperCase()+n.slice(1):undefined;}
/** "Dramen staff or Lunar staff"; three or more read "A, B or C". */
export function alternativesLabel(items:RequirementItem[]){const names=items.map(i=>itemName(i.name));return names.length<3?names.join(' or '):names.slice(0,-1).join(', ')+' or '+names[names.length-1];}
const ABBREVIATION=/(?:\b[A-Z]|\bSt|\bMt|\bDr|\bLvl|\bvs|\be\.g|\bi\.e|\.\.)\.$/;
/** Plain notes: one sentence a line without its full stop, "Note:", the empty "( )" left by stripped icons, or Deadman
 * Mode variants. */
export function noteLines(text:string):string[]{
 const out:string[]=[];
 for(const para of text.split('\n')){
  const clean=para.replace(/^\s*Note:\s*/i,'').replace(/\s*\(\s*\)/g,'').replace(/\s+/g,' ').trim();
  if(!clean)continue;
  let current='';
  for(const word of clean.split(' ')){
   current=current?current+' '+word:word;
   if(/[.!?]$/.test(word)&&!ABBREVIATION.test(current)){out.push(current);current='';}
  }
  if(current)out.push(current);
 }
 return out.filter(line=>!/Deadman Mode/i.test(line)).map(line=>line.replace(/[.]{4}$/,'...').replace(/(?<![.])[.]$/,''));
}
const QUEST_STAGE:[RegExp,'started'|'partial'][]=[[/^(?:Started|Having started|Quest start of)\s+(.+)$/i,'started'],[/^Partial completion of\s+(.+)$/i,'partial']];
/** Classify reference lines without converting optional, partial or OR conditions into completion checks. */
export function diaryRequirementGroups(lines:string[],quests:string[],skills:string[],items:Record<string,DiaryItemTile[]>):AdventureRequirements{
 const groups:AdventureRequirements={skills:[],quests:[],items:[],notes:[]};
 const same=(a:string,b:string)=>a.toLowerCase().replaceAll('’',"'")===b.toLowerCase().replaceAll('’',"'");
 // "the Troll Stronghold" and "The Golem": try the name as written, then without a leading "the".
 // "the Monkey Madness I quest.", "Waterfall Quest", "Another Slice of H.A.M.": as written first, then trimmed.
 const questName=(name:string)=>{
  for(const n of [name,name.replace(/[.]$/,''),name.replace(/\s+quest[.]?$/i,'')])for(const c of [n,n.replace(/^the\s+/i,'')]){const q=quests.find(q=>same(q,c));if(q)return q;}
  return undefined;
 };
 const note=(text:string)=>{for(const line of noteLines(text))if(!groups.notes.includes(line))groups.notes.push(line);};
 for(const raw of lines){
  const line=raw.replace(/^\*+\s*/,'').trim();
  if(!line||/^none(?: listed)?[.]?$/i.test(line))continue;
  const clean=line.replace(/^Quest\s+(?!point\b)/,'');
  // A listed line with no tiles is dropped on purpose (a link to a Wiki strategy page).
  if(Object.hasOwn(items,clean)){
   for(const tile of items[clean]){
    const n=tileNote('note' in tile?tile.note:undefined);
    if('text' in tile)note(tile.text);
    else if('skill' in tile)groups.skills.push({label:`${tile.level} ${tile.skill}`,skill:tile.skill,level:tile.level,...(n?{note:n}:{}),...(tile.noCheck?{noCheck:true}:{})});
    else if('quest' in tile)groups.quests.push({label:tile.quest,quest:tile.quest,...(tile.stage?{stage:tile.stage}:{}),...(n?{note:n}:{}),...(tile.noCheck?{noCheck:true}:{})});
    else groups.items.push({label:tile.label??alternativesLabel(tile.items),items:tile.items.map(i=>({id:i.id,name:itemName(i.name)})),...(tile.quantity&&tile.quantity>1?{quantity:tile.quantity}:{}),...(n?{note:n}:{})});
   }
   continue;
  }
  const points=line.match(/^Quest\s+(\d+)$/i);
  if(points){groups.quests.push({label:`${points[1]} Quest points`,points:Number(points[1])});continue;}
  const combat=clean.match(/^Combat\s+(\d+)$/i);
  if(combat){groups.skills.push({label:`${combat[1]} Combat`,skill:'Combat',level:Number(combat[1])});continue;}
  const staged=QUEST_STAGE.map(([re,stage])=>{const m=clean.match(re);const quest=m&&questName(m[1]);return quest?{label:quest,quest,stage,note:stage==='started'?'Started':'Partial'}:null;}).find(Boolean);
  if(staged){groups.quests.push(staged);continue;}
  // Commas in an otherwise fully recognised skill list also mean AND.
  const skillParts=requirementParts(clean.replace(/,\s*(?:and\s+)?/gi,' and '),quests,skills);
  if(skillParts.every(r=>r.skill)){groups.skills.push(...skillParts);continue;}
  const parts=requirementParts(clean.replace(/^Full completion of/i,'Completion of'),quests,skills);
  if(parts.every(r=>r.quest)){groups.quests.push(...parts);continue;}
  const one=clean.match(/^(?:Full )?Completion of\s+(.+)$/i),quest=one&&questName(one[1]);
  if(quest){groups.quests.push({label:quest,quest});continue;}
  const recommended=clean.match(/^(.+?\s\d+)\s+recommended$/i),skill=recommended&&requirementParts(recommended[1],quests,skills);
  if(skill?.length===1&&skill[0].skill){groups.skills.push({...skill[0],note:'Recommended'});continue;}
  note(clean);
 }
 return groups;
}
const singular=(s:string)=>s.toLowerCase().replace(/(?:ies)$/,'y').replace(/(?:es|s)$/,'');
/** How many of an item a quest's Wiki item list asks for ("* 90 steel nails" → 90 for Steel nails); 1 when no amount is given. */
export function questItemQuantity(itemsText:string|undefined,name:string){
 const want=singular(name);
 for(const raw of (itemsText??'').split('\n')){
  const m=raw.match(/^\*\s*(\d[\d,]*)\s+(?:x\s+)?([^(,;]+)/i);
  if(!m)continue;
  const words=singular(m[2].trim().replace(/[.:]$/,''));
  if(words===want||words.startsWith(want+' '))return Number(m[1].replaceAll(',',''))||1;
 }
 return 1;
}
export function requirementCompletion(r:AdventureRequirement,skills:{name:string;level:number}[],quests:{name:string;state:string;points:number}[]|undefined):boolean|null{
 const key=(name:string)=>name.toLowerCase().replaceAll('’',"'");
 if(r.noCheck)return null;
 if(r.quest&&r.stage){
  // Started: any progress counts. Partial: only a finished quest proves the needed part; started stays unknown.
  const state=quests?.find(q=>key(q.name)===key(r.quest!))?.state;
  if(!state)return null;
  if(state==='finished')return true;
  if(state==='not_started')return false;
  return r.stage==='started'?true:null;
 }
 if(r.skill){const skill=skills.find(s=>key(s.name)===key(r.skill!));return skill&&skill.level>=0?skill.level>=r.level!:null;}
 if(r.quest){const quest=quests?.find(q=>key(q.name)===key(r.quest!));return quest?quest.state==='finished':null;}
 if(r.points!=null)return quests?.length?quests.filter(q=>q.state==='finished').reduce((n,q)=>n+q.points,0)>=r.points:null;
 return null;
}
