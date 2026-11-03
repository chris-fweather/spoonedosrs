# Third-party content

Spooned OSRS is an independent fan project. It is not affiliated with, endorsed by or sponsored by Jagex Ltd.

The MIT licence in [LICENSE](../LICENSE) covers this project's **source code** only. The content below keeps its own owners and terms, and the code licence does not relicense it.

| Content | Where | Owner and terms |
| --- | --- | --- |
| Old School RuneScape artwork: item, pet, boss and interface sprites, chat badges, character and item models | `public/items`, `public/pets`, `public/bosses`, `public/drops`, `public/ui`, `public/models`, `public/portraits` | © Jagex Ltd; all rights reserved. Old School RuneScape and RuneScape are trademarks of Jagex Ltd. |
| Site icon set (redrawn skills, tiers, ranks and interface icons) | `artwork/ui-skills`, `public/icons` | Drawn for this site after Jagex designs; the underlying designs remain Jagex's. |
| OSRS Wiki drop rates, reference text and some images | bundled data in `lib/`, `public/bosses` | OSRS Wiki contributors, [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Attribution and revisions are recorded in [public/DATA-SOURCES.txt](../public/DATA-SOURCES.txt). |
| Collection-log catalogue and item icons | `lib/`, `public/items` | Derived from [RuneProfile](https://github.com/ReinhardtR/runeprofile) data rendered from the game cache; see [public/ASSET-SOURCES.txt](../public/ASSET-SOURCES.txt). |
| RuneScape Bold font | `public/fonts/runescape-bold.*` | No redistribution licence is known; see [public/ASSET-SOURCES.txt](../public/ASSET-SOURCES.txt). |
| Share-card sans font | `public/fonts/share-sans.ttf` | SIL Open Font License; see [public/fonts/share-sans-LICENSE.txt](../public/fonts/share-sans-LICENSE.txt). |
| World map travel data: collision map, transports, teleports, banks | `public/world-map` (built by `scripts/build-world-map.mjs`; `exits.json`, the stairs, ladders and entrances on the maps, by `scripts/build-map-exits.mjs`); `lib/guide-travel.json`, guide travel hover cards (built by `scripts/build-guide-travel.mjs`) | Derived from [Shortest Path](https://github.com/Skretzo/shortest-path), BSD 2-Clause; notice in [public/world-map/NOTICE.txt](../public/world-map/NOTICE.txt). |
| World map quest start positions | `public/world-map/places.json` | Derived from [Quest Helper](https://github.com/Zoinkwiz/quest-helper), BSD 2-Clause; notice in [public/world-map/NOTICE.txt](../public/world-map/NOTICE.txt). |
| World map shortcut and fishing spot details (hover cards) | `public/world-map/icon-details.json` (built by `scripts/build-map-icon-details.mjs`) | Derived from [RuneLite](https://github.com/runelite/runelite) (AgilityShortcut, FishingSpot, FishingAction) and [Shortest Path](https://github.com/Skretzo/shortest-path), both BSD 2-Clause; notice in [public/world-map/NOTICE.txt](../public/world-map/NOTICE.txt). |
| World map tiles | served through `/api/map-tile` | Rendered from the game by [Mejrs](https://github.com/mejrs/layers_osrs); the map itself © Jagex Ltd. |
| Rocky mascot and site branding | `public/brand` | Spooned OSRS. |

The player-facing summary is the [Credits page](../app/credits/page.tsx) (`/credits`); update it when this table changes.

If you reuse this code for another project, replace the artwork, fonts and data, or confirm you have the rights to use them.
