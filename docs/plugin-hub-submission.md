# Plugin Hub submission

How to get the Spooned OSRS RuneLite plugin listed on the RuneLite Plugin Hub, and what in the
plugin scope (`docs/runelite-plugin.md` on `chore/runelite-plugin-scope`) needs changing first.

Sources, read 23 October 2026:

- `runelite/plugin-hub`: `README.md` (creating, licensing, submitting, updating, reviewing),
  `.github/workflows/build.yml` (the PR build), `package/verification-template/README.md`
  (third-party dependencies), and the existing manifests in `plugins/` (for example
  `plugins/runeprofile`, `plugins/wikisync`).
- The RuneLite wiki (`runelite/runelite.wiki`): `Rejected-or-Rolled-Back-Features.md` (the rules
  reviewers apply), `Plugin-Hub-Review.md` (who reviews and what for) and
  `Information-about-the-Plugin-Hub.md` (the install warning).
- Jagex's third-party client guidelines, linked from the plugin-hub `README.md` → *Reviewing*.

## While it waits

The site's plugin page and its header button are behind `PLUGIN_PAGE` in `lib/plugin-page.ts`:
on in the dev environment, off on the live site. Once the plugin is merged on the Hub, set
`PLUGIN_ON_HUB = true` there. That switches the page from "coming soon" to "available" and shows
the page and the header button on the live site.

## Checklist

### 1. The plugin repository

- [ ] Make `chris-fweather/spoonedosrs-runelite` **public** (plugin-hub `README.md`, *Creating new
      plugins*, step 2). Check the history first: no private repo names, internal docs, Discord IDs
      or personal paths (scope doc, *Decisions* 1).
- [ ] `LICENSE` is BSD 2-Clause (`README.md`, *Licensing your repository*). Reused code from
      RuneProfile, WikiSync, Dink or Wise Old Man keeps its copyright header.
- [ ] `runelite-plugin.properties` has `displayName`, `author`, `description`, `tags`, `plugins`
      (the main class) and `build=standard`; `version` is optional (`README.md`, step 9). Hub search
      matches `tags`, so include `spooned`, `pets`, `collection log`, `tracker`.
- [ ] Optional `icon.png` at the repository root, no larger than 48×72 px (`README.md`, step 10). The plugin page shows `public/icons/runelite/runelite-logo.png` as the plugin's icon; submit the same image (scaled to 48×48) or change the page to match.
- [ ] A README that says what the plugin does and **what it sends to spoonedosrs.com** (`README.md`,
      step 11; the warning below repeats it).
- [ ] `build.gradle` uses `runeLiteVersion = 'latest.release'` and builds on Java 11 (`README.md`,
      *My client version is outdated*; `build.yml` uses Java 11).
- [ ] No dependencies beyond `runelite-client`. Any other dependency needs hash verification added
      to `package/verification-template/build.gradle` and a maintainer's manual check, which slows
      review a lot (`README.md`, *Third party dependencies*).
- [ ] Resources are read with `getResourceAsStream`, not `getResource` (`README.md`, *Plugin
      resources*).
- [ ] The code passes the rule review below.
- [ ] The plugin talks to `https://spoonedosrs.com` by default, and the site's plugin API is live
      there: `/api/plugin/*`, migration 0031 and the Account settings cards are on `dev` today and
      must reach `main` first.

### 2. The submission pull request

- [ ] Fork `runelite/plugin-hub` and create a branch (`README.md`, *Submitting a plugin*, steps 1–2).
- [ ] Add one file, `plugins/spooned`, with the repository's HTTPS clone URL and the full 40-character
      commit hash (steps 3–5):

      repository=https://github.com/chris-fweather/spoonedosrs-runelite.git
      commit=<40-character hash>
      warning=This plugin submits your IP address, RSN, a hashed account identifier and account progress (skills, quests, collection log, pet and item drops) to spoonedosrs.com, a 3rd-party server not controlled or verified by the RuneLite developers.

      The `warning` line is not in the README, but every plugin that sends data elsewhere carries one
      (326 manifests, including `plugins/runeprofile` and `plugins/wikisync`). RuneLite shows it when a
      player presses Install; the wiki (`Information-about-the-Plugin-Hub.md`, *A warning pops up when
      I click install!*) says plugins that talk to third-party servers must have it, on the plugin or on
      the setting that turns the sending on. Add it ourselves rather than wait to be asked.
