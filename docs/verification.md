# Verified profiles

A profile is **verified** when its RuneScape name is linked to a Discord account **and** that same Discord
account proved the game account through the RuneLite plugin under this name. Proof is a row in
`plugin_account_owners` (migration `0036`, see `docs/plugin-hub-submission.md` → Plugin-verified characters)
whose current `rsn` is the profile's name and whose `discord_id` is the name's link.

| Case | Verified |
| --- | --- |
| Linked to A, bound to A under this name | Yes |
| Linked to A, never synced through the plugin | No |
| Linked to A, bound to B (or A and B both hold bindings under the name) | No |
| Linked to A, bound to A under an old name (renamed, not synced under the new name yet) | No, until A's next sync under the new name |
| Bound to A, name not linked (unlinked, or never added) | No (there is no profile) |

The rule is `lib/verified-profile.ts` (`profileVerified`, and `verifiedSql` for queries), tested in
`lib/verified-profile.test.ts`. It needs no new table: two indexed lookups on `plugin_account_owners(rsn)`.

## Where it shows

- `GET /api/profile` and `GET /api/account-settings` return `verified` per profile.
- A green shield (`app/VerifiedBadge.tsx`, tooltip "Verified through the RuneLite plugin") next to the name on
  the profile header and in Account settings → Profiles.
- Only while `PLUGIN_PAGE` is on (the dev environment until the plugin is on the Plugin Hub). On the live site
  `verifiedSql` is a constant `0`, so no query or badge changes there.
- Not on leaderboard rows yet; the board is cached per database version, so adding it later means one more
  column in `leaderboard()` in `lib/profile-store.ts`.
- When the badge goes live, update `docs/transparency.md` ("Linking a RuneScape name … does not independently
  prove ownership") to say that a verified badge does.

## Restrictions: none yet

Nothing is gated on verification. The owner's direction: some features may later require it, while legacy
profiles (linked before the plugin, or by players who never install it) stay fully usable, because reporting and
staff review already handle disputes. Candidates for the owner to decide on later:

| Candidate | Possible rule | Legacy profiles |
| --- | --- | --- |
| Leaderboard records and "record holder" claims (driest, fastest, rarest) | A new record needs a verified profile, or shows an unverified mark until it is | Existing records stay; reports still apply |
| Disputing a name (Request review / relink cases) | A verified claimant's case goes first, and a verified holder is notified with more weight | Unchanged: staff decide on evidence as today |
| Holding a name against new links | A verified profile cannot be taken by staff relink without the plugin owner's input | Unverified holds work as today |
| Supporter coin and supporter title display | Stays as is (it follows donations, not ownership); possibly only a gift to a verified name shows publicly | Unchanged |
| Manual imports and self-reported dates on top of the board | Shown only on verified profiles, or marked self-reported | Shown, marked self-reported |
| Staff and guide-writer roles tied to a character | Require the character to be verified | Existing roles kept |

Suggested order: show the badge first (no restrictions), watch how many active profiles verify, then pick at most
one restriction (records) and announce it before switching it on. Legacy profiles are never hidden or unlinked
for being unverified.
