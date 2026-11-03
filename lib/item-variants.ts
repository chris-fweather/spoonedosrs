/** Wearable versions a collection log item lets a player show on their character.
 *
 * - A broken or damaged log item can be worn once fixed, so it unlocks the fixed item (damaged Torva → Torva).
 * - Anything that only changes an item's look (ornament kit, colour kit, dye, paint, mutagen, mounted head, quartz,
 *   marks of grace for the Kourend graceful colours) keeps the normal item available and adds the recoloured one, so it
 *   unlocks both (Sanguine ornament kit → Torva and Sanguine torva; Kbd heads → Slayer helmet and Black slayer helmet).
 * - An upgrade that changes the look as well as the stats unlocks the upgraded item only when the log also has the item
 *   it upgrades (Nightmare staff + Eldritch orb → Eldritch nightmare staff).
 * - Versions of one item are shown as one choice with a Styles row in the outfit picker (styleGroups).
 *
 * Only real OSRS pairs, by item id. Every id here has a worn model in public/models/look (checked by
 * lib/item-variants.test.ts). Some recoloured items share their in-game name with the normal one; VARIANT_NAMES tells
 * them apart in the outfit picker. */

/** Broken or damaged log item → the item it becomes when fixed. */
export const FIXED_FROM:Record<string,string[]>={
 '26376':['26382'], // Torva full helm (damaged) → Torva full helm
 '26378':['26384'], // Torva platebody (damaged) → Torva platebody
 '26380':['26386'], // Torva platelegs (damaged) → Torva platelegs
 '27695':['11920'], // Dragon pickaxe (broken) → Dragon pickaxe
 '22963':['22731'], // Broken dragon hasta → Dragon hasta
 '28813':['28810'], // Broken zombie axe → Zombie axe
 '30324':['30321'], // Broken zombie helmet → Zombie helmet
};

/** Graceful pieces in slot order hood, cape, top, legs, gloves, boots. */
type GracefulSet=readonly [string,string,string,string,string,string];
const GRACEFUL:GracefulSet=['11850','11852','11854','11856','11858','11860'];
/** Osten in Kourend recolours each piece for marks of grace: one colour per house and Kourend for all of them. Each
 * colour's six pieces follow its hood id (inventory ids; the worn copies in between are skipped). */
const GRACEFUL_HOUSES:[string,string][]=[['Arceuus','13579'],['Piscarilius','13591'],['Lovakengj','13603'],['Shayzien','13615'],['Hosidius','13627'],['Kourend','13667']];
const KOUREND_SET=(hood:string):GracefulSet=>[0,2,4,6,8,10].map(step=>String(+hood+step)) as unknown as GracefulSet;
const HALLOWED_GRACEFUL:GracefulSet=['24743','24746','24749','24752','24755','24758'];
/** Recoloured graceful that is its own collection log item: grouped with normal graceful in the picker only. */
const ARENA_GRACEFUL:GracefulSet=['21061','21064','21067','21070','21073','21076'];
const VARLAMORE_GRACEFUL:GracefulSet=['30045','30048','30051','30054','30057','30060'];
const gracefulPairs=(normal:GracefulSet,colour:GracefulSet):[string,string][]=>normal.map((id,i)=>[id,colour[i]]);
const GRACEFUL_PIECES=['hood','cape','top','legs','gloves','boots'];
/** Prospector kit pieces helmet, jacket, legs, boots → their golden recolours. */
const GOLDEN_PROSPECTOR:[string,string][]=[['12013','25549'],['12014','25551'],['12015','25553'],['12016','25555']];
/** Each boss head's slayer helmet colour also unlocks the plain slayer helmet and its imbued look (anyone can imbue
 * it; the coloured (i) helmets look the same as the plain coloured ones, so only the plain (i) is its own style). */
const slayerHelmet=(colour:string):[string,string][]=>[['11864',colour],['11864','11865']];
const gracefulNames=(set:GracefulSet,colour:string)=>Object.fromEntries(set.map((id,i)=>[id,`Graceful ${GRACEFUL_PIECES[i]} (${colour})`]));

