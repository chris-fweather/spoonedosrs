# Supporters and donations

How donations turn into supporter flair, what changed in migrations `0034_profile_donations.sql` and `0035_donation_claim_hash.sql`, and what is still needed before the site takes payments.

## How it worked before 0034

- **No money came in through the site.** There is no payment provider, webhook or checkout anywhere in the code; the Support page button says "Donations open soon". Every supporter record was written by hand, straight into the database.
- **Three places made someone a supporter:**
  1. `supporter_totals` — one total per Discord account (`discord_id`, `amount_minor`, `currency`, `featured_rsn`). Migration 0031 merged older per-name totals into it.
  2. `profile_supporter_totals` — one total per RuneScape name, left for names nobody had linked (or mixed currencies).
  3. `users.title = 'the Generous'` — an account-wide flag with no amount.
- **Why every linked name showed supporter.** Every read (`lib/profile-store.ts`, `lib/board-page.ts`, `app/api/account-menu`, `app/api/discord/roles`, staff views) joined `supporter_totals` on the name's Discord account: `COALESCE(pd.amount_minor, d.amount_minor)` where `d` is the per-Discord total. So one total, or the `the Generous` flag, gave every name linked to that Discord account the coin, the "the Generous" suffix (from $10 USD), the Supporter title and the gilded scimitar (from $100). The supporters board then had to squeeze the person back to one row (`ONE_PER_PERSON` and `featured_rsn`, picked in Account settings).
- **Discord role.** `/api/discord/roles` gave the Supporter role to a Discord account with `the Generous`, a per-Discord total, or any linked name with a per-name total. The bot (`discord-bot/`) only reads that flag; it never sees amounts.
- `profile_presentation.show_donation = 0` hid the **amount** only; the supporter status and board rank stayed visible.

## The model from 0034

A donation is a row in the `donations` ledger and supports **one profile, or nobody**.

| Column | Meaning |
| --- | --- |
| `target_rsn` | The profile it supports; `NULL` = supports the site without a profile. |
| `donor_id` | Discord account that made it while signed in, or claimed it. `NULL` while an anonymous donation is unclaimed. |
| `anonymous_number` | Public reference, shown as **Anonymous #0042**. Unique, assigned inside the insert. Display only: not needed to claim. |
| `claim_hash` | SHA-256 of the one-time claim code. Unique while set (partial index `donations_claim_hash`, 0035), so a claim finds its donation by the hash. Cleared when claimed. The code itself is never stored. |
| `kind` | `payment`, or `grant` (supporter status without an amount; the old `the Generous` flag). |
| `source` | `staff` (entered by the owner), `provider` (payment webhook, future), `legacy` (0034 backfill). |
| `provider_ref` | The provider's payment id; unique, so a resent webhook cannot count twice. |
| `status` | `completed`, `refunded` or `reversed` (chargeback). Only `completed` counts. |

- `profile_supporter_totals` is now **derived**: the sum of a profile's completed donations (one currency per profile) plus `granted`. `lib/donation-store.ts` `recomputeTotal()` rebuilds it in the same batch as every ledger change.
- `profile_support` (a view) is what visitors see: the total with the recipient's `show_supporter` choice applied. Every public read, the board and the Discord role use it. Nothing reads `supporter_totals` or `users.title` for flair any more; `supporter_totals` is kept for the record.
- **Supporters board:** one row per supported profile, ranked by that profile's own total. A person who supports two of their names has two rows, each with its own amount.
- **Discord role:** the Discord account that owns at least one profile showing supporter status.

### Who does what