- [ ] Open the PR against `runelite/plugin-hub` with a short description of the plugin (steps 6–7).
- [ ] Watch two checks: `.github/workflows/build.yml / build (pull_request)` and *RuneLite Plugin Hub
      Checks*. On a failure, or "Changes are needed.", fix the plugin repository and push a new
      `commit=` to the **same** PR; do not open another (step 8).
- [ ] Wait for review (step 9). Review checks for malware and Jagex rule breaches only, not whether the
      plugin works (`Plugin-Hub-Review.md`). New plugins with network IO get a human review; "if it is
      difficult for us to ensure the plugin isn't against the rules we will not merge it" (`README.md`,
      *Reviewing*).

### 3. After it is merged

- [ ] Set `PLUGIN_ON_HUB = true` in `lib/plugin-page.ts`, and move the plugin's CHANGELOG line into the
      next release notes.
- [ ] Add the plugin to the privacy page (see *Privacy wording* below).
- [ ] Every later version is a PR that only changes `commit=` in `plugins/spooned` (`README.md`,
      *Updating a plugin*). Batch changes; each update is reviewed again (an automated bot can approve
      simple updates, `Plugin-Hub-Review.md`).

## Plugin-verified characters (site side) and a plugin change to make

Every sync carries the account hash, which only someone logged in to that game account can send. The
site keeps it as a keyed hash (`plugin_accounts`) and, from migration `0036_plugin_account_owners.sql`,
binds it to one Discord account (`plugin_account_owners`). The rules live in `lib/plugin-binding.ts`
(unit tested in `lib/plugin-binding.test.ts`, end to end in `scripts/check-plugin-sync.mjs`):

| Game account | Sync from | Name | Result |
| --- | --- | --- | --- |
| Not bound | anyone | linked to them | Syncs, and binds the account to them. |
| Not bound | anyone | nobody's | `add_character`; the first person to press Add links it and binds it. |
| Not bound | anyone | someone else's | `claimed_elsewhere`; Request review. |
| Bound to them | owner | linked to them | Syncs; the binding follows the name. |
| Bound to them | owner | new name, nobody's (a name change) | `add_character` ("a new name for a character you verified"); Add links it. |
| Bound to them | owner | new name, someone else's | `claimed_elsewhere`; Request review. |
| Bound to someone else | anyone else | any name, linked or not | `claimed_elsewhere` ("Linked to another account"), never Add; Request review. |

- Request review opens the usual RuneLite plugin moderation case. For a bound character under a name
  nobody links, the case's other side is the Discord account that verified it, and it is notified.
- Staff approving a link (relink) moves the binding to the new owner for the game accounts their plugin
  saw under that name, and clears any other binding under that name. Holds and releases keep bindings:
  a hold only protects the name, and a released name returns to the same verified owner.
- Unlinking a name keeps the binding, so nobody can add the character after the owner unlinks it. The
  owner can Release an unlinked character they verified in Account settings → Profiles → "Seen by the
  RuneLite plugin"; it is then unbound and the first person to Add it links it.
- No backfill: characters already linked are bound on their next sync.
- A linked name bound by the same Discord account is a **verified profile** (badge in dev only, no
  restrictions yet): see `docs/verification.md`.
- Known limit: `plugin_accounts` keeps only the latest name per game account and Discord account, so a
  requester who syncs the character under yet another name before staff decide leaves the binding where
  it was; staff then ask them to sync once under the disputed name.

**Recommended plugin change (for the plugin repository):** an unbound character still goes to whoever
adds it first, so a player who logs in on a friend's computer leaves their character in the friend's
"Seen by the RuneLite plugin" list. Before the first sync of a character on a device, the plugin should
ask in game ("Sync *name* to the Spooned OSRS account on this computer?", a chat message or a panel
prompt) and remember the answer per character in RuneLite's per-character configuration; on No it sends
nothing for that character. A `claimed_elsewhere` or `review_pending` reply should stop syncing that
character for the session and show the message once rather than on every attempt.

## Rule review: the scope against the Hub rules

From `Rejected-or-Rolled-Back-Features.md` unless noted. Items marked **change** need a change
before submitting.