/** Kit, dye or paint → [normal item, recoloured item] pairs it applies to. Owning the kit unlocks both sides. */
export const KIT_PAIRS:Record<string,[string,string][]>={
 '25744':[['22325','25739'],['26382','28254'],['26384','28256'],['26386','28258']], // Sanguine ornament kit: Scythe of vitur, Torva
 '25742':[['22325','25736'],['22323','25731'],['22324','25734']], // Holy ornament kit: Scythe, Sanguinesti staff, Ghrazi rapier
 '24670':[['21018','24664'],['21021','24666'],['21024','24668']], // Twisted ancestral colour kit
 '27255':[['27251','27253']], // Menaphite ornament kit: Elidinis' ward (f) → (or)
 '26811':[['26850','26858'],['26852','26860'],['26854','26862']], // Abyssal red dye: Raiments of the Eye
 '26807':[['26850','26864'],['26852','26866'],['26854','26868']], // Abyssal green dye
 '26809':[['26850','26870'],['26852','26872'],['26854','26874']], // Abyssal blue dye
 '23321':[['1333','23330']], // Rune scimitar ornament kit (guthix)
 '23324':[['1333','23332']], // Rune scimitar ornament kit (saradomin)
 '23327':[['1333','23334']], // Rune scimitar ornament kit (zamorak)
 '22231':[['11840','22234']], // Dragon boots ornament kit
 '23227':[['8850','23230']], // Rune defender ornament kit
 '23232':[['6528','23235']], // Tzhaar-ket-om ornament kit
 '23237':[['11128','23240']], // Berserker necklace ornament kit
 '12526':[['6585','12436']], // Fury ornament kit
 '12534':[['3140','12414']], // Dragon chainbody ornament kit
 '12536':[['4087','12415'],['4585','12416']], // Dragon legs/skirt ornament kit
 '12532':[['1187','12418']], // Dragon sq shield ornament kit
 '12538':[['11335','12417']], // Dragon full helm ornament kit
 '20002':[['4587','20000']], // Dragon scimitar ornament kit
 '12530':[['6918','12419'],['6916','12420'],['6924','12421']], // Light infinity colour kit
 '12528':[['6918','12457'],['6916','12458'],['6924','12459']], // Dark infinity colour kit
 '20068':[['11802','20368']], // Armadyl godsword ornament kit
 '20071':[['11804','20370']], // Bandos godsword ornament kit
 '20074':[['11806','20372']], // Saradomin godsword ornament kit
 '20077':[['11808','20374']], // Zamorak godsword ornament kit
 '20065':[['12002','19720']], // Occult ornament kit
 '20062':[['19553','20366']], // Torture ornament kit
 '22246':[['19547','22249']], // Anguish ornament kit
 '20143':[['12954','19722']], // Dragon defender ornament kit
 '22239':[['21895','22244']], // Dragon kiteshield ornament kit
 '22236':[['21892','22242']], // Dragon platebody ornament kit
 '23348':[['19544','23444']], // Tormented ornament kit
 '12757':[['11235','12766']], // Blue dark bow paint
 '12759':[['11235','12765']], // Green dark bow paint
 '12761':[['11235','12767']], // Yellow dark bow paint
 '12763':[['11235','12768']], // White dark bow paint
 '12798':[['11787','12795']], // Steam staff upgrade kit
 '21202':[['3053','21198']], // Lava staff upgrade kit
 '12800':[['11920','12797']], // Dragon pickaxe upgrade kit
 '12802':[['11924','12806'],['11926','12807']], // Ward upgrade kit: Malediction and Odium wards
 '12771':[['4151','12773']], // Volcanic whip mix
 '12769':[['4151','12774']], // Frozen whip mix
 '13200':[['12931','13197']], // Tanzanite mutagen: Serpentine helm → Tanzanite helm
 '13201':[['12931','13199']], // Magma mutagen: Serpentine helm → Magma helm
 '7980':[...slayerHelmet('19639'),['21012','25918']], // Kbd heads: Black slayer helmet, Dragon hunter crossbow (b)
 '7981':slayerHelmet('19643'), // Kq head: Green slayer helmet
 '7979':slayerHelmet('19647'), // Abyssal head: Red slayer helmet
 '21275':slayerHelmet('21264'), // Dark claw: Purple slayer helmet
 '21907':[...slayerHelmet('21888'),['21012','25916']], // Vorkath's head: Turquoise slayer helmet, Dragon hunter crossbow (t)
 '23077':slayerHelmet('23073'), // Alchemical hydra heads: Hydra slayer helmet
 '29788':slayerHelmet('29816'), // Araxyte head: Araxyte slayer helmet
 '28268':[['27624','28260']], // Blood quartz: Blood ancient sceptre
 '28270':[['27624','28262']], // Ice quartz: Ice ancient sceptre
 '28274':[['27624','28264']], // Smoke quartz: Smoke ancient sceptre
 '28272':[['27624','28266']], // Shadow quartz: Shadow ancient sceptre
 '27248':[['26219','27246']], // Cursed phalanx: Osmumten's fang (or)
 '24229':[['4153','24225']], // Ornate maul handle: Granite maul (ornate handle)
 '11849':GRACEFUL_HOUSES.flatMap(([,first])=>gracefulPairs(GRACEFUL,KOUREND_SET(first))), // Mark of grace: Kourend house and Kourend colours
 '24729':gracefulPairs(GRACEFUL,HALLOWED_GRACEFUL), // Dark dye: Hallowed graceful
 '25547':GOLDEN_PROSPECTOR, // Star fragment: Golden prospector kit
};

