import {GUIDE_SKILLS,guideItemChoices,guideItemImage,guideQuests} from './guides';
import {wiki} from './ui';
import {GUIDE_TRAVEL,foldTravel,guideTravel,isFairyCode,travelIcon,travelLabel,travelWhat,type GuideTravel} from './guide-travel';

/** Game terms a guide can link inline as [[Name]]: each shows its icon and opens its OSRS Wiki page. A travel reference
 * (a teleport, fairy ring code or transport stop, lib/guide-travel) carries the destination's name in the travel data
 * (`travel`) for its hover card, and what it is (`detail`) for the editor's search. */
export type GuideReferenceKind='skill'|'prayer'|'spell'|'quest'|'item'|'travel'|'term';
export type GuideReference={name:string;kind:GuideReferenceKind;icon:string|null;href:string;itemId?:string;travel?:{kind:GuideTravel['kind'];name:string};detail?:string};

export const GUIDE_PRAYERS=['Thick Skin','Burst of Strength','Clarity of Thought','Sharp Eye','Mystic Will','Rock Skin','Superhuman Strength','Improved Reflexes','Rapid Restore','Rapid Heal','Protect Item','Hawk Eye','Mystic Lore','Steel Skin','Ultimate Strength','Incredible Reflexes','Protect from Magic','Protect from Missiles','Protect from Melee','Eagle Eye','Mystic Might','Retribution','Redemption','Smite','Preserve','Chivalry','Piety','Rigour','Augury'];
/** Spells guides name: standard, ancient, lunar and arceuus combat, utility and teleport spells. */
export const GUIDE_SPELLS=['Wind Strike','Water Strike','Earth Strike','Fire Strike','Wind Bolt','Water Bolt','Earth Bolt','Fire Bolt','Wind Blast','Water Blast','Earth Blast','Fire Blast','Wind Wave','Water Wave','Earth Wave','Fire Wave','Wind Surge','Water Surge','Earth Surge','Fire Surge','Crumble Undead','Iban Blast','Magic Dart','Saradomin Strike','Claws of Guthix','Flames of Zamorak','Confuse','Weaken','Curse','Bind','Snare','Entangle','Vulnerability','Enfeeble','Stun','Tele Block','High Level Alchemy','Low Level Alchemy','Superheat Item','Charge','Smoke Rush','Shadow Rush','Blood Rush','Ice Rush','Smoke Burst','Shadow Burst','Blood Burst','Ice Burst','Smoke Blitz','Shadow Blitz','Blood Blitz','Ice Blitz','Smoke Barrage','Shadow Barrage','Blood Barrage','Ice Barrage','Vengeance','Vengeance Other','Heal Other','Spellbook Swap','Humidify','Plank Make','NPC Contact','Death Charge','Thrall','Resurrect Greater Ghost','Resurrect Greater Skeleton','Resurrect Greater Zombie','Mark of Darkness','Shadow Veil','Ward of Arceuus','Varrock Teleport','Lumbridge Teleport','Falador Teleport','Camelot Teleport','Ardougne Teleport','Teleport to House','Kourend Castle Teleport','Ape Atoll Teleport','Paddewwa Teleport','Lassar Teleport','Dareeyak Teleport','Carrallangar Teleport','Annakarl Teleport','Ghorrock Teleport','Moonclan Teleport','Waterbirth Teleport','Catherby Teleport','Fishing Guild Teleport','Ourania Teleport','Barbarian Teleport','Telekinetic Grab','Bones to Bananas','Bones to Peaches','Lvl-1 Enchant','Lvl-2 Enchant','Lvl-3 Enchant','Lvl-4 Enchant','Lvl-5 Enchant','Lvl-6 Enchant','Lvl-7 Enchant','Enchant Crossbow Bolt','Charge Water Orb','Charge Earth Orb','Charge Fire Orb','Charge Air Orb','Lumbridge Home Teleport','Watchtower Teleport','Trollheim Teleport','Civitas illa Fortis Teleport','Teleport to Target','Senntisten Teleport','Kharyrll Teleport','Khazard Teleport','Ice Plateau Teleport','Cure Me','Cure Other','Cure Group','Heal Group','Energy Transfer','Superglass Make','String Jewellery','Tan Leather','Spin Flax','Fertile Soil','Stat Spy','Monster Examine','Magic Imbue','Geomancy','Bake Pie','Recharge Dragonstone','Arceuus Library Teleport','Draynor Manor Teleport','Salve Graveyard Teleport','Mind Altar Teleport','Respawn Teleport','Fenkenstrain\'s Castle Teleport','West Ardougne Teleport','Harmony Island Teleport','Barrows Teleport','Cemetery Teleport','Basic Reanimation','Adept Reanimation','Expert Reanimation','Master Reanimation','Resurrect Crops','Ghostly Grasp','Skeletal Grasp','Undead Grasp','Inferior Demonbane','Superior Demonbane','Dark Demonbane','Lesser Corruption','Greater Corruption','Demonic Offering','Sinister Offering','Dark Lure','Vile Vigour','Degrime','Resurrect Lesser Ghost','Resurrect Lesser Skeleton','Resurrect Lesser Zombie','Resurrect Superior Ghost','Resurrect Superior Skeleton','Resurrect Superior Zombie'];
/** Each prayer's prayer-book icon (public/icons/prayers). */
const iconFile=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const PRAYER_ICONS:Record<string,string>=Object.fromEntries(GUIDE_PRAYERS.map(n=>[n,`/icons/prayers/${iconFile(n)}.png`]));
/** A thrall is summoned by the Resurrect spells; it borrows Resurrect Greater Ghost's icon. */
const SPELL_ICON_ALIAS:Record<string,string>={Thrall:'Resurrect Greater Ghost'};
/** Each spell's spellbook icon (public/icons/spells, decoded from the game cache); the Magic icon for any without one. */
export function guideSpellIcon(name:string){const spell=find(GUIDE_SPELLS,name);return spell?`/icons/spells/${iconFile(SPELL_ICON_ALIAS[spell]??spell)}.png`:'/icons/skills/magic.png';}

