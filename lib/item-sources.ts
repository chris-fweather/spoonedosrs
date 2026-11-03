// Where an untradeable item comes from, for the item price card: it has no Grand Exchange price, so the card says how
// you get it instead. Achievement diary rewards are one item per area, numbered by tier ("Fremennik sea boots 4").
const DIARY_REWARDS:Record<string,string>={
 'Ardougne cloak':'Ardougne','Desert amulet':'Desert','Falador shield':'Falador','Fremennik sea boots':'Fremennik',
 'Kandarin headgear':'Kandarin','Karamja gloves':'Karamja',"Rada's blessing":'Kourend & Kebos',"Explorer's ring":'Lumbridge & Draynor',
 'Morytania legs':'Morytania','Varrock armour':'Varrock','Western banner':'Western Provinces','Wilderness sword':'Wilderness',
};
const TIERS=['Easy','Medium','Hard','Elite'] as const;
export type ItemSource={kind:'diary';area:string;tier:typeof TIERS[number]};
/** How an untradeable item is obtained, from its name, or null when we don't know. */
export function itemSource(name:string|undefined):ItemSource|null{
 const m=name?/^(.+) ([1-4])$/.exec(name):null,area=m&&Object.hasOwn(DIARY_REWARDS,m[1])?DIARY_REWARDS[m[1]]:null;
 return area?{kind:'diary',area,tier:TIERS[Number(m![2])-1]}:null;
}
