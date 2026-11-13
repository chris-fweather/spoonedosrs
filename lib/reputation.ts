export type Reputation = {
  networkUsed?: boolean;
  canVote?: boolean;
  /** Everything shown on the profile: respect from visitors plus thumbs up on the guides this player wrote. */
  count: number;
  /** The part of `count` from thumbs up on their guides (staff-only guides included). */
  guideCount?: number;
  given: boolean;
  signedIn: boolean;
  ownProfile: boolean;
  available: boolean;
};

// A player may commend each of their own linked names once, like any other giver: the
// one-per-account and one-per-network limits on the profile still apply.
export function canGiveRespect(rep: Reputation): boolean {
  return !rep.given && rep.available && rep.canVote !== false && rep.networkUsed !== true;
}

export function reputationHint(rep: Reputation): string {
  if (rep.given) return rep.ownProfile ? 'You gave yourself respect. Click to undo.' : 'You gave respect. Click to undo.';
  if (!rep.available) return 'This player needs a saved journal before receiving respect.';
  if(rep.canVote===false)return 'Your connection could not be verified. Please retry.';
  if(rep.networkUsed)return 'This connection has already commended this profile.';
  if (rep.ownProfile) return 'Give yourself respect: one +1 on each of your linked names.';
  return 'Give respect. One +1 per connection on this profile; no sign-in needed.';
}

/** "12 respect · 4 from guides": the profile's total with the part from guide thumbs up, which shows only when there is one. */
export function reputationSummary(rep: Pick<Reputation, 'count' | 'guideCount'>, format: (n: number) => string = String): string {
  const total = `${format(rep.count)} respect`;
  return rep.guideCount ? `${total} · ${format(rep.guideCount)} from guides` : total;
}