/** Upgrades that change the look as well as the stats. The result is unlocked only when the log (or a fixed broken
 * item) has every item in `needs`: the base item and what upgrades it. */
export const UPGRADES:{needs:string[];gives:string}[]=[
 {needs:['24422','24511'],gives:'24423'}, // Nightmare staff + Harmonised orb → Harmonised nightmare staff
 {needs:['24422','24514'],gives:'24424'}, // + Volatile orb → Volatile nightmare staff
 {needs:['24422','24517'],gives:'24425'}, // + Eldritch orb → Eldritch nightmare staff
 {needs:['4151','12004'],gives:'12006'}, // Abyssal whip + Kraken tentacle → Abyssal tentacle
 {needs:['11791','12932'],gives:'12904'}, // Staff of the dead + Magic fang → Toxic staff of the dead
 {needs:['11905','12932'],gives:'12899'}, // Trident of the seas (full) + Magic fang → Trident of the swamp
 {needs:['11908','12932'],gives:'12899'}, // Uncharged trident + Magic fang → Trident of the swamp
 {needs:['11920','13233'],gives:'13243'}, // Dragon pickaxe + Smouldering stone → Infernal pickaxe
 {needs:['6739','13233'],gives:'13241'}, // Dragon axe + Smouldering stone → Infernal axe
 {needs:['21028','13233'],gives:'21031'}, // Dragon harpoon + Smouldering stone → Infernal harpoon
 {needs:['2577','13229'],gives:'13237'}, // Ranger boots + Pegasian crystal → Pegasian boots
 {needs:['6920','13227'],gives:'13235'}, // Infinity boots + Eternal crystal → Eternal boots
 {needs:['11840','13231'],gives:'13239'}, // Dragon boots + Primordial crystal → Primordial boots
 {needs:['12829','12833'],gives:'12831'}, // Spirit shield + Holy elixir → Blessed spirit shield
 {needs:['12829','12833','12819'],gives:'12817'}, // + Elysian sigil → Elysian spirit shield
 {needs:['12829','12833','12823'],gives:'12821'}, // + Spectral sigil → Spectral spirit shield
 {needs:['12829','12833','12827'],gives:'12825'}, // + Arcane sigil → Arcane spirit shield
 {needs:['12954','22477'],gives:'22322'}, // Dragon defender + Avernic defender hilt → Avernic defender
 {needs:['11785','26372'],gives:'26374'}, // Armadyl crossbow + Nihil horn → Zaryte crossbow
 {needs:['11824','22966'],gives:'22978'}, // Zamorakian spear (as a hasta) + Hydra's claw → Dragon hunter lance
];

/** Recoloured items that are their own collection log items: [normal, recoloured], grouped as styles only. */
export const STYLE_PAIRS:[string,string][]=[...gracefulPairs(GRACEFUL,ARENA_GRACEFUL),...gracefulPairs(GRACEFUL,VARLAMORE_GRACEFUL)];

/** Picker names for recoloured items whose cache name repeats the normal item's. */
export const VARIANT_NAMES:Record<string,string>={
 '23330':'Rune scimitar (guthix)','23332':'Rune scimitar (saradomin)','23334':'Rune scimitar (zamorak)',
 '12765':'Dark bow (green)','12766':'Dark bow (blue)','12767':'Dark bow (yellow)','12768':'Dark bow (white)',
 '12795':'Steam battlestaff (or)','21198':'Lava battlestaff (or)','12797':'Dragon pickaxe (or)',
 '12806':'Malediction ward (or)','12807':'Odium ward (or)','24225':'Granite maul (or)',
 ...Object.assign({},...GRACEFUL_HOUSES.map(([house,hood])=>gracefulNames(KOUREND_SET(hood),house))),
 ...gracefulNames(HALLOWED_GRACEFUL,'Hallowed'),...gracefulNames(ARENA_GRACEFUL,'Agility Arena'),...gracefulNames(VARLAMORE_GRACEFUL,'Varlamore'),
};

/** Every item id the owned log items let a player wear: the items themselves, fixed versions of broken ones,
 * upgrades whose parts are all owned, and both sides of every kit they own. */
