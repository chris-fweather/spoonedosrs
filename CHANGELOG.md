# Changelog

## Unreleased

Changes after the latest version belong here until the next version and its
release notes are prepared.

- World map: every icon on the map opens its card (what it is, plus Directions to here, Start here and Add a stop), and a dungeon entrance or way out adds Enter or Exit at the top; quest starts show their difficulty orb, the map page fits the window with no page scroll, and the Teleports & travel button is a square the height of the tabs.
- World map directions: each leg shows the way you're taking with its steps, and every way there folds into an "All ways" list you pick from; the trip total, leg headings and list of places are easier to read.
- World map: picking a spot on the map keeps the map inside its frame, with a crosshair pointer.
- World map directions: the route reads as one timeline of your stops with each leg's steps between them ("Change" on a leg picks another way; hovering a leg highlights it on the map); teleports and transport show on the map as dashed lines from where you set off to a marker where you land; the trip total and list of places are easier to read.
- World map: agility shortcuts show the obstacle and its Agility level on hover ("Crumbling wall · 5 Agility"), and fishing spots show their fish and Fishing level; a place's card is larger, at the top of the map, and quest start text no longer shows stray codes such as "&#91; UK &#93;".
- [Dev only — hidden until the plugin is on the RuneLite Plugin Hub; leave out of release notes until `PLUGIN_ON_HUB` is on] Verified profiles: a name linked to your Discord account and synced through your RuneLite plugin shows a green shield beside it ("Verified through the RuneLite plugin") on the profile and in Account settings → Profiles. Nothing requires it.
- [Dev only — hidden until the plugin is on the RuneLite Plugin Hub; leave out of release notes until `PLUGIN_ON_HUB` is on] RuneLite plugin: a character your plugin syncs or adds is verified to your Discord account. Nobody else can sync or add it, even under a new name or after you unlink it; they see "Linked to another account" and can Request review. After a name change your new name shows under "Seen by the RuneLite plugin" with Add, and an unlinked character you verified offers Release.
- [Dev only — hidden until the plugin is on the RuneLite Plugin Hub; leave out of release notes until `PLUGIN_ON_HUB` is on] Account settings: characters the RuneLite plugin has seen but you have not linked show in Profiles under "Seen by the RuneLite plugin" with Add or Request review, and a RuneLite tab lists your devices, showing each device as Connected or Waiting with when it last synced, which character and the plugin version. The live site no longer shows any plugin section.
- [Dev only — until a payment provider is connected] Support page: before paying, enter the RuneScape name that gets the supporter coin (optional, any valid name, even one not on the site yet; your linked names are suggested when signed in) or leave it blank to support the site without a name, and pick an amount ($5, $10, $25 or other).
- World map: a new Map page in the navigation (the game's world map globe). Pan and zoom the game world in the game's own look: its map icons (shops, altars, anvils, fishing spots and the rest, named on hover) and area names, with banks, quest starts and transport drawn with the game's icons and showing more as you zoom in. Search towns, dungeons, quests, banks, fairy ring codes and teleports, and show quest starts, transport, teleports and banks with the layer buttons. Click a quest start for its difficulty, length and where it begins, with our guide when there is one; a place you click glows gold where it is. Zoom in and click a cave entrance, trapdoor or ladder to go underground, and "Back to the surface" to return.
- World map teleports: every spell shows its own spellbook icon, and tablets, jewellery and other items the item itself; teleports landing on the same spot share one marker listing them all, and ones you haven't chosen are dimmed. The Teleports button under + and − (and the teleport icon next to Explore and Directions) opens Teleports & travel: spellbooks, items, transport, your house and your levels, with the Agility and Magic icons, the Dramen staff for fairy rings and a Spirit seed for spirit trees. House portals have one-click presets: Standard, Ancient, Lunar, Arceuus, All or None.
- World map directions: click anywhere on the map (tap on a phone), or a place's card, for Start here, Directions to here or Add a stop. Plan a trip from a start through up to eight stops to a destination: drag stops by their handle (or use the up and down buttons) to reorder them, and × to remove one. Each leg is planned with walking, doors and stairs, shortcuts, boats, fairy rings, spirit trees and the teleports you choose, shows up to three routes with times and steps, and is drawn on the map in its own colour with numbered pins; the trip shows its total time. Guide map stops link to directions.
- Squire prefix for helpers and guide writers (dev only for now).

## 0.3.0-beta.2 — 2026-11-04

- Busy moments no longer take the site down: the image shown when the site is shared is a ready-made picture instead of being drawn for every visitor and link preview, and the home page leaderboard is worked out once and shared between visitors until something on it changes, instead of being worked out for each one.
- Player share cards are kept for five minutes, per player and per board version, so a player who goes private (or is hidden by staff) shows the plain site image on the very next request, and their cached card is never reused. Private profiles get the same ready-made site image, with no player details.

## 0.3.0-beta.1 — 2026-11-03

- Guides: potion hover cards say what the potion does ("Boosts Attack, Strength and Defence by 5 + 15%"); item cards widen to fit long names such as Fremennik sea boots 4; achievement diary rewards say which diary gives them, and untradeable quest items (such as Elvarg's head) say which quest they belong to, instead of showing no price; spell cards show the spellbook's icon before the runes; the quest scroll's picture no longer opens a price card.
- Guides: cost tables can price spells: pick a spell and its runes per cast fill in, with the spell's own hover card and the live cost of a cast.
- Guides: every map is a wide section of its own, with its stops as the steps on the left and the map on the right (stops follow under the map on phones); two maps or a map and text no longer squeeze side by side. Requirement amounts sit right before the name ("90 × Steel nails") instead of at the far edge, and item icons in requirements, guide text and map stops are drawn larger so they read the same size as the text around them.
- Account menu: Sir shows before your name, as on your profile.
- Plugin page: on the live site, saying the plugin is coming soon to the RuneLite Plugin Hub.
- World map: kept off the live site for now (guide maps still work); travel cards show the World map link only where the map is on.
- Boards: the scimitar sits right beside the name again.
- Credits: each guide in a writer's guides card shows its topic icon.
- Boards: Sir sits with the name ("Sir Obifloat"), so every scimitar lines up in the same spot.
- Drop tables: the arrows on collapsible groups are centred and turn when a group opens.
- Credits: Staff and Guide writers each have their own heading, staff first; the guides card lists each guide on one line under its topic.
- Plugin page: "What it syncs" shows minigame and boss counts instead of outfits.
- Guides: item requirements are drawn the same size as skill icons.
- Staff: the rank scimitar's hover card shows the staff member's job title (such as Head Admin or Guide Lead), then their Rank and Name prefix, without the extra sentence. Admins set the title in the staff portal's Team list.
- Guides: prayers and spells have hover cards with what they do, the level, quest or unlock they need and each spell's runes; only one hover card opens at a time, so moving between requirement rows no longer stacks two cards.
- Guide maps: a stop can say what to do there, shown under its name; a map whose stops do is a step on its own, with the stops beside the map on desktop and under it on phones.
- Guides: inventory setups can carry stacks and noted items, shown like the game (stack size in the corner, notes on bank-note paper, bigger coin piles), and the inventory's value counts every item in a stack.
- Guides: teleports, fairy ring codes and transport stops like spirit trees have hover cards with what they need and a small map of where they land; the map shows a little more of the area around it, what they need is a plain list, and spirit trees use a spirit tree icon.
- Guides: requirements list one per line, and skill requirements show the skill's hover card; worn equipment slots are sized to match the inventory beside them. Drop tables mark the pet and other rare collection log drops in gold, and hovering an item named in the guide lights its row in the drop table.
- Guide maps: the stops under a map are a simple numbered timeline; choosing a stop opens its items, chat options and note right under it (no second card over the map), and hovering a stop lights up its pin and back. The map's buttons are smaller and quieter, with one Route button.
- Guides: skill hover cards keep their summary and facts on one line, with a bigger max level; quest reward scrolls list what you are awarded and what the quest unlocks separately, like the diary scroll.
- Guides: filter the list by the game's own groups (Bosses, Raids, Clues, Minigames, Quests, diaries, combat achievements, Skilling and Other), shown in sections, with bigger cards that show each guide's summary, quest difficulty and key requirement. The staff guide workshop uses the same cards and filters.
- Home: Pet collectors and Our supporters show the top 10 at a time, and the Support page's supporters board uses the same slim rows.
- Guides: gear and inventory tabs sit under the grid as small pills, the open one highlighted; inventories are a little bigger, and an inventory section shows the open setup's note.
- Guides and profiles: requirements (skills, items, quests and recommended) are plain rows of icon and name, without boxes. In guides, a step's heading sits at the top of its text column, level with the map or chart beside it.
- Guides: cost tables are cleaner: a small 'Cost per run' title, parts in columns that line up from row to row, and the cost in gold at the right.
- Signed-in players no longer see "Sign in" flash in the header when changing pages: your account shows straight away.
- Leaderboard and home boards: every row is one slimmer height (players, Not synced and open places), names and titles stay on one line, and the rank scimitar is smaller. Loading placeholders for the boards, guides and player search now match the finished layout.
- Profiles: the loading view now matches the finished profile section by section (name and title, boss ranks, overview, join banner), so nothing jumps when it loads. Hover or tap any badge (achievement emblem, rank scimitar and Sir, supporter title, account type, achievement title) for a card saying what it means and how it is earned, on profiles and leaderboard rows.
- Guides: a cost table can price a whole run, with a label for each row (such as a Farming level bracket).
- Guides: every chest reward window now looks the same — the loot on its own in a row, like the clue caskets, and the chest's small icon by its title. Quest and diary scrolls show their picture centred under the title, then the rewards in one neat list, each line with its own icon instead of a dot and every item and skill name underlined with its hover card.
- Guide maps: a teleport stop without a named teleport shows the Home Teleport icon instead of a law rune.
- Pet progress: the separate Historical methods section is gone — your methods hold each method's count and pace; existing history moved into them. 'Hours already spent' still counts as your time spent.
- Account menu: Link another account is a quick form, just the RuneScape name and Link, without the long note.
- Support page: the banner shows how many supporters the site has (profiles showing supporter status; updated every ten minutes).
- Page banners: Leaderboard, Guides and Support use one size for their counters and buttons; on phones they fill the row evenly.
- Plugin page: the plugin uses RuneLite's logo as its icon (page title, header button, Connections and the Plugin Hub and settings mocks), "Coming soon to the RuneLite Plugin Hub" sits beside the title, and the last Link your account step points to Your profiles in Account settings.
- Guides: new Rewards section in the game's own style, one per kind of reward. A quest is its completion scroll with rolled ends: "Congratulations!" and "You have completed…", the quest's picture twice its size on a round parchment plate, and "You are awarded:" over a neat column of quest points, XP and unlocks. A clue casket is the clue reward scroll: the tier's reward casket (Beginner to Master), the items in rows of three on the parchment and "Your treasure is worth around … coins!". A chest is the game's stone reward window, drawn from the game's own frame: Barrows chest, Chambers of Xeric, Theatre of Blood, Tombs of Amascut and the Lunar Chest each with their title and the items beside the chest; the Gauntlet and other loot (a boss chest, the Wintertodt reward cart) share a loot window with item slots. An achievement diary is a scroll like the quest's with its rewards and perks. Guide writers pick the casket's tier and the chest's window. Dragon Slayer I and The Restless Ghost use it.
- Guides: hover or tap a skill such as Magic for a short card in the same style as item price cards: its icon and name, Free-to-play or Members and its type (Combat, Gathering, Artisan or Support), what it does in a sentence, max level and key unlock levels in a small grid, each with the game's icon for what it names (High Level Alchemy and Ice Barrage show their spells, Piety its prayer, Runite ore its ore), and an OSRS Wiki link.
- Guide maps: teleport stops show how you get there (the glory, the spell or tablet, the spirit tree) and list every teleport that lands there, the guide's own one highlighted.
- Guide maps: chest stops show the item they give (the map pieces in Dragon Slayer I); fights show a plain hitsplat for any style, and the weapon only when a style is recommended.
- Guide maps: stop cards are wider so chat options and notes fit on one line, and the stop list no longer tags Surface, Underground or floors.
- Guide requirements: custom requirements no longer show the price of the item whose icon they borrow.
- Guides: punctuation right after an item or skill stays visible and on its line.
- Privacy page: new section on the optional RuneLite plugin (what it sends, how tokens and the account identifier are stored, lookups).
- Supporters: a donation now supports the one profile it was given to, not every name on your Discord account. Account settings lets you claim an anonymous donation with its one-time claim code alone (the public number is only a label), and each profile can hide its supporter status ("Show supporter status"), for example a gift you would rather not show. Existing totals moved to the name you showed on the supporters list (or your first linked name).
- Account settings is organised into tabs: Account (your Discord sign-in, then Discord server roles, Show me on Credits and Log out everywhere, as one card), Profiles (privacy, details and Unlink for each linked name) and Supporter. Links open the right tab, and a claim link opens Supporter. The account menu no longer has a settings or unlink button per name; manage them in Account settings → Profiles (Manage linked profiles in the menu), and your profile's wrench still opens Profile settings.
- Supporter: Account settings shows your total, the sum of every donation to the names linked to your Discord account (gifts and claimed anonymous donations included), with each supported profile's own total. Each profile chooses in Profiles whether it shows supporter status and the donation amount. Donations now stay on the name they were given to (no more moving them between your names); when you claim an anonymous donation that supports no one yet, you pick which of your names it goes to. With no donations it simply says No donations yet. The claim form is always open, with labelled Claim code and Add to fields; the list of donations you made is gone.
- Supporter: Account settings shows your total, the sum of every donation to the names linked to your Discord account (gifts and claimed anonymous donations included), with each supported profile's own total. Each profile chooses in Profiles whether it shows supporter status and the donation amount. Donations now stay on the name they were given to (no more moving them between your names); when you claim an anonymous donation that supports no one yet, you pick which of your names it goes to. With no donations it simply says No donations yet. The claim form is always open, with labelled Donation number, Claim code and Add to fields; the list of donations you made is gone.
- Support page: Top supporters is now the same Our supporters board as the home page (ranks, open places when empty, pages and a Leaderboard link), and Donations open soon sits after Ask on Discord.
- Tiny tempor now has a pace in reward permits per hour (example 80/hour, from the PetCord sheet) so its time estimates work; edit it to your own rate.
- Credits now thank people too: guide writers with their guides, the staff team by rank with their scimitars, and a Hall of fame of former staff showing every rank they held. Anyone listed can hide themselves in Account settings. Guide writers show their name and how many guides they wrote; hover or tap the count for links to each guide.
- New Credits page thanking the projects and people behind the site (OSRS Wiki, RuneProfile, TempleOSRS, Wise Old Man, PetCord, map and travel data and more). The footer is now one short line (Privacy · Terms · Credits · version), and the long credit text under profiles and the map sidebar moved there.
- RuneLite plugin page: what the Spooned OSRS plugin syncs, how to install it from the Plugin Hub and link it with a token, your data, questions and fixes. Reached from a Plugin button in the site header and from Connections. The page shows a live count of connected accounts, install steps with RuneLite's own icons, and clearer Your data and Troubleshooting sections; Outfit is listed as available (items your synced log unlocks).
- Pets: the time left on a pet now counts down to your next odds milestone ("~120 h to 90%") instead of repeating the average hunt, which never shrinks because every roll starts fresh. The pet panel shows it too.
- Pet Penance Queen counts high-level gambles instead of kills, and you can enter your pace as Honour points per hour (a high-level gamble costs 500 points in each role).
- Outfit: anything in your collection log that changes an item's look now lets you wear that look and keep the normal one: slayer helmet colours from boss heads (Kbd, Kalphite Queen, Abyssal Sire, Skotizo, Vorkath, Hydra, Araxxor) along with the imbued slayer helmet, dragon hunter crossbow (t) and (b), Kourend graceful colours (each house and Kourend) from marks of grace, the golden prospector kit from a star fragment, Hallowed graceful from the dark dye, volcanic and frozen whips, Tanzanite and Magma helms, blood, ice, smoke and shadow ancient sceptres, Osmumten's fang (or) and the ornate granite maul. Upgrades that change the look show too when you have both parts, such as the Eldritch, Harmonised and Volatile nightmare staffs, Abyssal tentacle, infernal tools, Cerberus boots, the spirit shields, the Zaryte crossbow and the dragon hunter lance. Versions of one item are a single choice in the picker; pick it, then its style from a tidy row of item icons just under it (Torva · Sanguine torva, graceful colours, (g) and (t) trims). Helmets, masks and hoods now show as they do in game: your face no longer shows through slayer helmet, Torva and faceguard visors, and the face under a hood takes your skin tone.
- Maps: every map opens on the ground floor of the surface, and zoomed all the way out shows the whole surface (mainland, Zeah, Varlamore and the islands) and nothing else. Like the game's own world map, maps no longer change floor: zoom in and click the cave entrance, tunnel, trapdoor, hole or ladder into a dungeon you would use in the game (small up and down arrows) to go underground, then the way out or "Back to the surface" to return. Underground, the map stays inside that dungeon. Links keep the area you are on, and a link to an upper floor still shows it with a button back down.
- Guide maps: a map opens on the floor and area of its view. Click a stop on another floor or underground to go there; arrows mark where the route goes underground. Guide writers have new stop kinds: Fight (melee, Ranged, Magic), Dig, Search and Cutscene.
- New guide map stop icons: talk, item, step, danger, fight (hitsplats for melee, Ranged and Magic), dig, search and cutscene.
- The game's own icons, wherever the game has one: guide map stops show the quest start icon, the game's chat bubbles, hitsplat, skull, backpack, search glass, spade, coins and law rune (plain steps and cutscenes keep ours), and ways into dungeons show the game's dungeon icon. The collection log, quest point, achievement diary, quest list, friends, chat and clan icons across profiles, guides, requirements, leaderboards and staff pages are the in-game ones, the Max cape badge is the cape itself and account types use the game's chat badges. Navigation buttons, charts, skill, boss and activity icons, combat achievement and quest difficulty icons stay as they are.
- Support page wording updated.
- Guides: gear and inventory show as one worn-equipment panel and one inventory panel, the same size side by side, with tabs per setup across the top (Budget · Mid · Max), evenly spaced. Each panel keeps its own tab, so you can compare Max gear with a Budget inventory. Both panels show their items' Grand Exchange value; the setup's note sits underneath. Guides with Budget, Mid and Max gear tiers show them as tabs without any change.
- Guide editor: gear, inventory and gear-and-inventory sections have tabs: add one (empty, a copy of the open tab, or a setup another section uses), rename, move left or right, and delete.
- Price cards with an amount show what the whole stack is worth big, and the price of one underneath ("408", then "136 each").
- Spells in guides show their own spellbook icon (Crumble Undead, Ice Barrage, teleports and more than 160 others), in the text and in Spells sections, instead of the Magic icon.
- Guide requirements: a long requirement no longer makes the page scroll sideways on phones.
- Diary task panels match the quest panel: Skills, Quests and Items as the same compact tiles, then Notes as short plain lines (no boxed paragraphs, no Other conditions box). Requirements written as text become tiles: started or partly done quests ("The Fremennik Trials · Partial"), combat and skill levels with their note ("70 Attack · Ahrim's, not boostable"), runes, gems and "Any axe" or "Any pickaxe" with an icon. The Wiki's task notes join Notes one sentence a line; links to Wiki strategy pages and Deadman Mode variants are left out, and long extras are shortened ("Menagerie not built yet: 30k coins, 4 oak planks"). A finished tier shows "Tier complete" under the task.
- Character: scenes are switched off for now (they are being redone); every profile shows the plain background, and saved scene choices are kept for later. Hair colour and skin tone are rows of round swatches with the chosen name in the label ("Skin tone · Light"). The settings preview frames the character exactly like your profile portrait, outfit and pet included. A damaged or broken log item lets you wear the fixed item (damaged Torva → Torva), and an ornament kit, colour kit, dye or paint lets you wear both the normal and the recoloured version (Sanguine ornament kit → Torva and Sanguine torva). Pet kraken now sits on the ground and Pet chaos elemental hovers.
- Pet hovers: the Current line counts in the same unit the pet was obtained at, so the two lines compare ("Obtained at 4,503 permits", "Current: 4,800 permits"; "Obtained at 125 kills", "Current: 500 Giant Mole"). Pets not yet obtained use the planned method's unit. Raids keep their modes together ("Current: 0 ToB · 0 Hard") unless the pet came from one mode ("Current: 0 ToB Hard").
- Diary requirements: items list only what every player needs; one-time or conditional extras read as one plain line under Other conditions ("First time only: 11 yew logs to unlock the route, plus 1 normal log to fly to Taverley first", "If not built yet: 30,000 coins, 4 oak planks, a saw and a hammer for a menagerie with a pet house").
- Guide maps: tap or click a stop (in the list or on the map) to focus its part of the route: only the leg that ends there is drawn, the other stops step back and the map fits that leg. Tap it again, or Show all, for the whole route.
- Profile Overview: pet hovers are shorter and the same for every pet: "Obtained at 4,503 permits", "Obtained at 13.2M XP · Ardougne" (the method only when it adds something), and current counts on one line ("Current: 0 ToB · 0 Hard", "Current: 123 Hespori"), with the luck line below. The Pet summary tiles sit without their heading row. On desktop the left column ends level with the main window, Boss ranks filling down to it, and the space beside the Discord banners stays free.
- Insights: the Collection timeline is now the Player timeline. Pets, Collection log and Skills each switch on and off, and it opens a little zoomed in on recent months (Fit shows everything). Skills shows each skill reaching 10, 20 … 90, 92 and 99, base 70, 80 and 90, and maxing, dated by Wise Old Man's achievements where it has them; levels we see you pass between two refreshes are dated on that refresh and marked approximate. Hidden when your profile hides skills.
- Quests and diaries: requirement items show the same price card as guide items when you hover or tap them (untradeable items show their high alchemy value). Items with an amount (90 steel nails, 3 planks) show it on the tile, and the card shows the stack's worth beside each price ("10,260 for 90"). Guide requirement items do the same.
- Requirement tiles are one size everywhere: quest and diary panels and a guide's Requirements use the same compact tile for items, quests, skills and other conditions, with notes and amounts on the same line.
- Diary requirements list each item on its own tile with its amount and icon (Teasing stick, Logs and Knife, not one long line); alternatives such as "Dramen staff or Lunar staff" share a tile, and anything that is not an item is listed under Other conditions.
- Kudos requirements (Bone Voyage) show the Varrock Museum icon.
- When we have a published guide for a quest or diary, its panel opens with "Read our guide", with the Wiki's guide beside it in grey.
- Item names start with a capital letter ("Coins", not "coins").
- Pet window: skilling pets have their own drop table, like boss pets: every activity that can give the pet (each fish, course, rock, tree or crop) with its chance at your level, best chance first. Every method shows what it counts, inside the count and pace boxes (XP and XP/h, laps and laps/h, kills, runs). Agility courses count laps, with the Wiki's per-lap chance and lap time. When your hiscores know a method's count (skill XP or kill count), the methods list offers to use it. "Obtained method" is now Method details, the one place for a method's rate; Collection details and Method details sit side by side at the same height, with Your methods below them.
- Tangleroot: the default method is Tree runs (6 magic and 6 palm trees a run), counted in Farming XP so your hiscores XP fills it in one tap, shown like every other method. For exact counts, add a tree from Add method: each tree counts trees planted at 80 an hour (60 for cactus, mushroom, seaweed and belladonna, 30 Hespori kills), with its chance at your Farming level and XP per tree, as in PetCord's pet hours sheet. Saved tree-run and tree records keep their counts.
- Skilling pet drop tables show what you catch, mine, cut or steal on each row (the fish, ore, logs, crop, rune or stolen item); Agility courses show the Mark of grace.
- Settings buttons on your profile portrait and staff controls use the same wrench as the account menu.
- Staff: Latest activity reads as plain sentences ("Tansy Iron requested to move Lucky Lad to Dry Guy's Discord account", "Mira Vale approved Tansy Iron's hold on Iron Wren", "Bramble Pk held Dry Streaker"), shows published guides with their icon (opening the guide), and marks RuneScape names with the character head instead of the smiley. Access history says "promoted", "demoted", "removed from staff" and which permission was given or removed, and colours each name by the rank that person held at the time. Guide workshop tiles use the Guides page layout, with full titles on phones. A proposal or ownership request from a higher rank can no longer be decided by a lower rank, even if ranks change mid-review.
- Supporters are counted per person: everything you've given, across all your linked names, is one total, and you appear once on the supporters list under the name you choose in Account settings. Every linked name still shows the supporter coin and title.
- Link previews: shared links show the castle scene with the site header. Profile previews show the player's name in their rank colour with their scimitar or coin and account-type badge, Sir when they use it, their achievement title in its rarity colour under the username, their character in the gear saved on their profile, their chosen scene, and their rank on the pets, collection log and total level boards.
- Running your own copy: `npm run setup` prepares a fresh clone, and the checks run without any configuration.
- Item price cards: hover or tap an item in a guide (in the text, a gear slot or the inventory) to see its latest Grand Exchange buy and sell prices, high and low alchemy values and buy limit.
- Guides side by side: a Two columns section puts two sections next to each other, such as the drop table beside the pet chance or a map beside the steps, half and half or wide and narrow. On phones they stack; a drop table and the card beside it line up top and bottom.
- Guides: a number before an item, as in "3 Planks", joins the item's chip (3 × Planks) and its price card shows the whole stack, with the price of one underneath.
- Recommended levels: guide requirements can list recommended skills and items, shown with their icons under Recommended.
- Guide contents: guides with three or more headings list them beside the guide (a Contents dropdown on phones). The list follows you as you read, and a heading's link can be shared.
- Item price cards on requirements: hover or tap a required or recommended item to see its price card. Untradeable items say so, with their high alchemy value when it is known.
- Guide maps: guides can include a map of the game world with numbered stops (start, talk to, pick up, bank, teleport, danger), a list of the stops underneath, and floors for stops upstairs. Click a stop to jump to it.
- Guide map route lines: maps draw the route from stop to stop, each leg in its own colour with an arrow showing the way, and each stop's number in the list matches the colour of the line that reaches it. Teleports and floor changes have no line. Hover a stop to pick out its leg. Guide writers can turn Route lines off for a map.
- Guide map routes follow the real walking path, tile by tile, through doors and round walls and water. A leg with no walk (a boat crossing, a locked area) keeps a straight dashed line. A Route button on each map hides or shows the route, and the site remembers your choice. Stops on the same spot sit side by side instead of hiding each other.
- Pet summary: the profile Overview shows overall luck in hours, pets collected, progress, total hours, hours gained and hours left, worked out like PetCord's pet hours sheet (Koekenpan, edited by Ptfo). Slow methods count as efficient hours of the pet's fastest method.
- Luckiest and unluckiest pets: two new lists beside Driest and Quickest hunts. The Overview shows three of each list, and the Insights tab keeps its usual size.
- Pet hover: hours spent against expected hours, hours lucky or unlucky, and the chance of having the pet by then.
- Methods as a list: the pet editor shows every method with its own count box, the hours each took, and the total and combined chance.
- New pets from a sync: a pet that appears after an earlier sync gets the sync date and the kill count (or skill XP) at that time, marked approximate so you can correct it.
- Map zoom: each mouse-wheel notch zooms exactly one level, and trackpads zoom smoothly without jumping. Guide maps still need a click before the wheel zooms, so the page scrolls past them.
- RuneLite plugin groundwork: Account settings has a RuneLite plugin card to create and remove short plugin tokens, and Log out everywhere also disconnects the plugin. Characters you log in to with the plugin are listed so you can add them, or ask staff to review a link someone else holds. Pets and collection-log dates the plugin records are marked unconfirmed until you edit them.
- Notifications: your Account page shows notices about your profiles, such as a link review and its outcome.
- Guide maps: a stop can show what you need there in a small card when you hover it, or tap it on a phone (on the map and in the list of stops): the items to use with their icons and price cards ("Use the four items on the magic door": Lobster pot, Unfired bowl, Silk, Wizard's mind bomb), the chat options to pick in order, in the game's blue ("Can you sell me a rune platebody?", then "I thought you were going to give me a quest."), and a short note. Guide writers add them from a stop's details button: items from the item search, chat options as an ordered list. Fight stops show melee, Ranged and Magic hitsplats, and the talk icon is bigger.
- Guides: gear and inventory panels with four or five setup tabs fit them evenly on one line, on phones and in two columns, without scrolling sideways; a name too long for its tab ends in "…" with the full name on hover.
- Guide contents: long headings end in "…" on one line (the full heading shows on hover) and the list no longer scrolls sideways.

## 0.2.0-beta.1 — 2026-10-13

- Staff: corrections take notes, and approvals or rejections can carry a reason; both show in the timeline. Ownership requests show the admin notice first, and the evidence shows who added it and when. Players shows how many players there are and each player's donations (amounts a player hides are marked hidden). Latest activity uses the same rows as Access history, and on phones the section tabs scroll instead of cutting off.
- Guide editor: every insert is an icon on an Insert bar, grouped (In the text, Text, Gear, Boss info, Magic, Media), with its name on hover. Type @ in the text to search items, prayers, spells, skills and quests; type an s straight after a term to make it plural.
- Staff: a moderator can no longer approve an admin's correction or ownership request; the proposer's rank or higher decides. Access history reads as one line per change, and adding staff opens the person's card under the search.
- Guide editor: upload an image or GIF (PNG, JPG, WebP or GIF, up to 3 MB) straight into a guide, as well as pasting a link.
- Guide editor: gear tiers are edited in one place: rename a tier, edit its gear or inventory, or add your own tier. Gear sections show an "Edit" button right under them.
- Guide editor: Insert adds Prayers, Spells, and Images or GIFs by link. Spells can be linked inline like prayers and items. "Items & terms" (the book) is labelled, and can add a plural ("Sharks"). The text-style menu is readable on the dark theme.
- Profiles: scroll (or pinch) on the character to zoom in and out of the scene. Turning the character is gentler: it eases into place and a flick slows to a stop.
- Staff portal: names show the scimitar and rank colour only, without Sir or the donor title.
- Staff portal: RuneScape names carry the friends-list icon and Discord accounts the Discord icon, so requests read "Lucky Lad: from Lucky Lad → Dry Guy" with a one-line summary of what changes. "Needs admin" shows only while a request waits; decided requests note it in the timeline.
- Hold names: a new permission (moderators and up by default) puts an unprotected name on hold straight away, without a second reviewer. Releasing or linking a held name still needs one.
- Corrections: kill-rate rows lead with the boss ("Kraken · kills per hour · Pet kraken"), dry-streak records use a flame icon, state and time sit on one line, and every row opens to a timeline of who proposed and who decided.
- Players: rows show pets, collection log slots and quest points; opening one shows the account type, link date, last full sync and other names. Fix progress now covers the collection log, quests and diaries as well as pets.
- Permissions: picking someone to add shows their Discord name, handle and RuneScape names.
- Boss and activity pages show a "Read our guide" button when a published guide covers them.
- Staff portal: names sit on the same line as the sentence around them. Corrections show the item's or pet's own icon, and kill-rate rows lead with the pet. Dry-streak records read as "Dry Streaker went 14,250 kills without Pet kraken".
- Kill rates & XP: a proposal can set a pet's rate (for example 1 in 1,000 master clues for Bloodhound) as well as, or instead of, its pace.
- Ownership: requests name the Discord account a name moves to (with the Discord icon) rather than its main RuneScape name; protected requests show a Needs admin flag; reviewers are always named.
- Access history starts with who acted: "Mira Vale promoted Bramble Pk", "Mira Vale updated Corvid Hc's access".
- Guides page tiles are compact: the icon beside a one-line title and topic, the byline underneath.
- Staff portal: Ownership and Corrections share one layout: section tabs with their own Awaiting review tab, compact rows that open in place, and step-by-step forms. A new ownership request shows who owns the name now before you choose what should happen.
- Corrections: the drop search groups results by item and lists every boss or activity that drops it with its own rate; History is a compact list instead of large cards.
- Overview: Latest activity reads as plain sentences, such as "Bramble Pk proposed a rate of 1/400 for Kraken tentacle".
- Permissions: access is grouped into Guides, Corrections and Ownership. Team rows show the Discord @username with the Discord icon, every row opens (your own read-only), new staff are found by searching a Discord account or RuneScape name, and rank changes in the history read Helper → Moderator.
- Players: each player shows their name as their profile does, with actions to view the profile, open an ownership request, manage staff access, search correction history or fix progress. The staff tabs read Overview, Ownership, Corrections, Players, Permissions, Guides, Discord bot.
- Ownership: accounts in the top 25 on the pet or collection log boards also need an admin to approve a request.
- Guides: a new guide starts from a layout (Blank, Bossing, Quest or Diary), suggested from its topic, instead of fixed templates. Quests show their difficulty, and diaries and combat achievement tiers can be guide topics. The workshop has a search, guide titles stay on one line, and requirements stay on one line.
- Account settings: Log out everywhere ends every signed-in session for your Discord account, on all devices.
- The footer credits every data source (OSRS Hiscores, RuneProfile, TempleOSRS and Wise Old Man), and the RuneProfile card's description fits on one line.
- Staff portal, Ownership: each request reads like a report, with a header, the from and to accounts, the evidence, a decision panel and a timeline. Staff can now hold a name and release the hold; while a name is held they can link it to its owner's Discord ID from the request.
- Staff portal: people show as they appear on the site everywhere (main name in rank colour, scimitar or supporter coin, Sir and "the Generous"), including the Team list and Access history.
- Staff portal, Overview: Latest activity lists corrections and ownership requests (moves, holds and releases) together, with who proposed and who decided.
- Staff portal, Corrections: section tabs with waiting counts, step-by-step proposal forms, a review queue per section, and cards that show the proposed value up front.
- Every supporter gets a silver coin beside their name on the site, and the same coin is the Supporter role icon on Discord. Gilded supporters show the gilded scimitar instead.
- The site owner's name is red, like admins', with the owner's inferno scimitar.
- The Guides banner shows how many guides are published. The Leaderboard banner shows the live community totals (public journals, pets collected and log slots unlocked), which moved there from the home page.

- The Guides page is open: a search bar, published guides as tiles that open the full guide, and a banner inviting helpers to join the Discord and write guides. The Leaderboard and Guides titles show their navigation icons.

- Guides: gear setups for each budget sit side by side as tiers, each with a short note. Requirements show skill, quest, diary and item icons, plus custom requirements. Game terms such as Protect from Magic or a Dramen staff show their own icon and open their OSRS Wiki page. Staff add requirements from one search across skills, quests, diaries and items.
- The footer shows the site's version, linked to its published source code.
- The home page shows one full-width note when there are no public journals yet, instead of a box inside the Pet collectors panel. Both home boards always show their page controls.
- Connections: the RuneLite guide and Your data sit directly under the source cards instead of at the bottom of the panel, and are always open.
- Guides show who wrote them, when they were published and when they were last updated, on the guide and on its tile. Guide tiles are a little larger with a bigger boss icon.
- Guides: the trip inventory sits beside the gear tiers as one more card; drop tables show on their own without a filter bar; odds charts pick a drop or pet straight from the boss's table; custom requirements use a task icon by default.
- Pets tab tiles look like collection log tiles: icon, name, progress bar, then kills and the estimated time left.
- Quests show how many are left; quest difficulty orbs are smaller. Collection timeline filters use the same pills as the rest of the site.
- Guides and Support use the same gaps between sections as the home page.
- Staff portal: six tabs. Players holds the directory and progress corrections; Ownership has a clearer request form; Corrections brings drop rates, kill rates and XP, dry-streak records and history together, with searches that show results as you type; Permissions history reads as plain sentences with icons.
- Guides, Leaderboard and Support open with the same banner: the castle art, the page title and Rocky. Donor hovers read Supporter instead of Sponsor.
- Support: where the money goes as four cards, and questions that open one at a time.
- Staff names show in their rank colour everywhere a name appears: boards, profiles, search suggestions and the account menu.
- Support page rebuilt: Supporter and Gilded supporter side by side, each showing how your name looks on the site and in Discord, where the money goes, the top supporters and common questions.
- Guides: item and diary requirements keep their amount on the same line; [[XP]] shows the experience icon.
- Names: the achievement title starts under the username everywhere, as in the account menu. The Helper title is now green (uncommon) to match the helper rank.
- Profiles: Sir sits right beside the name, however long the title underneath. Character scenes are framed wider so more of the scene shows, and the Mine's tunnel has depth and a lantern instead of a black panel.
- Collection timeline: before anything is dated, a faded example timeline built from your pets shows what it will look like.
- Connections: the RuneLite section explains that TempleOSRS collection logs import too, and what Refresh all sources pulls.
- Staff portal: approving corrections is its own permission. Helpers can now propose drop rates, records and kill rates by default; moderators and up approve. Admins can set helpers' and moderators' own access. Ownership requests show the from and to Discord accounts with avatars, a clear Relink or Unlink tag, and staff names with their rank scimitar.

## 0.1.0-beta.3 — 2026-10-08

First public source release (MIT). See [release notes](releases/0.1.0-beta.3.md).

- Account-type badges now show on the leaderboards and home page for every synced player, not only on their profile.
- Leaderboard names are laid out like profiles: the scimitar and account badge sit level with the name, and the achievement title centres under the username. Podium crowns follow the donation title, such as "the Generous".
- Leaderboards and the home page boards show each player's account-type badge (Ironman, Group Ironman and the rest) before their name; hovering it names the account type. The badge is the same size wherever a name shows it.
- Hovering an account-type badge now just names it, such as Group Ironman.
- New site icons: every skill, menu tab, quest and combat tier, chat, rank scimitar and account-type badge uses the refreshed icon set. The top three on each board wear gold, silver and bronze crowns, Discord links show the new Discord icon, the helper rank is an adamant scimitar, and lava flows through the Owner blade.
- Two new character scenes: a lantern-lit Mine with ore rocks, timber supports and a mine cart, and a Woodland clearing with oaks and pines, a stump and felled log, mushrooms and drifting leaves. Pick them in profile settings → Appearance.
- The staff portal uses the same horizontal tabs as the profile and leaderboard (scrolling sideways on phones), opens with a plain spinner, and each tab has its own address, such as `/staff?tab=history`.
- Awaiting review, Approved and Rejected are amber, green and red everywhere they appear in the staff portal, with a Rejected count on the overview and outcome filters in correction history. Review activity is now a stacked 14-day chart and a list of the latest submissions with who proposed and who reviewed them.
- The guide editor opens inside the staff portal as the Guides tab (`/staff/guides` still works) and reads like a document: a quiet toolbar with colour swatches, an Insert menu with descriptions, spaced sections with hover controls, an unsaved-changes indicator, and drafts that survive switching tabs.
- Guide editor: every item in gear and inventory setups now shows its in-game icon (Torva and about 4,800 other items used to show a placeholder book), and the item search covers every tradeable item, every wearable and common untradeables such as the rune pouch, with best matches first and no duplicate names.
- Guide editor requirements: switch between Items, Quests and Diaries, search, and add with one click; each result and requirement shows its official icon, and item quantities are edited in place.
- Guide editor text: the colour dots colour the highlighted words (or the whole section when nothing is highlighted), the style menu offers Paragraph, Heading, Subheading, Bulleted list and Numbered list, and an emoji button inserts the site's emojis.
- Guide editor: Save draft and Publish sit in the top bar (Publish saves first), Ctrl+S saves, and New guide asks for a title and a boss or activity, picked from a list with icons.
- New Permissions tab: the team with avatars, linked names and rank badges; promote, demote or remove staff (only the moves your rank allows); per-member custom access with a reset to rank defaults; a rank permission matrix that the owner can edit for helpers, moderators and admins; and a readable access history.
- Staff portal: the Staff & permissions tab is now Permissions, and only the owner sees it; the server refuses rank-default and member-access changes from anyone else. The owner sets what helpers, moderators and admins can open, and can give a member their own access; both are recorded in the access history.
- Staff portal: Awaiting review, Approved and Rejected show as a coloured dot and text, without a box.
- Guide workshop opens on tiles: New guide first, then every guide with its boss or activity icon, Draft, Published or Changes pending, and when it was last edited. All guides takes you back from the editor.
- Guide emojis: crossed swords, join chat and quest list are retired (guides that used them show the plain name), and :pets: is Rocky, the site mascot.
- Empty equipment slots in gear profiles and the profile editor use the game's own grey slot silhouettes; the profile editor's bottom row now reads gloves, boots, ring, as in game.
- Profile staff controls (the cog on someone's profile): set the rank with one tap and a short confirm, switch the profile between public and private, clear an achievement title or badge, unlink the RuneScape name from its Discord account or relink it, and jump to Edit progress. Admins and the owner only; every change is logged in the account history.
- Permissions tab rebuilt in the site's own style: a team list like the leaderboard (open a member to change their rank, their own access or remove the rank), rank permissions as equal-width toggles with the portal's icons, and a plain access history.
- Profile staff controls show the player's name block as on their profile; ranks are Helper, Moderator and Admin (Owner shown), with a separate Remove rank; staff can now assign an achievement title (any the player has unlocked) or an earned badge from a picker; the account row is one line with Unlink or Relink and Move to another account.
- Rank colours: Helper is green with the adamant scimitar, Moderator blue, Admin red, the Owner unchanged, everywhere ranks appear (also the rank_helper emoji).
- Characters now sway gently, turning up to 45° each way around the direction you left them facing. The sway pauses while you turn the character and is off when your device asks for reduced motion.
- Rocky the mascot now stands for the site and the Pets category: the browser tab icon, the Pets tab, summary rows, leaderboard and home totals, share images and the "All Pets" log page. Pet lists and dialogs still show the in-game Rocky.
- Profile settings no longer has a Privacy tab. Visibility and shared details live in Account settings, and saving your outfit, appearance or titles never changes them.
- Titles and emblems in profile settings are an even grid of cards. Locked choices are dimmed and say how to unlock when you hover, tap or focus them.
- Character scene choices show the actual Castle courtyard and Riverbank scenes.
- On profiles, the scimitar is a small mark on the name line beside the account-type badge, and the achievement title below starts where the username starts. Leaderboard rows centre the scimitar on the name and title.
- The account-type badge sits on the name line, at the same size for every ironman type, and scales with the name.
- Ironman, Ultimate, Hardcore, Group, Hardcore Group and Unranked Group Ironman now use the official in-game chat badges.
- Achievement titles no longer show a "?"; hover the title itself for its description, like the scimitar and "the Generous".
- Your collection timeline shows every dated pet and log slot as a lollipop: a stem from the day you got it up to a picture of the item or pet (gold for pets). A month strip runs along the bottom with the years beneath; zoom in and it switches to days. Scroll, pinch or use the buttons to zoom, and drag to move; nearby collections share one picture with a count until you zoom in. Tap a picture to see everything from that day. Choose Both, Pets or Collection log, and All time, Past year or Past 30 days.
- Insights keeps the dry meter, pets by category and the collection timeline. The Road to max and Road to every pet projections are gone.
- The site is served only at spoonedosrs.com: deploys no longer re-enable the Worker's workers.dev address or version preview URLs.
- The account menu shows a hidden donation inline beside Supporter, "Link another account" no longer has an arrow, and Sign out spans the footer with Privacy & account details as a small link underneath.
- Account settings: Public and Private are equal-size buttons, and the Discord section uses the Discord logo.
- Skills with no XP never show a Hiscores rank colour or crown, whatever rank a source reports.
- Leaderboard loading rows take the space of the tallest loaded row (a long name with its title), so the board no longer jumps when it loads.
- Headings and paragraphs no longer leave a single word alone on their last line.
- The Discord logo in account settings no longer sits on a coloured tile.
- Board ranks 1–3 get a gold, silver or bronze crown beside the name and a matching rank number, on every leaderboard and the home page.
- Bronze, silver and gold Hiscores ranks are easier to tell apart: copper bronze, cool silver and bright gold glows, edges and a faint tile tint, on skills and boss ranks.
- The profile loading skeleton uses the profile's own layout, so panels open where they finish instead of shifting.
- A background refresh every ten minutes gives profiles that never had a full pull one pass over OSRS Hiscores, RuneProfile, TempleOSRS and Wise Old Man (two at a time, spaced for TempleOSRS), starting with claimed names. Private profiles and unlinked names are skipped.
- Unclaimed profiles saved in the older full format (for example after a name was unlinked) now get the same daily all-source pull as other searched names, keeping their manual records. Previously they only ever refreshed OSRS Hiscores.
- The live site check explains each source it could not read (for example, a player not tracked on RuneProfile) and can sync a chosen player through the optional `DEPLOY_CHECK_PLAYER` Actions variable.
- The account menu shows your Discord picture, uses the RuneScape settings wrench instead of cogs, and "Link another account" is now a matching row that opens a one-line name field with a Link button.
- Account settings show your Discord picture and each profile's character head. Visibility and the tick boxes for what your profile shows sit together in one compact card, and "Save privacy" is a clearer button that says when changes are unsaved and when they are saved.
- The Discord section is now a single "Sync Discord roles" button: if you're in the SpoonedOSRS server, your website staff and supporter roles are applied there within a few minutes. The site never changes your server nickname.


## 0.1.0-beta.2 — 2026-10-07

Second beta: searching a name shows everything public about it, and leaderboard previews are rebuilt for phones.

- Searching a new name pulls OSRS Hiscores, RuneProfile, TempleOSRS and Wise Old Man at once, so the profile shows stats, the collection log, pets, quests, diaries and combat achievements before anyone claims it. Unclaimed names repeat the full pull at most daily (TempleOSRS allows one request every 12.5 seconds site-wide); other searches refresh Hiscores only. A busy source never removes data that was already found.
- Every leaderboard preview shows the same Pets, Collection log and Total level cards (Combat tasks instead of the collection log on the Combat achievements board), then one summary row: skills maxed, pets collected, collections complete, combat tiers complete or quests complete.
- Only the board's own category opens in detail. The Combat achievements board opens tier progress; the skill bar chart and hint text are gone.
- Collection log previews use the profile's activity icons and progress tiles, with a category dropdown beside search. The collection page has a header with icon, count and progress bar, and pets and items share in-game style slots with quantities.
- Top-ranked skills glow like ranked bosses, with a faint bronze, silver or gold tile edge; the record holder's crown sits in the tile's free space.
- Leaderboard totals stay right-aligned on phones, and previews use a lighter "View full profile" link.
- Cross-site writes are refused with 403 everywhere; some routes reported them as a 503 "could not save" error.
- Staff, moderation, guide, privacy and account feature checks run on every pull request and release against the production build (`npm run test:integration`), including a new check for staff ranks, the audit trail and corrections review.
- A Live site check runs after every push to `main` and every six hours: version, security headers, signed-out boundaries, Discord login, a public all-source search probe and, with `DEPLOY_CHECK_SECRET`, a signed real sync.

See [release notes](releases/0.1.0-beta.2.md).

## 0.1.0-beta.1 — 2026-10-07

First beta deployed for testers. Beta versions deploy to production from `main`; release candidates never do.

- Fix every Hiscores, RuneProfile, Temple and Wise Old Man refresh failing on Cloudflare with "Invalid redirect value". Provider redirects are still never followed, and a test runs the provider client in the Workers runtime.
- Start the one-minute refresh cooldown only after a refresh is saved. Failed refreshes and player searches no longer make players wait.
- Limit each Discord account to 10 reserved RuneScape names, counting unlinked names, so names cannot be squatted in bulk.
- Show players only the site's own error messages; runtime and database errors fall back to a plain retry message.
- Send HSTS on production responses, update sharp to 0.35.5 and remove an unused header-trusting sign-in helper.
- Check Discord login, name claiming and all-source sync against the production build on every pull request (`npm run test:beta`).
- Verify a real provider sync after every production deploy through a signed `/api/health/sync` check (`DEPLOY_CHECK_SECRET`).
- Read database, Discord and owner identifiers from Workers Builds variables instead of source code.
- Give the type check its own 4 GB heap so cold builds succeed without extra build settings.

See [release notes](releases/0.1.0-beta.1.md).

## 0.1.0-rc.4 — 2026-10-07

- Highlight top-ranked skills with shared gold, silver and bronze styling on profiles and leaderboard previews.
- Crown current synced rank #1 skills and expose rank tiers in tooltips and accessible labels.
- Respect reduced-motion preferences for the record-holder glow.

## 0.1.0-rc.3 — 2026-10-07

- Fit full XP values within leaderboard columns and place the skill filter right of search.
- Browse collection previews through category and activity progress tiles, search and pagination.
- Use all-source refresh consistently for profile callbacks.
- Fix cold GitHub verification memory capacity and stop tracking generated compiler caches.

Versions describe reviewed source snapshots. A changelog entry does not mean a
version has been deployed. Deployment is verified separately against the live
site and Cloudflare build result.

## 0.1.0-rc.2 — 2026-10-07

- Use labelled staff navigation with a collapsible mobile menu and a staff-only header shortcut.
- Search destination Discord accounts by username, ID or linked RuneScape name when preparing relink requests.
- Keep leaderboard totals in the right column on phones and remove follower pets from ranking rows.
- Rebuild the castle courtyard with an arched gate, watchtowers, stonework and garden borders.

See [release notes](releases/0.1.0-rc.2.md).

## 0.1.0-rc.1 — 2026-10-07

First release candidate for the community tracker, profile customisation,
document-style guides, moderation workflows and shared upstream request
controls. This candidate is under verification and has not been published as a
stable release.

See [release notes](releases/0.1.0-rc.1.md) for scope, database requirements and
known limitations.