- **Signed-in donor** enters the RuneScape name that gets the supporter coin (their linked names are suggested; any valid name works) or leaves it blank for no one. The donation is tied to their account (visible only to them and the owner) and **stays on the name it was given to**: Account settings no longer offers moving it (the `move` API action and its checks remain, unused by the page). Account settings → **Supporter** shows the total each supported name holds; it no longer lists the donations you made (the `GET` on `/api/account-settings/donations` remains, unused by the page).
- **Account total.** Account settings → **Supporter** shows **Your total**: the sum of the donations to every name linked to that Discord account, whoever gave them (gifts and claimed anonymous donations included), read from each profile's `profile_supporter_totals` row, with one row per supported profile showing its total and what it displays.
- **Logged-out donor** is anonymous and enters a name or leaves it blank. They get **Anonymous #N** and a claim code **once**. Later, signed in, they enter the **code alone** in Account settings → Supporter → Claim a donation (`/account?claim` opens it; `?claim=<code>` also fills in the code, and anything else, such as an old number link, is ignored) and the donation becomes theirs. The code is tied to one donation, so no number is needed; the number is only the public label. If it supports no profile yet, the claim form's **Add to** picks which of their linked names it goes to; one already given to a profile stays there.
- **Any name, tracked or not.** The Support page and checkout accept any valid RuneScape name (1–12 letters, numbers, spaces, hyphens or underscores, checked on the page and by `validSupportName` on the server), even one the site does not track yet. Support is stored on the name (`target_rsn`, lower case) and the coin shows once that name's profile is on the site; checkout answers whether it is tracked. A donor who mistypes a name only misdirects their own coin, and a supported name's owner can hide it. Staff entries still need a name the site already has, so a typo there is caught.
- **Owner** (staff portal → Players → Donations, owner only) records donations that arrive outside the site, picks the profile, and either names the donor's linked name or marks it anonymous. The result shows the public number and the code with "Give the donor this code"; the code alone claims it. The owner can mark a donation refunded. Each action goes to `staff_audit`, without the code.
- **Each profile chooses what it shows**, in Account settings → **Profiles** → Privacy & details → Supporter (shown when the profile has support): **Show supporter status** (`profile_presentation.show_supporter`; off means no coin, title, amount or board place, and no Discord role from it) and **Show donation amount** (`show_donation`; off keeps the status but hides the amount). The Supporter list's **Change** opens that profile there. A privacy save that leaves either flag out keeps it.

### Concerns and how they are handled

- **(a) Claiming.** Number = public label only; code = 80 random bits (`CLM-XXXX-XXXX-XXXX-XXXX`), shown once, stored as SHA-256 only. A claim hashes the code, looks the donation up by that hash (unique index, 0035) and still compares the stored hash in constant time (`lib/donation-rules.ts`). A malformed, wrong or already-used code all give the same answer; 10 tries per account per hour. Claiming clears the hash, so a code works once. With 80 bits, guessing any live code is hopeless even across every unclaimed donation.
- **(b) Unwanted gifts.** The recipient can hide supporter status (`profile_presentation.show_supporter`). *Pending owner confirmation.*
- **(c) Payment provider limits.** No provider is connected. Whichever is chosen must carry our `donation_intents.id` through the payment (Stripe Checkout `client_reference_id`/`metadata`, PayPal `custom_id`) and send a signed webhook. Ko-fi's webhook has no reliable custom field (only the donor's message), so with Ko-fi the target profile could not be trusted; it would need manual entry by the owner.
- **(d) Refunds and chargebacks.** Set `status` to `refunded`/`reversed`; the row stays for the record and the profile's total is rebuilt. Owner UI has Refund; a provider webhook would call `reverseDonation()` on refund and dispute events.
- **(e) Existing totals.** A per-Discord total moved to its `featured_rsn` if still linked to that account, else the account's first linked name (by link date), else no profile; it stays there. Per-name totals stayed on their name (no donor). `the Generous` became a `grant` on the first linked name. *Default target pending owner confirmation.*
- **Name transfers.** When staff move a name to another account, donations to it stop supporting it (`target_rsn = NULL`); the donation stays in the ledger without a profile.

## What is built, and what the owner must configure

Built (no secrets needed): the ledger and backfill, per-profile flair everywhere, per-profile Show supporter status and Show donation amount, the account total and Claim a donation (move remains as an API action only), owner donation entry with anonymous number and claim code, refunds, the Support page "Who it supports" form (one optional RuneScape name, an amount and Continue to payment; dev only: `DONATIONS_OPEN` in `lib/donation-rules.ts` is `false`), and `POST /api/donations/checkout`, which validates the choice and answers "Donations open soon".

To take payments on the site:

1. Choose a provider that passes a reference id and signs webhooks (Stripe Checkout is the simplest fit).
2. Add Worker secrets, e.g. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (never in the repository).
3. In `app/api/donations/checkout/route.ts`: insert a `donation_intents` row (donor, target, anonymous, claim hash, 24 h expiry; the target may be a name the site does not track yet) and create the provider session with its id; for an anonymous donor generate the claim code here and show it on the return page once.
4. Add a webhook route that verifies the signature, then calls `recordDonation({source:'provider', providerRef, ...})` with the intent's choices (provider entries accept untracked names), and `reverseDonation()` on refunds and disputes.
5. Set `DONATIONS_OPEN = true`, enable the Support page button, and update the Support FAQ and Privacy page with the provider's name.

Until then, the owner records donations by hand in the staff portal.
