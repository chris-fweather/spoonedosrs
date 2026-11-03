/** Exact below a million, then 12.45M and 1.2B, so a price card stays one line per value. */
export function cardGp(n:number|null){return n===null?'—':n>=1e9?`${+(n/1e9).toFixed(2)}B`:n>=1e6?`${+(n/1e6).toFixed(2)}M`:Math.round(n).toLocaleString('en-US');}
/** The value of a stack: unit price × quantity, or null when the unit price is unknown. */
export function stackValue(unit:number|null|undefined,quantity:number){return unit==null||!Number.isFinite(unit)?null:unit*Math.max(1,Math.floor(quantity));}
/** The unit price under a stack's total, such as "136 each". Null for a single item or an unknown price. */
export function eachLine(unit:number|null|undefined,quantity:number){
 return Math.floor(quantity)>1&&unit!=null&&Number.isFinite(unit)?`${cardGp(unit)} each`:null;
}
/** What a price card shows for one value: the stack's total big and the unit price small, or the unit price alone for one item. */
export function cardValue(unit:number|null|undefined,quantity:number):{big:string;each:string|null}{
 const each=eachLine(unit,quantity);return {big:cardGp(each?stackValue(unit,quantity):unit??null),each};
}
