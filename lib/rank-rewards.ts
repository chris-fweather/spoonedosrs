import type {Journal} from './model';
export function rankTier(rank:number):'champion'|'gold'|'silver'|'bronze'|null {
 if(!Number.isInteger(rank)||rank<1)return null;
 return rank===1?'champion':rank<=10?'gold':rank<=100?'silver':rank<=1000?'bronze':null;
}
/** Titles for an official hiscores rank, best first. A player holds only the best tier they reach for each boss,
 * activity or skill. Colours (lib/presentation.ts titleRarity): Champion legendary, Grandmaster red with a glow,
 * Expert blue, Elite green. The ids `first` and `elite` are kept from the first two tiers. A Master tier (#11–100)
 * was dropped before release: Grandmaster covers it, and a saved `master` choice reads as Grandmaster
 * (currentRankChoice). */
export const RANK_TITLE_TIERS=[
 {id:'first',noun:'Champion',best:1,worst:1},
 {id:'grandmaster',noun:'Grandmaster',best:2,worst:100},
 {id:'expert',noun:'Expert',best:101,worst:500},
 {id:'elite',noun:'Elite',best:501,worst:1000},
] as const;
export const RANK_TITLE_NOUNS=RANK_TITLE_TIERS.map(t=>t.noun);
export function rankTitleTier(rank:number){
 return Number.isInteger(rank)&&rank>=1?RANK_TITLE_TIERS.find(t=>rank<=t.worst)??null:null;
}
const range=(t:(typeof RANK_TITLE_TIERS)[number])=>t.best===t.worst?`Rank #${t.best}`:t.best===1?`Top ${t.worst.toLocaleString('en-US')}`:`Rank #${t.best.toLocaleString('en-US')}–${t.worst.toLocaleString('en-US')}`;
/** What a rank title asks for, from its tier noun: short enough to read on one line of a hover card. */
export function rankTitleRequirement(noun:string,name:string){
 const tier=RANK_TITLE_TIERS.find(t=>t.noun===noun);if(!tier)return null;
 return `${range(tier)} in ${name}`;
}
const titleKey=(name:string)=>encodeURIComponent(name.toLowerCase());
/** Boss, activity and skill rank titles from the latest synced hiscores. Overall is left out. */
export function rankTitles(j:Journal){
 const rows=[...j.hiscores.activities,...j.hiscores.skills.filter(s=>s.name!=='Overall')];
 return rows.flatMap(r=>{
  const tier=rankTitleTier(r.rank);if(!tier)return [];
  return [{id:`hiscore:${titleKey(r.name)}:${tier.id}`,label:`the ${r.name} ${tier.noun}`,unlocked:true,requirement:rankTitleRequirement(tier.noun,r.name)!}];
 });
}
/** A saved rank title follows the player's rank: a choice saved at one tier shows the tier they hold today for the
 * same boss or skill (an Elite who climbs to #45 shows Grandmaster), or nothing once they drop out of the top 1,000.
 * A choice saved at the retired Master tier stands for Grandmaster. */
export function currentRankChoice(j:Journal,choice:string){
 const saved=choice.match(/^hiscore:(.+):([a-z]+)$/);if(!saved)return choice;
 return rankTitles(j).find(t=>t.id.startsWith(`hiscore:${saved[1]}:`))?.id??(saved[2]==='master'?`hiscore:${saved[1]}:grandmaster`:choice);
}
