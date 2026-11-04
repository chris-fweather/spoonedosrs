# Icon requests (map and guides)

> **Superseded (October 2026).** The owner chose the game's own icons wherever the game has one, so most of the drawings below are no longer used. See [icon-audit.md](icon-audit.md) for what each place shows now and which of our drawings are kept. This brief stays for the icons that are still ours (plain stop, cutscene, town).

A brief for generating new icons. Each one replaces a stand-in currently borrowed from a skill or item icon.

## Style for every icon

- In the style of the Old School RuneScape interface: chunky pixel shading, a 1px dark outline, a soft drop shadow down and to the right, and no background or box.
- Transparent PNG at 128×128, with the artwork filling about 85% of the canvas. It is shown at 18 to 32px, so it must read clearly at 18px: one bold silhouette with few details.
- It must match the existing pack in `public/icons/` (for example `public/icons/community/game-chat.png` and `public/icons/navigation/quest-point-icon.png`).
- Save each file under `public/icons/map/` with the file name given below.
- Original artwork only. Don't trace or copy Jagex sprites.

## Guide map stops (lib/guide-map.ts, `MAP_PIN_ICON`)

| File | Meaning | Replaces | Notes |
|---|---|---|---|
| `talk.png` | Talk to an NPC | game-chat icon | A speech bubble with three dots, in a white or cream bubble. |
| `fight.png` | Fight or kill something | Hitpoints heart (reads as "health", not "fight") | A single red hitsplat (the jagged red splash) with a small sword over it. |
| `fight-melee.png` | Melee fight | — | Red hitsplat with a small sword. |
| `fight-ranged.png` | Ranged fight | — | Red hitsplat with a small arrow. |
| `fight-magic.png` | Magic fight | — | Red hitsplat with a small blue magic bolt. |
| `danger.png` | Danger, such as multi-combat, poison or PvP | Hitpoints heart | A skull, or a yellow warning triangle in the game's colours. |
| `item.png` | Pick up or use an item | collection log icon | An open hand or a small sack. |
| `step.png` | Plain step or walk-to point | numbered dot | A small boot or footprints. Optional, since numbered dots work. |
| `dig.png` | Dig here | — | A spade, for clue and quest steps. |
| `search.png` | Search an object | — | A magnifying glass. |
| `cutscene.png` | Cutscene or dialogue choice | — | A film strip or a speech bubble with a "?" in it. |

The quest start (quest point icon), bank (coins) and teleport stops are fine as they are.

## World map places (lib/world-map-places.ts, `KIND_ICON`)

| File | Meaning | Replaces |
|---|---|---|
| `boat.png` | Boats, ships and charter ships | Sailing anchor icon (the owner wants it swapped) |
| `fairy-ring.png` | Fairy ring | Dramen staff item |
| `spirit-tree.png` | Spirit tree | Farming icon |
| `glider.png` | Gnome glider | Agility icon |
| `balloon.png` | Hot air balloon | Agility icon (the same icon as glider, so the two clash) |
| `mushtree.png` | Magic mushtree (Fossil Island) | Farming icon (clashes with spirit tree) |
| `quetzal.png` | Quetzal transport (Varlamore) | Hunter icon |
| `teleport.png` | Spell teleport landing spot | Magic icon |
| `town.png` | Town or city label | Achievement diaries icon |
| `minecart.png` | Minecart / Keldagrim carts | — (new kind) |
| `canoe.png` | Canoe stations | — (new kind) |
| `charter.png` | Charter ship (if kept separate from boats) | — |
| `poh-portal.png` | Player-owned house portal | — |
| `obelisk.png` | Wilderness obelisk | — |

Teleport jewellery and other items keep their official item art, since they already use `/items/<id>.png`.

## Travel options panel (app/TravelOptions.tsx)

| File | Meaning | Replaces |
|---|---|---|
| `spellbook-standard.png`, `spellbook-ancient.png`, `spellbook-lunar.png`, `spellbook-arceuus.png` | One per spellbook | Magic icon on all four |
| `home-teleport.png` | Home teleport | Quest list icon |
| `minigame-teleport.png` | Minigame teleports (grouping) | Friends chat icon |

