/** Hover cards (app/HoverTip.tsx) share these rules, site-wide:
 * - One card at a time: opening a card closes the open one at once, without its close delay, so moving from one
 *   requirement row straight to the next never leaves two cards stacked on top of each other.
 * - A card with links in it (an `interactive` one) lets the pointer pass through it until the pointer travels into it
 *   from its own trigger. A card that happens to cover a neighbouring trigger (the next row, the next line's chip)
 *   therefore never hides that trigger: pointing at the neighbour opens the neighbour's card instead. */
export type OpenTip = {close: () => void};
let open: OpenTip | null = null;

/** Marks `tip` as the open card, closing any other open card first. */
export function claimTip(tip: OpenTip) {
  if (open && open !== tip) {
    const previous = open;
    open = null;
    previous.close();
  }
  open = tip;
}
/** `tip` closed (or unmounted): it is no longer the open card. */
export function releaseTip(tip: OpenTip) {
  if (open === tip) open = null;
}
/** The open card, for tests. */
export const openTip = () => open;

type Rect = {left: number; top: number; right: number; bottom: number};
/** Whether an interactive card starts taking the pointer: the pointer is inside the card, it came straight from the
 * card's own trigger (still hovered, or left within the close delay), and it is not over another card's trigger
 * underneath (that trigger wins). */
export function tipTakesPointer(point: {x: number; y: number}, card: Rect, {fromTrigger, overOtherTrigger}: {fromTrigger: boolean; overOtherTrigger: boolean}) {
  const inside = point.x >= card.left && point.x <= card.right && point.y >= card.top && point.y <= card.bottom;
  return inside && fromTrigger && !overOtherTrigger;
}
