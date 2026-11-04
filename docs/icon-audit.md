# Icon audit: our drawings and the game's own icons

October 2026. The owner's decision: use the game's own icons everywhere the game has one, **except** navigation (header and
nav buttons), our graphs and charts, skill icons, boss and activity icons, the combat achievement icons we made and the quest
difficulty icons. Everything else (the collection log and the rest) shows the natural game icon.

Our drawings are the icon pack in `public/icons` (AI-generated, `artwork/ui-skills`, installed by
`scripts/install-icon-pack.mjs`) and the map set in `public/icons/map` (OpenAI image generation, see
`public/ASSET-SOURCES.txt` and `docs/icon-requests.md`). No drawing was deleted: unused ones are listed at the end.

Where the game art comes from:

- `public/icons/map/game/<sprite>.png`: the world map's map-function sprites from the game cache (2×).
- `public/icons/game/*.png`: interface sprites from the game cache, built by `scripts/build-game-sprites.mjs` (4×): the four
  spellbook tabs, the minigame tab, the damage hitsplat (and the three fight stops composed from it), the PK skull, chat
  bubbles, the bank search glass and the inventory backpack.
- `public/ui/*.png`: the OSRS Wiki copies of interface icons the pack was drawn from (collection log, quest point,
  diaries, quest list, friends, chats) and the cache's chat badges (`public/ui/account-modes`).
- `public/items/<id>.png`: real item icons.

## Switched to the game's icon

| Our icon | Where it showed | Now |
| --- | --- | --- |
| `navigation/collection-log-icon.png`, `collection-log.png` (collection log meaning) | Profile tab and Overview row, Collection log header and empty state, collector preview, leaderboard and community categories, badges for log milestones, share card, staff drop corrections and player rows, guide Drop table / Drop odds section picker, item image fallbacks (guides, requirement tiles, guide map stop cards, collection log page fallback in `lib/artwork.ts`), loading skeleton | `/ui/collection-log-icon.png`, `/ui/collection-log.png` |
| `navigation/quest-point-icon.png` | Profile Quests tab, Overview row, quest list and pop-ups, quest requirements (guides, quest and diary panels, references, topics, templates), Quest complete badge, leaderboard category, staff progress, history and case panels, Travel options quest switch | `/ui/quest-point-icon.png` |
| `navigation/achievement-diaries-icon.png` | Profile Diaries tab, Overview row, diary list and task pop-ups, diary requirements, Diary complete badge, staff progress, guide templates and topics | `/ui/achievement-diaries-icon.png` |
| `navigation/quest-list-icon.png` | Staff queues and activity, guide Requirements and Map section picker, guide list kind | `/ui/quest-list-icon.png` |
| `community/friends-list.png` | Staff Players and Team panels, player rows | `/ui/friends-list.png` |
| `community/friends-chat.png`, `clan-chat.png`, `game-chat.png` | Home "Join us in game" banner (Community) | `/ui/friends-chat.png`, `/ui/clan-chat.png`, `/ui/game-chat.png` |
| `ranks/max-cape.png` | Max cape badge, Maxed timeline milestone | Max cape item `/items/13280.png` |
| `account-modes/*.png` | Account type badge next to names, share card | The game's chat badges `/ui/account-modes/<mode>.png` |
| `map/quest`-style quest point, `/items/995.png` bank, `map/fairy-ring`, `spirit-tree`, `glider`, `balloon`, `mushtree`, `quetzal`, `boat`, `charter`, `canoe`, `minecart`, `magic-carpet`, `lever` | World map markers, layer buttons, search results, place card, route steps, Travel options | The game's Quest (1454), Bank (1453) and Transportation (1504) map functions (the game draws every transport with it) |
| `map/passage.png` (arch) with our arrows | Ways into and out of dungeons on the world map and guide maps, route steps | The game's Dungeon (1534) and Map link (1535) map functions |
| `map/shortcut.png`, `map/poh-portal.png` | Travel options, route steps | Agility shortcut (1518) and House portal (1505) map functions |
| `map/spellbook-*.png` | Travel options spellbooks, Teleports layer button, spells without art | The game's spellbook tabs `/icons/game/spellbook-*.png` |
| `map/interface/minigame-star.png` | Minigame teleports (markers, lists, Travel options) | The game's minigame tab `/icons/game/minigame.png` |
| `map/jewellery/*.png` | Teleport markers and lists, Travel options (jewellery and house jewellery) | The item icons (`TELEPORT_ITEM`) |
| `map/tablets/*.png` | Teleport markers and lists, Travel options | The tablet and scroll item icons (`TABLET_ITEM`) |
| `map/teleport-faceted.png` | A teleport with no art of its own | Law rune `/items/563.png` |
| Quetzal (our drawing) for the Quetzal whistle | Quetzal whistle teleports | Basic quetzal whistle `/items/29271.png` (added) |
| Guide stop: start (`quest-point-icon`) | Guide map pins, stop list, editor | Quest start map function (1454) |
| Guide stop: talk (`talk-faceted.png`) | 〃 | The game's chat bubbles `/icons/game/chat.png` |
| Guide stop: fight, ranged, magic (our hitsplat) | 〃 | The game's red hitsplat with the Attack, Ranged and Magic skill icons `/icons/game/fight-*.png` |
| Guide stop: item (`item.png`) | 〃 | Inventory backpack `/icons/game/inventory.png` |
| Guide stop: dig (`dig.png`) | 〃 | Spade `/items/952.png` |
| Guide stop: search (`search.png`) | 〃 | Bank search glass `/icons/game/search.png` |
| Guide stop: danger (`danger.png`) | 〃 | PK skull `/icons/game/skull.png` |
| Guide stop: teleport (Magic skill icon) | 〃 | Law rune `/items/563.png` |
| World map area names (ours) and "Map icon" hover names | World map | The game's own area labels and the world map key's names for every map function it uses (132, from enum 1713) |

