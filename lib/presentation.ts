import {SQUIRE_PREFIX} from './features';
import {currentRankChoice,rankTitleRequirement,rankTitles,RANK_TITLE_TIERS} from './rank-rewards';
import {devPreviewsAll} from './environment';
import {hasGildedSupporter} from './staff-appearance';
import {achievementTitle, earnedMarks, badgeCatalogue} from './flair';
import type {Journal} from './model';
import type {PublicStaff, StaffRole} from './staff-policy';
import {earnedPrefix,NAME_PREFIXES,type NamePrefix} from './name-prefix';
/** showTitle: whether "the Generous" shows after the name, when it is earned (on by default). */
export type Presentation = {staffBadge:StaffRole|'gilded'|null;staffPrefix:NamePrefix|null;titleChoice:string;showDonation:boolean;showTitle:boolean};
export type Donation = {amountMinor:number|null;currency:string;hidden:boolean;badge?:'gilded'|null;supporter?:boolean};
export function signatureTitle(name:string){return name.toLowerCase()==='spoonedosrs'?'the One and Only':null;}
export function titleChoices(j:Journal,supporter=false,role?:StaffRole|null) {
 const marks=new Set(earnedMarks(j).map(m=>m.id));
 return [
  ...(supporter?[{id:'supporter',label:'Supporter',unlocked:true,requirement:'Support Spooned OSRS'}]:[]),
  {id:'staff-helper',label:'the Helper',unlocked:!!role,requirement:'Become a community helper'},
  {id:'staff-moderator',label:'the Moderator',unlocked:!!role&&role!=='helper',requirement:'Become a community moderator'},
  {id:'staff-admin',label:'the Administrator',unlocked:role==='admin'||role==='owner',requirement:'Become a community admin'},
  ...rankTitles(j),
  // The owner on dev previews every title: the signature title and each rank tier (on Giant Mole) without the rank.
  ...(devPreviewsAll(role)?[
   ...(!signatureTitle(j.username)?[{id:'one-and-only',label:'the One and Only',unlocked:true,requirement:'Exclusive to SpoonedOSRS (dev preview)'}]:[]),
   ...RANK_TITLE_TIERS.filter(t=>!rankTitles(j).some(r=>r.label===`the Giant Mole ${t.noun}`)).map(t=>({id:`hiscore:giant%20mole:${t.id}`,label:`the Giant Mole ${t.noun}`,unlocked:true,requirement:`${rankTitleRequirement(t.noun,'Giant Mole')} (dev preview)`})),
  ]:[]),
  ...(signatureTitle(j.username)?[{id:'one-and-only',label:'the One and Only',unlocked:true,requirement:'Exclusive to SpoonedOSRS'}]:[]),
  {id:'pet-hunter',label:'the Pet Hunter',unlocked:marks.has('pets-1'),requirement:'Collect your first pet'},
  {id:'pet-collector',label:'the Pet Collector',unlocked:j.pets.filter(p=>p.obtained).length>=10,requirement:'Collect 10 pets'},
  {id:'pet-tamer',label:'the Pet Tamer',unlocked:j.pets.filter(p=>p.obtained).length>=25,requirement:'Collect 25 pets'},
  {id:'log-collector',label:'the Log Collector',unlocked:(j.log?.obtained??0)>=100,requirement:'Unlock 100 collection log slots'},
  {id:'clogger',label:'the Clogger',unlocked:(j.log?.obtained??0)>=500,requirement:'Unlock 500 collection log slots'},
  {id:'menagerie',label:'the Zoo Keeper',unlocked:marks.has('pets-50'),requirement:'Collect 50 pets'},
  {id:'beastmaster',label:'the Beastmaster',unlocked:marks.has('pets-all'),requirement:'Collect every pet'},
  {id:'completionist',label:'the Completionist',unlocked:marks.has('clog-all'),requirement:'Unlock every collection log slot'},
  {id:'combatant',label:'the Combatant',unlocked:marks.has('combat-100'),requirement:'Complete 100 combat achievement tasks'},
  {id:'questmaster',label:'the Wise Old Man',unlocked:marks.has('quest-cape'),requirement:'Finish every synced quest'},
  {id:'achiever',label:'the Achiever',unlocked:marks.has('diary-cape'),requirement:'Complete every diary'},
  {id:'maxed',label:'the Maxed',unlocked:marks.has('max-cape'),requirement:'Reach 99 in every skill'},
 ].sort((a,b)=>TITLE_RARITIES.indexOf(titleRarity(a.label))-TITLE_RARITIES.indexOf(titleRarity(b.label)));
}
/** Use the same synced progress as achievement emblems. */
export function titleProgress(j:Journal,id:string){
 if(id==='log-collector')return {completed:j.log?.obtained??0,total:100,unit:'log slots'};
 if(id==='clogger')return {completed:j.log?.obtained??0,total:500,unit:'log slots'};
 const ids:Record<string,[string,string]>={'pet-hunter':['pets-1','pets'],'pet-collector':['pets-10','pets'],'pet-tamer':['pets-25','pets'],'menagerie':['pets-50','pets'],'beastmaster':['pets-all','pets'],'completionist':['clog-all','log slots'],'combatant':['combat-100','tasks'],'questmaster':['quest-cape','quests'],'achiever':['diary-cape','tasks'],'maxed':['max-cape','skills at 99']};
 const entry=ids[id];if(!entry)return null;
 const badge=badgeCatalogue(j).find(b=>b.id===entry[0]);
 return badge?{completed:badge.completed,total:badge.total,unit:entry[1]}:null;
}
/** Resolve legacy automatic preferences to an explicit choice when editing. */
export function editableTitleChoice(j:Journal,choice:string,mark:string|null,owner=false,supporter=false,role?:StaffRole|null){
 // A saved rank title opens on the tier held today, so its card shows as chosen (a saved Master is Grandmaster).
 if(choice!=='auto')return currentRankChoice(j,choice);
 const label=selectedTitle(j,choice,mark,owner,supporter,role);
 return titleChoices(j,supporter,role??(owner?'owner':null)).find(t=>t.label===label)?.id??'none';
}
export function selectedTitle(j:Journal,choice:string,mark:string|null,owner=false,supporter=false,role?:StaffRole|null) {
 if(choice==='auto')return signatureTitle(j.username)??achievementTitle(j,mark)??(supporter?'Supporter':null);
 if(choice==='none')return null;
 const current=currentRankChoice(j,choice);
 return titleChoices(j,supporter,role??(owner?'owner':null)).find(t=>t.id===current&&(t.unlocked||owner))?.label??(supporter?'Supporter':null);
}
/** guideWriter: the person has a published guide, which earns Squire (lib/name-prefix.ts). */
export function parsePresentation(input:Partial<Presentation>,prior:Presentation,j:Journal,staff:PublicStaff|null,donation?:Donation,supporter=false,guideWriter=false,squire?:boolean):Presentation {
 const p={...prior,...input}, owner=staff?.role==='owner', earned=earnedPrefix(staff?.role,guideWriter,squire);
 if(![null,'helper','moderator','admin','owner','gilded'].includes(p.staffBadge))throw Error('Choose a valid staff badge.');
 if(p.staffPrefix!==null&&!NAME_PREFIXES.includes(p.staffPrefix))throw Error('Choose a valid staff prefix.');
 if(p.staffBadge==='gilded'&&!hasGildedSupporter(donation))throw Error('That supporter badge is not unlocked.');
 if(!owner&&p.staffBadge!==null&&p.staffBadge!=='gilded')throw Error('Only the site owner can choose alternate staff badges.');
 if(p.staffPrefix!==null){
  // Asking for a prefix shows the one earned today, except that someone who earns Sir may ask for Squire instead. A prefix
  // kept from before that is no longer earned just switches off.
  if(earned)p.staffPrefix=p.staffPrefix==='Squire'&&earned==='Sir'&&(squire??SQUIRE_PREFIX)?'Squire':earned;
  else if(input.staffPrefix!=null)throw Error('That name title is not unlocked.');
  else p.staffPrefix=null;
 }
 if(typeof p.showDonation!=='boolean')throw Error('Choose whether to show your donation amount.');
 // Older saves and stored rows without the choice keep showing it.
 if(p.showTitle===undefined)p.showTitle=true;
 else if(typeof p.showTitle!=='boolean')throw Error('Choose whether to show the Generous.');
 if(!['auto','none'].includes(p.titleChoice)){
  p.titleChoice=currentRankChoice(j,p.titleChoice);
  if(!titleChoices(j,supporter,staff?.role).some(t=>t.id===p.titleChoice&&(t.unlocked||owner)))throw Error('That title is not unlocked.');
 }
 return p;
}
export function donationLabel(d?:Donation):string {
 if(d?.hidden)return 'Supporter';
 return 'Supporter · '+(d?.amountMinor==null?'?':new Intl.NumberFormat('en-US',{style:'currency',currency:d.currency}).format(d.amountMinor/100));
}