| Scope item | Rule | Verdict |
| --- | --- | --- |
| "Open my profile" and right-click *Spooned* opening `spoonedosrs.com/player/<name>` "through `LinkBrowser`" | *Forbidden Java functions*: `Desktop.open`, `LinkBrowser.open` and `Desktop.browse` are forbidden; `LinkBrowser.browse` is allowed. | **Change** if anything calls `LinkBrowser.open`: use `LinkBrowser.browse` only. |
| Collection log read: fire the log's Search op, then init script 2240 | *Sensitive APIs*: `Client.menuAction` is allowed for exactly one call, `client.menuAction(-1, InterfaceID.Collection.SEARCH_TOGGLE, MenuAction.CC_OP, 1, -1, "Search", null)`. `Client.runScript` is sensitive; scripts that send server actions throw. | Allowed, but the call must match that line exactly. Expect extra review. |
| Script ids 4100, 7797 and 2240 served from `/api/plugin/manifest` (`collectionEntryScript`, `collectionSetupScript`, `collectionInitScript`) | "If we cannot review every single line of source code that your plugin will execute, we will not accept it." A server that picks which client scripts run is hard to review. | **Change**: hard-code the script ids in the plugin. Keep the manifest to data the plugin reads (varp and varbit lists, item names). |
| Data sent to spoonedosrs.com | Wiki: plugins that send data to third-party servers must show a warning. "Network IO" is a sensitive API. | Allowed with the `warning=` line above and a clear README. |
| Account hash, sent as a one-way key and stored as a keyed hash | No rule against it. | Name it in the warning and README ("a hashed account identifier"). |
| In-panel player lookup: right-click a player, fetch their public Spooned profile | Not considered: "Plugins which expose player information over HTTP" and "Plugins which 'crowdsource' data about other players, such as player locations, gear, names, etc." | **Risk.** The plugin uploads nothing about other players, but each lookup sends a name the player clicked to our server. Say in the README that it only reads public profiles by name. If review objects, ship the first version without lookup, or behind an off-by-default setting. |
| Right-click *Spooned* menu entry on players and chat names | Menu entry rules restrict swapping and conditional removal, not adding entries. | Allowed (Wise Old Man and RuneProfile add the same kind of entry). |
| Sync button added to the collection log | Not considered: plugins that manipulate core RuneLite UI (overlay anchors, the root frame or sidebar) or "significantly alter in-game content or assets". | Low risk: RuneProfile adds the same button. Add a button; don't replace the log's own Search button. |
| PvM sessions overlay (kills per hour, time per kill) and saving sessions to the site | Not considered: "Any new high-end PvM boss plugins"; "Hiscores for PBs and other information not on the hiscores … could easily be spoofed". | **Risk** for a later version. Keep the overlay to counts from chat messages, nothing about mechanics, and don't present the saved figures as a ranked hiscore. |
| Queue, debounce and back-off | `Thread.sleep` and `Thread.interrupt` are forbidden. | Schedule with an executor; never sleep. |
| Event queue stored between sessions | `java.io` file APIs are forbidden (use `net.runelite.client.util.Filepath`). | Fine as planned: the queue lives in RuneLite's per-character configuration. |
| HTTP and JSON | Only the injected `OkHttpClient` and `Gson` (`.newBuilder()` if needed); no own instances; no other HTTP client. | Fine as planned. |
| `-Dspooned.api=…` for the dev environment | No rule against it. | Fine; keep it a JVM property, never a setting in the plugin panel. |
| Language and package | Java only (no Kotlin); not `net.runelite` as the package. | Fine as planned. |
| Paid services | New plugins (from 14 October 2026) with significant functionality locked behind paid external services are prohibited. | Fine: everything on the site is free. Keep it that way for plugin features. |
| Display name | Other Hub plugins have similar names: `whospoonedit`, `spoon-meter`, `spoon-tracker` (`plugins/`). | Use the display name *Spooned OSRS* and the tag `spooned`. |

## Privacy wording

The privacy page (`app/privacy/page.tsx`) does not mention the plugin yet. Before the plugin goes
live it needs a short section, reviewed by the owner, covering: that the plugin is optional; what
it sends (character name, account type, skill XP, quests, collection-log items, and for new pets and
items the time with kill count or XP); the account identifier, kept only as a keyed hash and never
shown; that plugin tokens are stored as hashes, can be removed from Account settings and are all
removed by Log out everywhere; that a lookup sends the looked-up name and reads only public profile
data; and that profile privacy settings apply to plugin data.
