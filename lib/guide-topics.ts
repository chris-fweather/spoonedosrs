import activities from './activity-catalogue.json' with {type:'json'};
import {bossArtwork} from './artwork';
import {guideQuests,guideDiaryAreas} from './guides';
import questReference from './quest-reference.json' with {type:'json'};
import logTemplate from './log-template.json' with {type:'json'};
/** Hiscore entries that are scores rather than something to write a guide about, or that read better under a topic name. */
const RENAME:Record<string,string|null>={'Grid Points':null,'League Points':null,'Deadman Points':null,'Bounty Hunter (Legacy) - Hunter':null,'Bounty Hunter (Legacy) - Rogue':null,'Bounty Hunter - Rogue':null,
 'Bounty Hunter - Hunter':'Bounty Hunter','Clue Scrolls (all)':'Clue scrolls','LMS - Rank':'Last Man Standing','PvP Arena - Rank':'PvP Arena','Soul Wars Zeal':'Soul Wars','Rifts closed':'Guardians of the Rift','Colosseum Glory':'Fortis Colosseum','Collections Logged':'Collection log'};
const SKILLS=['Attack','Strength','Defence','Ranged','Prayer','Magic','Runecraft','Construction','Hitpoints','Agility','Herblore','Thieving','Crafting','Fletching','Slayer','Hunter','Mining','Smithing','Fishing','Cooking','Firemaking','Woodcutting','Farming','Sailing'];
/** A topic, its icon, and a short detail (a quest's difficulty). */
export type GuideTopic={name:string;image:string;detail?:string;badge?:string};
const QUESTS=(questReference as {quests:Record<string,{difficulty?:string}>}).quests;
const CA_TIERS=['Easy','Medium','Hard','Elite','Master','Grandmaster'];
/** What a guide can be about: every boss, raid and activity on the Hiscores (A to Z), every skill, every quest (with its difficulty),
 * every achievement diary and each combat achievement tier, each with its icon. */
export const guideTopics:GuideTopic[]=[
 ...(activities as string[]).flatMap(source=>{const name=Object.hasOwn(RENAME,source)?RENAME[source]:source,image=bossArtwork(source);return name&&image?[{name,image}]:[];}).sort((a,b)=>a.name.localeCompare(b.name)),
 ...SKILLS.flatMap(name=>{const image=bossArtwork(name);return image?[{name,image}]:[];}),
 // Every quest with the quest icon, and its difficulty beside it.
 ...guideQuests.map(name=>{const d=QUESTS[name]?.difficulty;return {name,image:'/ui/quest-point-icon.png',...(d?{detail:d,badge:`/icons/tiers/${d.toLowerCase()}.png`}:{})};}),
 ...guideDiaryAreas.map(area=>({name:`${area} Diary`,image:'/ui/achievement-diaries-icon.png',detail:'Achievement diary'})),
 ...CA_TIERS.map(tier=>({name:`${tier} combat achievements`,image:`/icons/tiers/ca-${tier.toLowerCase()}.png`,detail:'Combat achievements'})),
];
export function guideTopicImage(activity:string):string|undefined{const a=activity.trim().toLowerCase();return guideTopics.find(t=>t.name.toLowerCase()===a)?.image??bossArtwork(a);}
/** The layout a topic suits best: a quest guide, a diary guide, or a bossing guide for bosses, raids and activities. */
export function suggestedLayout(activity:string):'pvm'|'quest'|'diary'|'blank'{
 const t=guideTopics.find(x=>x.name===activity);if(!t)return 'blank';
 return t.detail==='Achievement diary'?'diary':t.detail==='Combat achievements'||SKILLS.includes(t.name)?'blank':t.image.endsWith('quest-point-icon.png')?'quest':'pvm';
}
/** The groups guides are filed under. The first four are the in-game collection log tabs (Bosses, Raids, Clues, Minigames), so
 * a boss sits wherever the game puts it; quests, diaries, combat achievements and skills follow as the game's own lists, and
 * everything else is Other (the log's last tab). Each guide's group comes from its topic, so guides need no extra field. */