## World map sidebar tabs (app/WorldMap.tsx, `wm-tabs`)

**Done (2026-10-24):** `public/icons/map/interface/explore.png` and `public/icons/map/interface/directions.png` (Codex, branch codex/map-icon-comparison, commit 6723b8ef) are the Explore and Directions tab icons. The Travel options tab now shows the Lumbridge Home Teleport spell icon instead of the wrench ("Teleports & travel").

Interface icons, so these are **our own drawings**, not game sprites: they sit beside the site's navigation pack (`public/icons/navigation/`, `public/icons/community/settings-icon.png`) and must look like the same set. Today the two tabs borrow plain line icons (lucide `Search` and `Navigation`), which look out of place next to the wrench.

- Same style as the rest of this brief: OSRS-interface pixel shading, 1px dark outline, soft drop shadow down and to the right, no background or box.
- Transparent PNG at 128×128, artwork filling about 85% of the canvas. Shown at 16 to 20px in the tabs (and up to 24px elsewhere), so one bold silhouette that reads at 16px.
- Same weight, light direction and palette as the wrench (`settings-icon.png`): warm metal and wood tones, gold highlights for the active state are added by the site, not drawn in.
- Save under `public/icons/navigation/`.

| File | Meaning | Replaces | Notes |
|---|---|---|---|
| `search-icon.png` | Explore tab: search the map | lucide `Search` | A magnifying glass: round lens with a pale glint, short thick wooden or brass handle angled down to the right. |
| `directions-icon.png` | Directions tab: plan a route | lucide `Navigation` | A direction arrow: a bold arrowhead pointing up and to the right, like a signpost arrow, or a small wooden signpost with one arrow. Must not read as a cursor. |
| `settings-icon.png` | Travel options (the wrench) | — | Already ours (`public/icons/community/settings-icon.png`); listed as the reference the two new icons must match. Redraw only if the new pair makes it look out of set. |

## When they arrive

Drop the files into `public/icons/map/` and tell Claude. Swapping the paths in `MAP_PIN_ICON`, `KIND_ICON` and `TravelOptions.tsx`, and adding the new stop kinds (talk, fight, dig, search) to the guide editor, takes a few minutes.

## Status (October 2026)

The map icon set from `codex/map-icon-comparison` is in `public/icons/map/` and wired in: `KIND_ICON`, `placeIcon` and `teleportGroupIcon` in `lib/world-map-places.ts` (places, route steps, Travel options), `MAP_PIN_ICON` in `lib/guide-map.ts` (stop kinds, including fight, ranged, magic, dig, search and cutscene). The fight icons are the existing Attack, Ranged and Magic skill art over the hitsplat backing, flattened to PNG. Exit markers use `EXIT_ICON` in `lib/world-map-exits.ts`: our arch (`passage.png`) for every way into another area (caves, tunnels, trapdoors, holes, a ladder down into a dungeon, and the way back out); the map adds the up or down arrow itself. Like the game's world map, the maps no longer offer floor changes, so stairs and ladders that only change floor are not drawn (`areaExits`). The game's own Dungeon icon (the red "!") and minimap ladder were tried and dropped. The header's Map button uses the game's world map globe (`public/icons/navigation/world-map-icon.png`, built by `scripts/build-game-sprites.mjs`).

Teleports: spells show the game's spell icon (`public/icons/spells`, via `spellIcon`); tablets our tablet art (`public/icons/map/tablets`, via `tabletIcon`) and jewellery our jewellery art (`JEWELLERY_ICON`); scrolls, the newer tablets without art of ours, capes and other items keep the real item icon (`TELEPORT_ITEM`), all through `teleportIcon` in `lib/world-map-places.ts`. Still on our art: spellbooks, minigame teleports and house portals; Battlefront spell, Hallowed crystal shard and teleport spheres have no art of their own (the other books' home teleports show Lumbridge Home Teleport).


