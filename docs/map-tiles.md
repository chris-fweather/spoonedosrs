# World map tiles

The guide maps and the world map draw the game world from 256 px PNG tiles served by `/api/map-tile` (lib/map-tile.ts).
The site serves one of two copies: Mejrs' render ([layers_osrs](https://github.com/mejrs/layers_osrs)), or our own
render, made from the game cache with RuneLite's map tools and stored in our R2 bucket. This page covers our own render
and how the site switches between them.

## The game's maps

The game's own world map is not one sheet: its dropdown lists separate maps (Gielinor Surface, Misthalin Underground,
Taverley Underground, Ardent Ocean Underground, …). Each is put together from map squares (64 × 64 tiles) and zones
(8 × 8 tiles) of the game world, every one drawn at a display position of its own: dungeons move from their blocks far
north of the surface to sensible spots, and nothing else is drawn around them. Our renders since `spooned-maps-…` do the
same (the OSRS Wiki's maps work this way too):

- The cache's WORLDMAP index has, per map, a `details` file (id, name, origin, whether it is the surface) and a
  `compositemap` file of the same name listing its squares and zones: source square or zone, display position, and its
  floors (`minLevel`, `levels`). RuneLite reads both (`WorldMapLoader`, `WorldMapCompositeLoader`,
  `MapSquareDefinition`, `ZoneDefinition`); `SpoonedMapTiles.java` writes them to `worldmaps.json`.
- `lib/world-maps.ts` turns that layout into each map's game tile → display tile mapping and back (`toDisplay`,
  `toGame`). A square or zone shows the game's floors from `minLevel` up as the map's floors 0, 1, …; where two could draw
  the same spot, one whose own `levels` include it wins, and a zone wins over a square. The slicer draws the tiles with the
  same code, so the tiles and the front-end always agree.
- Map -1, "Other areas", holds every rendered square no map of the game uses (instances, quest areas), where it is.
- `maps.json` (written next to the tiles and kept in the review sample) lists every map: id, name, surface, floors,
  display box, where it opens (`centre` in display tiles, `home` in game tiles) and its squares and zones. It is committed
  as `public/world-map/maps.json` and loaded through `worldMapData()` (app/world-maps.ts); it is only used when its
  `version` is the version served.