export function wearableUnlocks(owned:Iterable<string>):Set<string> {
 const ids=new Set(owned);
 for(const id of [...ids])for(const fixed of FIXED_FROM[id]??[])ids.add(fixed);
 const have=new Set(ids);
 for(const {needs,gives} of UPGRADES)if(needs.every(id=>have.has(id)))ids.add(gives);
 for(const id of have)for(const pair of KIT_PAIRS[id]??[])for(const item of pair)ids.add(item);
 return ids;
}

/** Recoloured item → the normal item it is a style of. */
const STYLE_ROOT:Record<string,string>=Object.fromEntries([...Object.values(KIT_PAIRS).flat(),...STYLE_PAIRS].map(([normal,styled])=>[styled,normal]));
/** Clue-scroll trims of one item: "Rune platebody (g)", "(t)" and "(h1)"–"(h5)" are styles of "Rune platebody". */
const TRIM=/ \((g|t|h[1-5])\)$/;

/** Group key: items with the same key are styles of one item. */
export function styleKey(id:string,name:(id:string)=>string):string {
 const root=STYLE_ROOT[id];
 return (root?name(root):name(id).replace(TRIM,'')).toLowerCase();
}

/** Owned items in picker order, each with the other styles of the same item. The first item of a group is the normal
 * one when it is owned. */
export function styleGroups<T extends {id:string;name:string}>(items:T[],name:(id:string)=>string):T[][] {
 const groups=new Map<string,T[]>();
 for(const item of items){const key=styleKey(item.id,name);groups.set(key,[...groups.get(key)??[],item]);}
 // Different items that share a cache name (the Castle Wars decorative armour colours) stay separate choices.
 return [...groups.entries()].flatMap(([key,group])=>new Set(group.map(item=>item.name)).size<group.length?group.map(item=>[item]):[[...group].sort((a,b)=>rank(a,key)-rank(b,key))]);
 function rank(item:T,key:string){return name(item.id).toLowerCase()===key?0:1;}
}

const TRIM_LABEL:Record<string,string>={g:'Gold (g)',t:'Trimmed (t)',or:'Ornament (or)',h1:'Heraldic (h1)',h2:'Heraldic (h2)',h3:'Heraldic (h3)',h4:'Heraldic (h4)',h5:'Heraldic (h5)',f:'Standard'};
/** Styles whose suffix means something else than a clue trim. */
const STYLE_LABELS:Record<string,string>={'25916':'Vorkath (t)','25918':'King Black Dragon (b)','11865':'Slayer (i)'};
const sentence=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);

/** Short Styles-row labels for one styleGroups group: "Torva" and "Sanguine torva" for the Torva full helms,
 * "Standard" and "Arceuus" for graceful hoods, "Gold (g)" for a gold-trimmed piece. */
export function styleLabels(items:{id:string;name:string}[]):string[] {
 const names=items.map(item=>item.name);
 const base=names.find(n=>!/\)$/.test(n))?.replace(/ \(.*\)$/,'')??names[0].replace(/ \([^)]*\)$/,'');
 // A name that is the base plus a suffix ("Slayer helmet (i)", "Rune platebody (g)") is labelled by its suffix.
 const suffixed=(n:string)=>{const suffix=/ \(([^)]+)\)$/.exec(n);return suffix&&n.slice(0,suffix.index).toLowerCase()===base.toLowerCase()?suffix[1]:null;};
 // Common trailing words are cut from the other names ("Black slayer helmet" → "Black slayer").
 const words=names.map(n=>n.split(' '));
 const plain=words.filter((w,i)=>!suffixed(names[i])&&!STYLE_LABELS[items[i].id]);
 let tail=0;
 while(plain.length&&plain.every(w=>w.length-tail>1&&w[w.length-1-tail].toLowerCase()===plain[0][plain[0].length-1-tail].toLowerCase()))tail++;
 const labels=names.map((n,i)=>{
  if(STYLE_LABELS[items[i].id])return STYLE_LABELS[items[i].id];
  const suffix=suffixed(n);
  if(suffix)return TRIM_LABEL[suffix.toLowerCase()]??sentence(suffix);
  // The normal item reads "Standard" when the others are all suffixed forms of it (graceful colours, trims).
  if(names.length>1&&n.toLowerCase()===base.toLowerCase()&&names.every((other,j)=>j===i||STYLE_LABELS[items[j].id]||suffixed(other)))return 'Standard';
  return sentence(words[i].slice(0,words[i].length-tail).join(' '));
 });
 return new Set(labels).size===labels.length?labels:names;
}
