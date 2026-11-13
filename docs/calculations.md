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
- **Few patches:** spirit, teak, mahogany, redwood, ironwood, rosewood, calquat, celastrus and crystal trees, cactus, mushroom, giant seaweed and belladonna grow in only a few patches, so the sheet's 80 (or 60) an hour cannot be kept up (`fewPatches` in `lib/tangleroot-trees.ts`). They stay as methods with their rate and pace, but are left out of Tangleroot's expected hours unless the player set their own pace. Expected hours are then the palm tree's 81.6 h, the sheet's headline (TempleOSRS: 82 h), instead of 31.6 h from spirit trees at 80 an hour.
- **XP per tree** (sheet Xp/Resc) is shown as one muted line under the rate, for reference only: Spirit 19,500; Teak 7,290; Mahogany 15,720; Redwood 22,450; Calquat 12,244; Cactus 515; Palm 10,510; Papaya 6,380; Celastrus 14,354; Dragonfruit 17,825; Crystal 13,240; Mushroom 407; Giant seaweed 500; Magic 13,914; Belladonna 603; Yew 7,151; Maple 3,448; Ironwood 20,525; Rosewood 23,352; Hespori kill 12,600.
- **Saved data:** the old catalogue rows (counted in *plants*, with rates and paces one row out of place, e.g. *Redwood Tree* at 1/500 and 6.1/hour) and Wiki crops added in plants become the sheet's method on load: count kept, unit trees (kills, seeds), the sheet's pace unless the player set one, the sheet's rate unless they typed one; old names (*Spirit seed*, *Belladona*, *Hespori (kills)*, *Calquat*) are renamed, with the acquisition record and hunt history. No migration: methods are journal JSON.

### Agility courses in laps