Everything on the maps (places, exits, the game's icons and names, routes, guide stops, search results, `/map?at=` links)
stays in game tiles and is drawn on whichever map shows it; a click is turned back into a game tile. Going to a tile opens
the map that has it (the map shown if it does, else the surface, else the first that does). Versions drawn before maps
existed (Mejrs', `spooned-2026-11-03`) are one sheet in game tiles: the site then offers two maps that move nothing, the
surface and everything else (`sheetMaps`).

## The tile scheme

`<z>/<p>_<x>_<y>.png`, the same names Mejrs uses. A version drawn per map (`spooned-maps-<date>`, `hasMaps` in
lib/map-tile-source.ts) adds the map: `<mapId>/<z>/<p>_<x>_<y>.png`, with x and y in that map's display tiles (the
surface's are the game's own), and the tile address carries `&m=<mapId>` (-1 to 4095; the route refuses an address without
one, and a single sheet refuses one with it).

- **z**, zoom −3 to 4: one game tile is 2^z pixels (zoom 2: 4 px, so a 256 px tile is one 64 × 64 map square, a region).
  Leaflet's zoom is z + 6 (app/map-canvas.ts `GAME_CRS`); zoom 4 is the most detailed tile (`MAX_NATIVE_ZOOM` 10).
- **p**, plane 0–3. An upper floor shows the ground floor at half brightness with the floor drawn over it, as Mejrs'
  tiles and the game's own map do.
- **x, y**: x counts tiles east from game x 0, y counts tiles north from game y 0, and the top of each image is north.
  The tile holding game tile (gx, gy) at zoom z is `x = floor(gx·2^z/256)`, `y = floor(gy·2^z/256)`. Lumbridge Castle
  (3222, 3218) is `2/0_50_50.png`.
- No tile for open sea or outside the world: the route answers 404 and the map shows its background.

R2 keys are `<version>/<z>/<p>_<x>_<y>.png`, or `<version>/<mapId>/<z>/<p>_<x>_<y>.png` per map. `mejrs-master/` is
Mejrs' copy (filled on demand from GitHub); `spooned-<cache date>/` and `spooned-maps-<cache date>/` are our renders,
uploaded whole.

## How the pipeline works

`.github/workflows/map-tiles.yml` runs on GitHub's runners, because the cache archive is not reachable from everywhere.

1. **Cache.** `scripts/map-tiles-openrs2.mjs` reads the [OpenRS2 Archive](https://archive.openrs2.org) list
   (`caches.json`) and picks the newest live Old School cache whose files are complete and which has at least 99% of
   its map (XTEA) keys, unless a cache id is given. It downloads `disk.zip` (the game's own cache files) and `keys.json`,
   and turns the keys into RuneLite's format.
2. **Render.** The workflow checks out RuneLite at a pinned release (`RUNELITE_TAG`), adds
   `scripts/map-tiles/SpoonedMapTiles.java` to its `cache` module and runs it on Java 11. It uses RuneLite's
   `MapImageDumper` (BSD 2-Clause) to draw each map square on each plane on its own (`drawRegion`, which also draws the
   neighbouring squares' objects that reach in), at the dumper's 4 px per game tile: one zoom 2 tile per square. Icons
   and labels are off (the site draws its own). Square by square keeps memory small; the whole world as one image would
   be over 650 million pixels per plane. Squares with no key for their objects show terrain only; they are listed in
   `missing-keys.txt`. It also writes `worldmaps.json`, the game's maps (above).
3. **Slice.** `scripts/slice-map-tiles.mjs` (Node and sharp) puts each upper floor over the darkened ground floor, scales
   zoom 2 up to zoom 3 and 4 (nearest neighbour: crisp pixels, like Mejrs'), halves it down to zoom 1 … −3 (Lanczos),
   skips empty tiles and writes `manifest.json` (count, bytes, cache id and date, per map). It does this per map: each
   map's squares are first put together at their display positions from the rendered game squares, zone by zone, with
   transparency (the map's black) everywhere else, then sliced into `<mapId>/`; `maps.json` lists the maps. Without
   `worldmaps.json` (or with `--single true`) it slices one sheet in game tiles as before, and it can cut a whole-plane
   image from RuneLite's own `MapImageDumper` main (`--image <plane>:<file>:<west>:<north>`).
4. **Review artifact.** Every run keeps `map-tiles-sample-<version>` for 14 days: every map's zooms −3 to 1, zoom 2 of
   every map but the surface, every zoom and floor of the surface around six landmarks (Lumbridge, Falador, the Grand
   Exchange, Kourend, Prifddinas, Civitas illa Fortis), a picture of each map per floor (`previews/`), `maps.json`,
   `worldmaps.json`, the manifest, `render.json` and `missing-keys.txt`. With *full artifact*
   ticked it also keeps every tile as one tar for 7 days.
5. **Upload (optional).** With *upload* ticked and the credentials below in place, rclone copies every tile to
   `<bucket>/<version>/` over R2's S3 API, 64 at a time, then checks the count. A version is written once: the step
   stops if the prefix already has files, and it never writes `mejrs-master/`.

Expect roughly 200,000 tiles and 1–2 GB per render (zoom 4 is three quarters of them); about 10–30 minutes to render,
5–15 to slice and 30–60 to upload.

## Running it

- **From the Actions tab** (once the workflow file is on `main`): Actions → Map tiles → Run workflow. Leave the cache id
  empty for the newest cache, tick *upload* and pick the bucket (dev first) when you want it in R2.
- **Before then**, push any branch named `map-tiles/<something>` (for example `map-tiles/first-render` from `dev`): the
  push runs the render and keeps the sample, without uploading. To let a push run upload, set the repository variable
  `MAP_TILES_PUSH_UPLOAD` to `dev` (or `production`), push, and delete the variable afterwards. `MAP_TILES_CACHE_ID`
  pins the cache for push runs.

### Credentials for the upload

- Secret `CLOUDFLARE_R2_TOKEN`: in Cloudflare, R2 → Manage API tokens → Create API token, permission **Object Read &
  Write**, applied to **specific buckets only**: `spoonedosrs-dev-map-tiles` (and `spoonedosrs-map-tiles` when
  production should be filled too). Store the token value (not the S3 keys) in GitHub → Settings → Secrets and
  variables → Actions → Secrets. The workflow derives the S3 key pair from it (the token's id and the SHA-256 of its value).
- Variable `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account id (Variables tab).

## Reviewing a render

Download the sample artifact and check:

- `previews/<id>-<name>-plane-<p>.png`: each map as the game's dropdown shows it (Misthalin Underground with its many
  dungeons laid out side by side, Ardent Ocean Underground with the Karamja volcano, …), on black, with whole walls; upper floors
  darkened with their rooms on top.
- `manifest.json`: tile count and bytes in the expected range, `outsideRoute` 0 (tiles past what the route serves).
- `missing-keys.txt`: few or none (squares without walls and trees).
- The landmark tiles against the live site: open `/map` and the same place, or compare `2/0_50_50.png` with
  `https://raw.githubusercontent.com/mejrs/layers_osrs/refs/heads/master/mapsquares/-1/2/0_50_50.png`. Names, position
  and orientation should match exactly; colours and small details may differ.

## Switching the site to our tiles

1. Upload to the dev bucket. In `lib/map-tile-source.ts`, set `TILE_VERSIONS.dev` to the new version (for example
   `spooned-maps-2026-11-06`) in a PR into `dev`, with that render's `maps.json` (from its sample artifact) as
   `public/world-map/maps.json`: the maps only switch on when the two match. The committed `maps.json` is `spooned-maps-2026-11-03`
   (OpenRS2 cache 2757): upload with cache id 2757 and that version is a one-line switch. Review the world map, guide maps and every floor on dev.spoonedosrs.com.
2. Run the workflow again for the production bucket with the same cache id and version, then set
   `TILE_VERSIONS.production` in the release PR, with a CHANGELOG line.

When a version is ours, the route reads R2 only: no GitHub fallback, a missing tile is open sea (404), an R2 error is a
502 that is never cached. The edge cache key and the tile addresses (`&v=<version>`) carry the version, so neither the
edge nor browsers (which keep tiles for a month) show the old copy after a switch. The map's corner credit and the
Credits page follow the version on their own (`mapAttribution`, app/credits/page.tsx); docs/third-party-content.md is
updated by hand in the same PR. Going back is the same one-line change.

Since 1.0.0 both production and dev serve `spooned-maps-2026-11-03` (copied to the production bucket from dev, 224,872 files). Mejrs' copy stays in R2 under `mejrs-master/` and is no longer served; it can be deleted in the Cloudflare dashboard.

## How often to re-run

After a game update that changes the map: new areas, a reworked city, a new quest region. Not weekly; the tiles only
change when the world does. Use a new version each time (the date does this) and switch as above, so a bad render never
replaces a good one in place. If the RuneLite render fails after an update, bump `RUNELITE_TAG` to the newest
`runelite-parent-*` release.