/** Title rarities, lowest first: the order of the achievement title groups in Profile settings. */
export const TITLE_RARITIES=['common','uncommon','rare','epic','legendary'] as const;
export type TitleRarity=(typeof TITLE_RARITIES)[number];
/** Visual rarity is shared by the editor, profiles and community rows. */
export function titleRarity(label:string|null|undefined):TitleRarity{
 if(['the One and Only','the Beastmaster','the Completionist'].includes(label??'')||/^the .+ Champion$/.test(label??''))return 'legendary';
 if(['the Zoo Keeper','the Maxed','the Administrator'].includes(label??'')||/^the .+ Grandmaster$/.test(label??''))return 'epic';
 if(['the Pet Tamer','the Clogger','the Wise Old Man','the Achiever','the Moderator'].includes(label??'')||/^the .+ Expert$/.test(label??''))return 'rare';
 return ['Supporter','the Pet Collector','the Log Collector','the Helper'].includes(label??'')||/^the .+ Elite$/.test(label??'')?'uncommon':'common';
}
/** Every legendary title but the signature one shares one animated prismatic treatment (app/title-rarities.css). */
export function titleEffect(label:string|null|undefined):string {
 if(/^the .+ Champion$/.test(label??''))return 'title-legendary';
 if(/^the .+ Grandmaster$/.test(label??''))return 'title-epic-glow';
 if(/^the .+ Expert$/.test(label??''))return 'title-rare';
 const effects:Record<string,string>={'the One and Only':'title-one-only','the Beastmaster':'title-legendary','the Completionist':'title-legendary','the Maxed':'title-maxed','the Zoo Keeper':'title-epic','the Achiever':'title-rare','the Pet Collector':'title-uncommon','the Pet Tamer':'title-rare','the Log Collector':'title-uncommon','the Clogger':'title-rare','the Wise Old Man':'title-rare','the Combatant':'title-common','Supporter':'title-uncommon','the Helper':'title-uncommon','the Moderator':'title-rare','the Administrator':'title-epic'};
 return effects[label??'']??(/^the .+ Elite$/.test(label??'')?'title-uncommon':'title-common');
}

/** Shared descriptions for earned titles in profiles, boards and the editor. */
export function achievementDescription(label:string):string {
 const rank=label.match(/^the (.+) (Champion|Grandmaster|Expert|Elite)$/);
 if(rank)return rankTitleRequirement(rank[2],rank[1])!;
 const descriptions:Record<string,string>={
  'Supporter':'Supports Spooned OSRS',
  'the Helper':'Become a community helper', 'the Moderator':'Become a community moderator', 'the Administrator':'Become a community admin',
  'the One and Only':'Exclusive to SpoonedOSRS',
  'the Pet Hunter':'Collect your first pet', 'the Pet Collector':'Collect 10 pets', 'the Pet Tamer':'Collect 25 pets', 'the Log Collector':'Unlock 100 collection log slots',
  'the Clogger':'Unlock 500 collection log slots', 'the Zoo Keeper':'Collect 50 pets',
  'the Beastmaster':'Collect every pet', 'the Completionist':'Unlock every collection log slot',
  'the Combatant':'Complete 100 combat achievement tasks', 'the Wise Old Man':'Finish every synced quest',
  'the Achiever':'Complete every diary task', 'the Maxed':'Reach 99 in every skill',
 };
 return descriptions[label]??label;
}