## Kept (the owner's exceptions)

| Icon | Where | Why |
| --- | --- | --- |
| `navigation/stats-icon.png`, `collection-log-icon.png` (Guides), `world-map-icon.png`, `community/support-coins.png`, Rocky | Header and phone menu buttons (`lib/features.ts`), page titles that mirror their nav tile (Guides, Support, In development), staff side navigation (`StaffNavigation`), staff Guides areas, guide links and the guide list (the book means Guides there) | Navigation |
| `navigation/stats-icon.png`, `skills-icon.png`, charts | Leaderboard, Overview stat tiles, player search, base-level milestones, timeline | Graphs and charts |
| `icons/skills/*` | Skills everywhere, composed into the fight stops | Skill icons |
| `public/bosses/*`, collection log page icons (`lib/artwork.ts`) | Boss ranks, activities, collection log pages | Boss and activity icons (official hiscore art) |
| `navigation/combat-achievements*.png`, `tiers/ca-*.png` | Combat tab, CA tiers, staff planning | Combat achievement icons we made |
| `tiers/novice … special.png` | Quest difficulty | Quest difficulty icons |

## Kept: no game equivalent, or outside this change

| Icon | Where | Note |
| --- | --- | --- |
| `map/step.png` (boot) | Plain guide stops | The game has no walk-here icon |
| `map/cutscene.png` | Cutscene stops | Nothing in the game |
| `map/town.png` | Town results in world map search (towns are drawn as the game's area names on the map) | Nothing in the game |
| `community/settings-icon.png` (wrench) | Profile, staff controls, account menu, Travel options button, Account settings | A settings button is an interface action and the account menu and Account settings (another branch) use it; kept everywhere so one concept keeps one icon. The game's wrench is `/ui/settings-icon.png` if the owner wants it. |
| `community/supporters-heart.png`, `sponsor-coin.png`, `ranks/*` scimitars, owner lava blade, crowns | Supporters, staff and supporter ranks, leaderboard podium | Site roles, not game things; the owner's own art (sponsor coin). Real scimitar items exist (1331, 1333, 4587, 12389) if the owner wants rank badges switched too. |
| `community/discord.png` | Discord links | Third-party brand |
| Guide emojis (`lib/guide-emojis.ts`) | `:name:` in guides | Mirror the Discord server's emoji pack |
| RuneLite plugin page (`app/plugin/*`) | Plugin page | Handled separately (another branch is reworking it) |
| Credits page, Account settings | | Other branches are changing them |
| `navigation/grand-exchange-icon.png` | Price cards | Already the game's GE icon |

## Our drawings no longer used anywhere

Left in place (other branches or later work may use them): `map/fairy-ring`, `spirit-tree`, `glider`, `balloon`,
`mushtree`, `quetzal`, `boat`, `charter`, `canoe`, `minecart`, `magic-carpet`, `lever`, `passage`, `shortcut`,
`poh-portal`, `home-teleport`, `teleport-faceted`, `talk-faceted`, `item`, `dig`, `search`, `danger`,
`fight-melee`, `fight-ranged`, `fight-magic`, `spellbook-*`, `interface/minigame-star`, every `map/jewellery/*` and
`map/tablets/*`, `navigation/quest-list-icon`, `community/game-chat`, `community/join-chat`, `account-modes/*` (still
checked by `lib/icon-pack.test.ts`). The icon pack's collection log, quest point, diary, friends, chat and Max cape
drawings are still used by navigation, guides, the plugin page or emojis.

## World map decluttering

`lib/world-map-game-icons.ts` (`gameIconZoom`, `gameIconPriority`): zoom 6 shows only transport, docking points,
dungeons, altars, the Grand Exchange, minigames, raids, house portals and Slayer masters; banks and quest starts join at
7 (with our bank and quest markers); shops, services and crafting spots at 8; common resources (water, ranges, fishing
spots, rare trees, rocks, shortcuts, farming patches, tutors and the like) from 9. Where icons overlap our markers win,
then key icons, services and resources in that order.
