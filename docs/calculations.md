# Pet records and calculations

## Current progress and acquisition history

Hiscores is a current snapshot. Its KC is not evidence of the KC when a pet was obtained. Sync never fills an acquisition count from current Hiscores.

A pet record can store the received-at count, its unit, received-from method, date, approximate flag, optional starting counter and optional recorded hours. A received-at level is useful history but only gives an XP interval. It is not exact XP or exact play time.

For a single method, estimated time to pet is `(received count - starting count) / hourly pace`. A missing start assumes zero and the UI says so. Only eligible activity belongs in this count: lifetime skill XP can include lamps, quests and unrelated methods. The app no longer turns lifetime XP into recorded hunt time.

Mixed methods live in **Your methods**: each method holds its own count, pace and rate. A collected pet's chance and time use the acquisition record for the method it came from, plus the counts the player entered on its other methods (`otherMethods` in `lib/hunt-history.ts`). Methods tied to a hiscores activity are left out for a collected pet, because sync keeps their count at today's total, which includes kills after the drop. Time is the acquisition count ÷ its pace plus each other method's count ÷ its pace; a counted method without a pace leaves the total unknown.

### Hours already spent

**Hours already spent (optional)** (`recordedHours`) is the player's own time. When entered it **is** the time spent and replaces count ÷ pace everywhere: the pet window's *Recorded time*, the pet panel's effort, `effortTime`/`hoursSpent`, `acquisitionEffort`, and pet luck (`lib/pet-luck.ts`), collected or not. Pet luck turns it into efficient hours through the odds method's (collected) or selected method's (not collected) rate ÷ pace, like any other hours. Blank means count ÷ pace.

### The retired Historical methods

Pets used to have a separate **Historical methods** list (`huntHistory`: method, unit, count, pace, rate per segment). It duplicated Your methods and is gone. Old journals still parse; `migrateHuntHistory` runs at the end of `normalizeRates` (every load, save and sync), once, and removes the field:

- Segments with a count are grouped by method name, unit and rate. A group joins the pet's method with the same name and unit when its rate matches (or the method has none) and its pace matches (or the method's pace is still a default); otherwise it becomes a custom method with the segment's label, unit, rate and pace (named "… (earlier)" when the name is taken). Counts in a group add up; its pace is total count ÷ total hours, so hours are kept.
- **Not collected:** the group's count becomes the method's count.
- **Collected:** the group for the method the pet came from becomes the acquisition record (received-from method, unit and count, on top of any starting count) when none is saved; a saved record wins. The other groups become counts on methods without a hiscores activity, so they keep adding to the chance and time and sync never overwrites them.
- Chance and time are unchanged by the move, with two exceptions: a collected pet whose saved acquisition count differs from its history for that method now uses the saved count, and a pet not yet collected now also counts methods outside the old history that already had a count (the old section hid them).

## Chance of at least one

For independent eligible attempts with fixed probability `p`, cumulative chance after `n` attempts is `1 - (1 - p)^n`. At 85 eligible kills with a 1/75 rate, this is about 68.1%. Previous misses do not increase the next-roll chance.

For several methods with different fixed rates, multiply their no-drop probabilities and subtract from one; methods without a rate are left out. XP-based methods use the continuous approximation `1 - exp(-XP / meanXP)`; real rolls happen on eligible actions. A level alone is never converted into an exact historical likelihood.

Item charts use the selected source and a matching source count. Nex contribution-based odds are withheld because raw KC and its base table rate do not define a personal chance. Other table conditions still apply: the graph assumes every entered kill was eligible and the rate was constant. Multiple sources are not combined into one KC. Unknown probabilities stay unknown.

## Planning versus observed effort

A mean hunt is denominator divided by pace. It is an expectation, not a promise or time already spent. A 95% budget solves the cumulative formula for attempts, then divides by pace. The selected method, pace and whether it is a default estimate are shown in the UI.

Staff can propose fixed rates and hourly paces with an evidence URL; a different authorised reviewer must approve publication. Existing player-customised paces are preserved. Observed average XP per pet is a separately labelled reference, never substituted for a Wiki probability. Self-reported successful hunts are subject to selection bias and starting-XP ambiguity.

A method's own rate (an override) and pace are the player's: later staff updates do not silently rewrite them. Users must enter their historical method conditions (level, team, raid level, boost, reward rolls) accurately. Current-level Wiki formulas cannot reconstruct a complete past hunt automatically.

## Release dates

`lib/release-dates.json` contains explicit dates and source metadata. Pet and boss heads sort ascending by date, retaining catalogue order for ties; unknown dates sort last. Boss dates mean first availability in OSRS, so bosses already present at launch share 22 February 2013. Mode releases can differ from base bosses. Pet release dates can differ from boss releases.

Pet dates were transcribed from the OSRS Wiki Pet table snapshot linked in the catalogue; individual boss dates use their corresponding Wiki release/update information. These are curated reference facts, not live API fields. Corrections should include the relevant source and update tests.


### Exact odds-chart markers