export const GUIDE_CATEGORIES=[
 {id:'bosses',label:'Bosses',icon:'/icons/game/fight-melee.png'},
 {id:'raids',label:'Raids',icon:'/bosses/chambers-of-xeric.png'},
 {id:'clues',label:'Clues',icon:'/bosses/clue-scrolls-all.png'},
 {id:'minigames',label:'Minigames',icon:'/icons/game/minigame.png'},
 {id:'quests',label:'Quests',icon:'/ui/quest-point-icon.png'},
 {id:'diaries',label:'Achievement diaries',icon:'/ui/achievement-diaries-icon.png'},
 {id:'combat-achievements',label:'Combat achievements',icon:'/icons/navigation/combat-achievements-icon.png'},
 {id:'skilling',label:'Skilling',icon:'/icons/navigation/stats-icon.png'},
 {id:'other',label:'Other',icon:'/icons/navigation/collection-log-icon.png'},
] as const;
export type GuideCategory=typeof GUIDE_CATEGORIES[number]['id'];
const LOG_TAB:Record<string,GuideCategory>={Bosses:'bosses',Raids:'raids',Clues:'clues',Minigames:'minigames',Other:'other'};
/** Collection log page name (lower case, without "The") to its tab's group; "Callisto and Artio" counts for both bosses. */
const LOG_PAGES=new Map<string,GuideCategory>();
const logKey=(name:string)=>name.trim().toLowerCase().replace(/^the\s+/,'');
for(const tab of (logTemplate as {tabs:{name:string;pages:{name:string}[]}[]}).tabs){const group=LOG_TAB[tab.name];if(!group)continue;
 for(const page of tab.pages)for(const part of [page.name,...page.name.split(' and ')])if(!LOG_PAGES.has(logKey(part)))LOG_PAGES.set(logKey(part),group);}
/** Hiscores names that differ from their collection log page. Bounty Hunter and PvP Arena have no log page; the Hiscores list
 * them with the minigames. */
const LOG_ALIAS:Record<string,string>={'tztok-jad':'fight caves','tzkal-zuk':'inferno','sol heredit':'fortis colosseum','lunar chests':'moons of peril',
 'dagannoth prime':'dagannoth kings','dagannoth rex':'dagannoth kings','dagannoth supreme':'dagannoth kings',"phosani's nightmare":'nightmare','corrupted gauntlet':'gauntlet',
 'mimic':'elite treasure trails','bounty hunter':'last man standing','pvp arena':'last man standing'};
/** A Hiscores activity's collection log group: its own page, its alias, or the raid or clue tier it is a mode of. */
function logGroup(activity:string):GuideCategory|undefined{
 if(/^clue scrolls/i.test(activity.trim()))return 'clues';
 const key=logKey(activity).replace(/:\s*(challenge|hard|expert) mode$/,'');
 return LOG_PAGES.get(LOG_ALIAS[key]??key);
}
const TOPIC_BY_NAME=new Map(guideTopics.map(t=>[t.name.toLowerCase(),t]));
/** The topic a guide is about (its icon and, for a quest, its difficulty), when it is one the topic picker offers. */
export function guideTopic(activity:string):GuideTopic|undefined{return TOPIC_BY_NAME.get(activity.trim().toLowerCase());}
/** A guide's group from its topic: quests, diaries, combat achievements and skills by the game's own lists, then the collection
 * log tab of the boss, raid, clue or minigame. Anything else (older or test topics) is Other. */
export function guideCategory(activity:string):GuideCategory{
 const t=guideTopic(activity);
 if(t?.detail==='Achievement diary')return 'diaries';
 if(t?.detail==='Combat achievements')return 'combat-achievements';
 if(t?.image.endsWith('quest-point-icon.png'))return 'quests';
 if(t&&SKILLS.includes(t.name))return 'skilling';
 return logGroup(activity)??'other';
}
/** Hiscores activities the topic picker offers that have no collection log group (checked by a test so new bosses get one). */
export function ungroupedActivities(){return (activities as string[]).flatMap(source=>{const name=Object.hasOwn(RENAME,source)?RENAME[source]:source;return name&&name!=='Collection log'&&!logGroup(name)?[name]:[];});}