Rooftop and other courses count **laps**: `1/(base − 25 × Agility level)` per lap from the Wiki Giant Squirrel table, with an example pace of `3600 ÷ lap time` laps/hour from the same table (Ardougne: 45.6 s, 78.9 laps/hour, about 405 hours at 99, matching the Wiki's time to drop rate). The old spreadsheet course methods counted in XP are converted to laps on load only while untouched (no count, rate or pace edits, not the acquisition method or in hunt history); anything a player used stays in XP. Hallowed Sepulchre and Brimhaven keep XP. `lib/agility-laps.ts`.

### Counts from hiscores

The methods list offers the synced count for the selected method when it has none: the skill's lifetime XP for an XP method (never for a 200 million XP method), or the activity score for a method counted in kills, games, raids, runs, completions, subdues, attempts or master clues (`HISCORES_COUNT_UNITS` in `lib/estimates.ts`; sync fills the same units). It is a one-tap fill, never automatic, because lifetime XP covers every method (lamps, quests, other methods) and would double count across rows. Agility laps, tree counts and saved farming runs counted in runs have no hiscores source; Tree runs count Farming XP and Hespori counts KC, so they do.

### Skilling pet drop tables

Pets on the collection log's Skilling Pets page show their own sources in the pet window's drop table, in the same table as boss drops (`lib/skilling-drops.ts`, `DropTable`): one row per OSRS Wiki method in `lib/skill-pet-rates.json`, with official item art for what the row catches, mines, cuts or steals (`lib/skilling-drop-icons.json`: the raw fish, the ore, the logs, the chinchompa, the crop (logs or fruit for trees, the herb, a seed stack where the crop has no art), the rune, the stolen item, coins for pickpockets or the Pharaoh's sceptre for Pyramid Plunder; every Agility course uses the Mark of grace; the tree run magic logs; rows with no item art in `public/` keep the pet icon), the method's level and `1/(base − 25 × level)` at the player's level (`atLevel`, Minnow and Fishing Trawler unchanged). Rows are grouped by what one roll is (catch, lap, ore, log, craft, patch; Thieving splits thefts, pickpockets and other actions). Within a group the methods the player can do come first, best chance first, then higher-level methods by level. Tangleroot adds the tree run (per run) above its crops. Without hiscores the table uses level 99 and says so. The odds bar is relative: the best chance in the table is full width on a log scale. Soup has no Wiki formula rows and lists its saved flat rates.

### Raid pets

Raid methods are counted in **raids**, tied to the hiscores activity, so a sync fills the count. A method with raid inputs (`Method.raid`, `lib/raid-rates.ts`) works out its rate ("1 in N raids") from them on every load, like Tree runs, unless the player typed their own rate; *Reset to raid estimate* puts it back. The pet window shows the inputs under the rate, and the player can change them.

- **Chambers of Xeric (Olmlet), needs a purple.** OSRS Wiki (Ancient chest): 1% unique chance per 8,676 team points (65.7% at 570,000; further points roll another unique), the unique goes to a player weighted by personal points, and only that player rolls 1/53. Team points cancel out, so the chance per raid is **your points ÷ 45,982,800** (100 × 8,676 × 53), normal or Challenge Mode. The cap does not bend it: points past 570,000 roll again at the same rate. Input: your points per raid. Methods *Chambers of Xeric raids* (default 30,000 points, 1/1,533) and *Challenge Mode raids* (45,000, 1/1,022). The exact methods *Chambers of Xeric unique* and *Challenge Mode unique* (1/53 per unique you receive) stay.
- **Theatre of Blood (Lil' Zik), no purple needed.** OSRS Wiki: a personal roll on every completion, **1/650 Normal**, **1/500 Hard Mode**, at full performance (it falls to 1/6,500 and 1/5,000 with many deaths; the exact scaling is not published). Entry Mode cannot give the pet. No inputs: flat rates on *Theatre of Blood* and *Lil' zik (Hard Mode)*.
- **Tombs of Amascut (Tumeken's guardian), no purple needed.** OSRS Wiki (Chest (Tombs of Amascut), Tertiary rewards): a roll separate from the purple, 1% per **350,000 − 700 × L** reward points, L = raid level up to 400, 400 + (level − 400) ÷ 3 up to 550, and 450 above. The starting 5,000 points do not count. Chance per raid = your points ÷ (100 × (350,000 − 700 × L)). Inputs: your points and the raid level. *Tombs of Amascut* (normal, hiscores raid level 150 to 295; default 20,000 points at 150, 1/1,225) and *Tombs of Amascut: Expert Mode* (300 and up; default 20,000 at 400, 1/350). PetCord's 1/321 for solo 400s matches about 21,800 points. Entry Mode is not on the hiscores and has no method.
- **Examples (1 in N raids):** CoX 25,000 / 30,000 / 50,000 points: 1,839 / 1,533 / 920. ToA 25,000 points at raid level 300 / 400 / 500 / 550: 560 / 280 / 187 / 140.
- **Paces** (editable examples): ToB 3.2 and 2.8 raids an hour and ToA 2.5 (TempleOSRS pet hours). CoX uses TempleOSRS's 0.1008 uniques an hour (CM 0.1314) on the unique methods, and on the raid methods the raids an hour that give those uniques at the default points (2.9, CM 2.5), so both agree: about 528 h and 409 h.
- A KC spread over several raid levels or point totals is a mix; a player can split it into one method per setting, as with the Jad variants.
- **The Fractured Archive (Orion), no purple needed.** OSRS Wiki (Chest (The Fractured Archive), Tertiary) and the 3 November 2026 update: a flat **1/750** on every completion, whatever the points, team size or deaths, as long as the chest is not a cabbage (a cabbage rolls no pet or clue). No inputs. Method *The Fractured Archive*, counted in raids and tied to the activity of that name, so a sync fills it once the hiscores list the raid. Example pace 3 completions an hour (the Wiki's trio money making guide): **250 h**.

### Inputs on a method

The raid inputs pattern covers two more pets (`Method.raid`, still the field name; `lib/raid-rates.ts`). As for raids, the rate follows the inputs on every load and as soon as the player changes them in the pet window, unless they typed their own rate; *Reset to Wiki estimate* puts it back.

- **The Nightmare (Little Nightmare): team size.** OSRS Wiki: 1/800 solo, 1/(800 × players in the room when the fight started), so 1/1,600, 1/2,400, 1/3,200, and **1/4,000 for five or more**. Default 1 (solo, 1/800 at 3.75 kills an hour). Phosani's Nightmare is solo only: a flat 1/1,400, no input. A KC mixing team sizes can be split into one method per size.
- **Doom of Mokhaiotl (Dom): deepest delve.** OSRS Wiki (unique rates per delve level): only delves 6 and deeper can give Dom, each completed delve its own roll: **1/1,000 at 6, 1/750 at 7, 1/500 at 8, 1/250 at 9 and every delve after**. *Delve runs* counts runs (not copied from the hiscores); the chance per run to delve N is 1 − Π(1 − 1/rate) over delves 6 to N: about 1/1,000, 1/429, **1/231** (to 8, the default) and 1/120 (to 9), the Wiki's cumulative column. Example pace 6 runs to delve 8 an hour (the Wiki's Delve 1–8 money making guide): 38.5 h. Below 6 there is no rate. It becomes the default over the *Doom of Mokhaiotl* kill method while that has no count, pace or rate of the player's. *Delve 9 and deeper* (1/250 per deep delve, TempleOSRS 32 an hour, 7.8 h) stays and still sets Dom's expected hours.

### Calculation version 6

`upgradeEstimates` runs each step once and stamps `calculationVersion` (now 6, `CALCULATION_VERSION`). Methods are journal JSON, so there is no database migration. Like version 5, version 6 leaves any method the player set alone: a typed rate (`rateOverride`) keeps its rate and gets no inputs, a measured pace (`paceConfirmed`) keeps its pace, and no count is moved or cleared.

- **Orion** joins saved journals, after Tumeken's guardian (any catalogue pet a journal lacks is added next to the pet before it in the catalogue). The collection-log template gains The Fractured Archive page (17 items, in the game's order from the Wiki's Collection log page) and Orion on All Pets: 72 pets, 1,734 unique items. Saved synced logs are provider data and are not changed; the next RuneProfile sync brings the new page. The collection-log emblems count shares of 1,734 (`CLOG_UNIQUE` in `lib/flair.ts`); migration 0043 moves emblems pinned under the old 1,717 ids to the same share of the new total.
- **200 million XP methods:** every pet with the boost gets one method made from the method that sets its expected hours (see Pet luck), named *200M ‹skill›: ‹method›*.
- **Inputs:** the Nightmare's team size and Dom's *Delve runs* (above).
- **Awakened DT2 kills:** *Awakened Duke Sucellus*, *Awakened Vardorvis*, *Awakened The Leviathan* and *Awakened The Whisperer*, counted in kills with no hiscores activity. The Wiki's drop mechanics roll the same pet chance after the drop table for awakened kills (Baron 1/2,500, Butch 1/3,000, Lil'viathan 1/2,500, Wisp 1/2,000); only the unique table is three times as likely. There is no Wiki pace for them, so they have none; the normal kill methods still set expected hours.
- **Yami contracts** are counted in **contracts** (1/100 per Contract of Familiar Acquisition fight). The count and an acquisition record in kills keep their numbers and change unit. The hiscores have no contract count, so it stays manual.
- **Small fixes:** Chompy chick's method notes the elite Western Provinces Diary (done, reward claimed); Heron's *Dark crabs* follow the Wiki's dark crab row (1/146,959 catches, 130 XP each: the same 19,104,670 XP at 99).

On every load (`normalizeRates`), a catalogue pet saved with no methods at all gets the catalogue's methods: Tumeken's guardian had none before its Tombs of Amascut rows, and journals saved at version 4 before then kept it empty, so it showed no rate, pace, method or graph. A player cannot remove a catalogue method, so an empty pet never chose that. Methods an upgrade adds (these, and the version 5 and 6 rows) start at the count the stored hiscores give for their activity, as a sync would have filled it.

A pet card and its panel read the same progress (`petProgress` in `lib/pet-rates.ts`): the chance at the method's count, or at lifetime XP for an XP method with none (as the odds graph marks it), and the mean hunt. Before the pet is collected, a method with an hours estimate and no count reads 0 in its unit.

### Calculation version 5

Version 5 brings saved journals up to the current catalogue (`listed` in `lib/estimates.ts`), and leaves any method the player set alone: a typed rate (`rateOverride`) keeps its rate and raid inputs are not added to it; a measured pace (`paceConfirmed`) keeps its pace.

- **Rates:** a missing rate is filled; a rate still at an old catalogue value is corrected (Smol Heredit 1/100 → 1/200; Callisto, Venenatis and Vet'ion 1/2,000 → 1/1,500; Mr McGroot then follows the Hunter level: 1/(40,000 − 25 × level)). Lil' Zik Hard Mode gets 1/500.
- **Paces:** a missing pace is filled with a sourced example, so every pet has expected hours: TempleOSRS pet hours where it has the pet (Abyssal protector 39 searches, Yama 20 and contracts 15, the Nightmare 3.75 and Phosani's 10, Dom 32 deep delves, Soup courier tasks 90, master clues 10, Inferno 1, Colosseum 2.7, Olmlet uniques as above), the OSRS Wiki money making guides otherwise (Maggot King 25, Callisto 25, Venenatis 26, Vet'ion 37: these three used to carry Artio's, Spindel's and Calvar'ion's paces) and the Wiki's goat hunting page (900 goats an hour).
- **New methods:** Jal-Nib-Rek *Inferno · on task, keep cape* (1/75), *off task, sacrifice cape* (1 − (99/100)², about 1/50.25) and *on task, sacrifice cape* (1 − 74/75 × 99/100, about 1/43.1), like TzRek-Jad; the rate-less *Jal-nib-rek (Offtask)* row goes while unused. Smol Heredit *Colosseum · sacrifice quiver* (two 1/200 rolls, about 1/100.25). The CoX raid methods above (an untouched unique method stops being the default). Dom *Delve 9 and deeper* (1/250; the KC method keeps delve 6's 1/1,000, and the Wiki gives 1/750 at 7 and 1/500 at 8). Maggot King *take eggs* (about 1/1,502 a kill, the Wiki's average over the six eggs). Soup *Courier tasks (Aldarin–Sunset Coast)* (about 1/4,691), made the default while the old one has no count or pace. Tumeken's guardian's two methods get raid inputs in place of the 1/371 and 1/321 planning rates.
- **Skilling sheet rows:** in Beaver, Rock golem, Rift guardian and Rocky, each PetCord sheet row's rate and XP/hour sat four rows below its name (the first four names had none). Version 5 moves them back onto their names while the row has no count, rate or pace of the player's and was not the acquisition method. The result matches the Wiki at 99 and TempleOSRS: Beaver Teak 22,258,185 XP at 200,000 XP/hour (111 h), Rock golem gems 13.6M at 115,050 (118 h), Rift guardian mind runes with runners 9.86M at 145,000 (68 h), Rocky's TzHaar-Hur 103.4 XP a pickpocket. Names past the end (Beaver Oak, Mahogany, Magic, Hollow; Rock golem Coal, Mithril, Lovakite, Runite; Rift guardian Chaos, Nature, Law, Death; Rocky's knights, Pyramid Plunder, Menaphite thugs and cannonball stalls) have no sheet pace. Heron's *Tuna/Swordfish* takes the 22,976,550 of its tick-manipulation row. Rocky's *Ardy Knights* counts 84.3 XP a pickpocket (Wiki) instead of the stall figure that set Rocky's hours.
- **Level 99 until sync:** a Wiki skilling method's rate uses the player's level, and level 99 before hiscores sync (it used to keep the sheet figure), so syncing a level-99 account no longer changes any skilling pet's hours.

## Pet luck and the Pet summary

`lib/pet-luck.ts` follows PetCord's pet hours sheet (Koekenpan, edited for PetCord by Ptfo), so the numbers match it:

- **Expected hours (EH)** of a pet use its fastest method with both a rate and a pace that the player can use now: rate ÷ pace (`countsForExpectedHours` in `lib/estimates.ts`). Every pet has at least one method with a rate and a pace, so progress covers all of them.
  - **200 million XP.** OSRS Wiki (Pet): a skilling pet is 15 times more likely with 200 million XP in its skill, and so are the Phoenix (Firemaking), Quetzin and Mr McGroot (Hunter); Herbi is not on the list (`BOOST_SKILL`). A method marked `xp200m` has the rate ÷ 15 and counts only when the synced hiscores show 200 million XP in that skill; without hiscores it is left out. Phoenix has *200 million Firemaking* (1/5,000 ÷ 15): **100 h** below 200M, 6.7 h at 200M. Every other pet with the boost has one *200M ‹skill›: ‹method›* method made from its fastest method (Beaver *Teak (1.5t)* 111 h → 7.4 h; Mr McGroot 1/37,525 → about 1/2,502, 41.7 h → 2.8 h). It keeps the base method's unit and pace and follows its rate (÷ 15) on every load unless the player typed one. Count only what you did after reaching 200M; XP stops at 200 million, so an XP method takes the XP it would have given, or hours. Lifetime XP is never offered as its count.
  - **Few patches.** Tangleroot trees with only a few patches count only at a pace the player set (see Tangleroot per-tree methods): EH is the palm tree's 81.6 h, not spirit trees' 31.6 h. Other fast special methods (Nid's destroy, Bran's sacrifice, Yama contracts, deep delves) are real alternatives, as in PetCord, and count.
- **Efficient hours** turn time on any method into hours of that fastest method: EH × Σ(count ÷ rate) over the methods with a count. An hour on a slow method counts for less.
- Collected pets use the count at the drop plus counts on their other methods (see above), or hours already spent. With none recorded, they use the current count on each method, as the sheet does. When the player chose the method they got it from, that method's count is used instead (lifetime XP in the skill for a skilling method counted in XP, which includes lamps, quests and other methods, so it is the most effort the pet can have taken). The pet's graph marks the same count and names the method (`petChartRecord` in `lib/odds-chart.ts`).
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