Both compact and full pet curves include the exact entered count in their tooltip dataset, in addition to evenly spaced samples. The yellow point, line, caption and tooltip use the same count and probability. Discrete roll samples use whole counts; continuous XP retains its precision. Abyssal protector's stored `rewards` unit is displayed as searches (one Rewards Guardian search per pet roll), never Guardians of the Rift game completions. At 775 searches and 1/4,000 per search, cumulative probability is approximately 17.6%.

A compatible obtained count takes priority, including any explicit hunt-start offset. If acquisition count is absent, the graph may show the selected method's current eligible count, explicitly labelled Current progress; it does not claim that was the acquisition count. Mismatched acquisition units and a collected pet with counts on several methods do not silently fall back to a misleading single-rate curve. Missing current progress has no personal marker. These cases are covered by `lib/odds-chart.test.ts`.

### Tree runs (Tangleroot default)

Tangleroot's default method is **Tree runs**, a normal method row like every other pet's: counted in **Farming XP** (hiscores can fill the count in one tap), pace in XP/hour, rate shown as mean XP per pet. It is for players who don't know how many of each tree they planted. `lib/farming-runs.ts` (`treeRunStats`, `treeRunsMethod`).

- **The run:** 6 magic trees + 6 palm trees, planted and health-checked. XP per run = 6 × 13,913.8 + 6 × 10,260.6 = **145,046.4** (planting + check-health XP, no fruit picking). Method details shows one muted line: "Average run: 6 magic + 6 palm, ~145k XP".
- **Chance per run:** every tree checked is one independent `1/(base − 25 × Farming level)` roll (magic 9,368, palm 9,000). Per run `p = 1 − (1 − 1/(9368 − 25L))^6 × (1 − 1/(9000 − 25L))^6`. At 99: **1 in 559 runs**.
- **Rate:** mean XP per pet = XP per run ÷ −ln(1 − p): **81,025,980 XP at 99**. `1 − exp(−XP ÷ rate)` equals `1 − (1 − p)^runs` at whole runs. The rate follows the player's Farming level (99 without hiscores) unless they type their own; *Reset to tree-run estimate* puts it back.
- **Pace:** example **580,186 XP/hour** (one run in 15 active minutes), editable. Growth time is not active time; there is no calendar or runs-a-day estimate (no other pet has one).
- **Saved data:** the old XP preset (*Farming runs* in XP, or *Tree runs: 6 magic + 6 palm (XP)*) is renamed **Tree runs** on load with its acquisition record and hunt history; count, rate and pace are kept. The briefly default *Farming runs* counted in runs is removed on load only while untouched; a used one stays as a saved method with its trees and runs-based rate. *Fruit-tree runs* stays as saved. A saved runs a day (`farmingRunsPerDay`, 0.01 to 3) still validates and loads but is no longer shown or used.

### Tangleroot per-tree methods (PetCord)

The detailed alternatives, added from Add method or the search, follow the **PetCord pet hours sheet, Farming – Tangleroot section** exactly (`lib/tangleroot-trees.ts`):