let items:Map<string,string>|undefined;
/** Lower-case item name to the item with its own icon. */
function itemByName(name:string){items??=new Map(guideItemChoices.map(([id,label])=>[label.toLowerCase(),id]));return items.get(name.toLowerCase());}
const find=(list:readonly string[],name:string)=>list.find(x=>x.toLowerCase()===name.toLowerCase());

/** Spell names the travel data spells its own way. */
const TRAVEL_SPELL_ALIAS:Record<string,string>={'Carrallangar Teleport':'Carrallanger Teleport'};
/** A travel destination as a reference, under the name the guide shows: a spell keeps its spellbook icon and Wiki page,
 * a fairy ring code shows in capitals, a teleport opens its item's page and a transport stop its network's. */
function travelReference(name:string,t:GuideTravel):GuideReference{
 const page=t.kind==='spell'?name:t.kind==='teleport'?t.name.split(':')[0].trim():t.kind==='fairy'?'Fairy rings':t.via;
 const detail=t.kind==='fairy'&&t.area?`${t.via} · ${t.area}`:travelWhat(t);
 return {name,kind:'travel',icon:t.kind==='spell'?guideSpellIcon(name):travelIcon(t),href:wiki(page),travel:{kind:t.kind,name:t.name},detail};
}

export function guideReference(raw:string):GuideReference{
 const name=raw.trim();
 // Experience gets the skills icon and the Wiki's Experience page: [[XP]] or [[Experience]].
 if(/^(xp|experience)$/i.test(name))return {name,kind:'term',icon:'/icons/navigation/skills-icon.png',href:wiki('Experience')};
 const skill=find(GUIDE_SKILLS,name);if(skill)return {name:skill,kind:'skill',icon:`/icons/skills/${skill.toLowerCase()}.png`,href:wiki(skill)};
 const prayer=find(GUIDE_PRAYERS,name);if(prayer)return {name:prayer,kind:'prayer',icon:PRAYER_ICONS[prayer]??'/icons/skills/prayer.png',href:wiki(prayer)};
 // Teleport spells, fairy ring codes and transport stops are travel: their card shows where they land.
 const spell=find(GUIDE_SPELLS,name),travel=guideTravel(spell?TRAVEL_SPELL_ALIAS[spell]??spell:name);
 if(travel&&travel.kind!=='teleport')return travelReference(spell??(isFairyCode(name)?name.toUpperCase():name),travel);
 if(spell)return {name:spell,kind:'spell',icon:guideSpellIcon(spell),href:wiki(spell)};
 const quest=find(guideQuests,name);if(quest)return {name:quest,kind:'quest',icon:'/ui/quest-point-icon.png',href:wiki(quest)};
 // An item keeps its price card even where it is also a teleport's name (Amulet of the eye, Ectophial).
 const item=itemByName(name);if(item)return {name,kind:'item',icon:guideItemImage(item),href:wiki(name),itemId:item};
 if(travel)return travelReference(travel.name,travel);
 return {name,kind:'term',icon:null,href:wiki(name)};
}

let travelNames:{label:string;also:string;teleport:boolean}[]|undefined;
/** Travel destinations the editor offers beyond the spells: fairy ring codes, transport stops and teleports, each with
 * the area it lands in to search by too ("tzhaar" finds BLP). Teleports named like an item stay that item, and the rest
 * (hundreds of jewellery, cape and scroll destinations) rank just after the items matching as well. */
const travelChoices=()=>travelNames??=GUIDE_TRAVEL.filter(t=>t.kind!=='spell'&&!(t.kind==='teleport'&&itemByName(t.name))).map(t=>({label:travelLabel(t),also:foldTravel(t.area),teleport:t.kind==='teleport'}));

/** Picker results for the editor: skills, prayers, spells, quests, travel, then items, best matches first. */
export function searchGuideReferences(query:string,limit=40):GuideReference[]{
 const q=query.trim().toLowerCase();if(!q)return [];
 const rank=(n:string)=>{const l=n.toLowerCase();return l===q?0:l.startsWith(q)?1:l.includes(q)?2:9;};
 const fq=foldTravel(q),travelRank=(t:{label:string;also:string;teleport:boolean})=>{const r=Math.min(rank(t.label),fq&&t.also.includes(fq)?2:9);return r<9&&t.teleport?r+2.5:r;};
 const travel=travelChoices().filter(t=>travelRank(t)<9).sort((a,b)=>travelRank(a)-travelRank(b)).slice(0,limit).map(t=>({ref:guideReference(t.label),r:travelRank(t)}));
 const named=[...GUIDE_SKILLS,...GUIDE_PRAYERS,...GUIDE_SPELLS,...guideQuests].filter(n=>rank(n)<9).sort((a,b)=>rank(a)-rank(b)).slice(0,limit).map(n=>({ref:guideReference(n),r:rank(n)}));
 const both=[...named,...travel].sort((a,b)=>a.r-b.r).slice(0,limit);
 const found=guideItemChoices.filter(([,n])=>rank(n)<9).sort((a,b)=>rank(a[1])-rank(b[1])).slice(0,Math.max(0,limit-both.length)).map(([,n])=>({ref:guideReference(n),r:rank(n)}));
 // The sort is stable: within a rank, skills, prayers, spells and quests come first, then travel, then items.
 return [...both,...found].sort((a,b)=>a.r-b.r).map(x=>x.ref);
}