- **Count:** trees planted (checked or harvested patches), so the unit is **trees**; Hespori counts **kills** (hiscores KC is offered) and Hespori seeds count **seeds**.
- **Rate:** `1/(base − 25 × Farming level)` per tree at the player's level (99 without hiscores). Bases and the sheet's rate at 99: Magic 9,368 (6,893); Palm, Papaya, Celastrus, Dragonfruit, Crystal 9,000 (6,525); Teak, Mahogany, Redwood, Spirit, Ironwood, Rosewood 5,000 (2,525); Calquat 6,000 (3,525); Cactus 7,000 (4,525); Mushroom, Giant seaweed 7,500 (5,025); Belladonna 8,000 (5,525); Yew 11,242 (8,767); Maple 14,052 (11,577); Hespori kills 7,000 (4,525); Hespori seeds (no contracts) a flat 1/500.
- **Pace (rolls/hour):** 80 trees/hour for trees, fruit trees, hardwoods, spirit, redwood, calquat, crystal and celastrus; 60/hour for cactus, mushroom, giant seaweed and belladonna; Hespori 30 kills/hour; Hespori seeds 6.1/hour.
- **Hours** = rate ÷ pace (Palm at 99: 6,525 ÷ 80 = 81.6 h, the sheet's headline Tangleroot hours).
- **XP per tree** (sheet Xp/Resc) is shown as one muted line under the rate, for reference only: Spirit 19,500; Teak 7,290; Mahogany 15,720; Redwood 22,450; Calquat 12,244; Cactus 515; Palm 10,510; Papaya 6,380; Celastrus 14,354; Dragonfruit 17,825; Crystal 13,240; Mushroom 407; Giant seaweed 500; Magic 13,914; Belladonna 603; Yew 7,151; Maple 3,448; Ironwood 20,525; Rosewood 23,352; Hespori kill 12,600.
- **Saved data:** the old catalogue rows (counted in *plants*, with rates and paces one row out of place, e.g. *Redwood Tree* at 1/500 and 6.1/hour) and Wiki crops added in plants become the sheet's method on load: count kept, unit trees (kills, seeds), the sheet's pace unless the player set one, the sheet's rate unless they typed one; old names (*Spirit seed*, *Belladona*, *Hespori (kills)*, *Calquat*) are renamed, with the acquisition record and hunt history. No migration: methods are journal JSON.

### Agility courses in laps

Rooftop and other courses count **laps**: `1/(base − 25 × Agility level)` per lap from the Wiki Giant Squirrel table, with an example pace of `3600 ÷ lap time` laps/hour from the same table (Ardougne: 45.6 s, 78.9 laps/hour, about 405 hours at 99, matching the Wiki's time to drop rate). The old spreadsheet course methods counted in XP are converted to laps on load only while untouched (no count, rate or pace edits, not the acquisition method or in hunt history); anything a player used stays in XP. Hallowed Sepulchre and Brimhaven keep XP. `lib/agility-laps.ts`.

### Counts from hiscores

The methods list offers the synced count for the selected method when it has none: the skill's lifetime XP for an XP method, or the activity score for a kill or completion method. It is a one-tap fill, never automatic, because lifetime XP covers every method (lamps, quests, other methods) and would double count across rows. Agility laps, tree counts and saved farming runs counted in runs have no hiscores source; Tree runs count Farming XP and Hespori counts KC, so they do.

### Skilling pet drop tables

Pets on the collection log's Skilling Pets page show their own sources in the pet window's drop table, in the same table as boss drops (`lib/skilling-drops.ts`, `DropTable`): one row per OSRS Wiki method in `lib/skill-pet-rates.json`, with official item art for what the row catches, mines, cuts or steals (`lib/skilling-drop-icons.json`: the raw fish, the ore, the logs, the chinchompa, the crop (logs or fruit for trees, the herb, a seed stack where the crop has no art), the rune, the stolen item, coins for pickpockets or the Pharaoh's sceptre for Pyramid Plunder; every Agility course uses the Mark of grace; the tree run magic logs; rows with no item art in `public/` keep the pet icon), the method's level and `1/(base − 25 × level)` at the player's level (`atLevel`, Minnow and Fishing Trawler unchanged). Rows are grouped by what one roll is (catch, lap, ore, log, craft, patch; Thieving splits thefts, pickpockets and other actions). Within a group the methods the player can do come first, best chance first, then higher-level methods by level. Tangleroot adds the tree run (per run) above its crops. Without hiscores the table uses level 99 and says so. The odds bar is relative: the best chance in the table is full width on a log scale. Soup has no Wiki formula rows and lists its saved flat rates.

## Pet luck and the Pet summary

`lib/pet-luck.ts` follows PetCord's pet hours sheet (Koekenpan, edited for PetCord by Ptfo), so the numbers match it:

- **Expected hours (EH)** of a pet use its fastest method with both a rate and a pace: rate ÷ pace.
- **Efficient hours** turn time on any method into hours of that fastest method: EH × Σ(count ÷ rate) over the methods with a count. An hour on a slow method counts for less.
- Collected pets use the count at the drop plus counts on their other methods (see above), or hours already spent. With none recorded, they use the current count on each method, as the sheet does.
- Hours already spent replace count ÷ pace for pets not yet collected too.
- **Luck** = EH of the pets you have − efficient hours spent on every pet. Above zero is lucky.
- **Progress** = EH of the pets you have ÷ (that + EH of the pets you don't).
- Chance figures still use `likelihood` in `lib/model.ts`, which combines methods exactly rather than per efficient hour.

## New pets from a sync

`mergeLog` (`lib/model.ts`) marks synced pets as collected. A pet that appears after an earlier log sync gets the sync date and, if no count is recorded, the planned method's kill count (or the skill's XP for skilling pets), flagged approximate. A first sync fills nothing, and `syncJournal('all')` undoes fills a later source adds during a first sync.

## Skill milestones on the Player timeline

`lib/skill-milestones.ts`. Stored in the journal JSON as `skillMilestones` (no migration): `{"Attack:99":"2024-03-01","base:70":"~2023-06-02","maxed":"2025-02-03"}`, a leading `~` marking an approximate day.

- **Which milestones:** each skill at 10, 20 … 90, 92 and 99; base 70, 80 and 90 (every skill at least that level); maxed (every skill 99, also WOM's "Base 99 Stats").
- **Wise Old Man:** every WOM or combined refresh also asks `GET /v2/players/{name}/achievements` (its own provider lane: one request per 12 s app-wide, cached 6 hours). Names like "99 Attack", "99 Runecrafting", "Base 70 Stats" and "Maxed Overall" map to milestones; XP, kill and other achievements are ignored. Achievements WOM could not date (1970, or before 22 Feb 2013) are skipped; those dated only within a window of more than two days (`accuracy`) are approximate. A failed achievements request never fails the sync.
- **Between our own syncs:** when a stats refresh shows a level passed since the previous one, that milestone is dated on the refresh, approximate. A first stats sync records nothing. A skill missing from either snapshot (unranked) says nothing, and base levels need every skill in both. A combined refresh compares the saved stats with the final result once.
- **Merging:** an exact day beats an approximate one; between two of the same kind the earlier wins.
- **Privacy:** public viewers get milestones only when the profile shares skill levels; private profiles never.
