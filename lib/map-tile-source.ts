/** Which copy of the world map tiles the site serves, and whom the map credits. No server code: the map front-end and the
 * Credits page read this too, so the credit always follows the tiles. See docs/map-tiles.md. */
import {IS_DEV_ENVIRONMENT} from './environment';

/** Mejrs' render (github.com/mejrs/layers_osrs): kept in R2 under this prefix, fetched from GitHub when R2 has no copy. */
export const MEJRS_TILES = 'mejrs-master';

/** The R2 prefix each environment serves. `mejrs-master` is Mejrs' render; `spooned-<cache date>` is our own render from
 * the game cache (.github/workflows/map-tiles.yml), served from R2 only. Switch dev first, review, then production. */
export const TILE_VERSIONS = {production: 'spooned-maps-2026-11-03', dev: 'spooned-maps-2026-11-03'} as const;

/** The copy this deployment serves (tests and local runs follow production). */
export const TILE_VERSION: string = IS_DEV_ENVIRONMENT ? TILE_VERSIONS.dev : TILE_VERSIONS.production;

/** Only Mejrs' prefix or one of ours (`spooned-` then lower-case letters, digits and dashes) is a valid version. */
export const isTileVersion = (version: string) => version === MEJRS_TILES || /^spooned-[a-z0-9][a-z0-9-]{0,40}$/.test(version);

/** Whether a version is our own render (R2 only, no GitHub fallback). */
export const isOwnTiles = (version: string) => version !== MEJRS_TILES;

/** Whether a version is drawn per world map (`spooned-maps-<cache date>`, .github/workflows/map-tiles.yml): each of the
 * game's maps (Gielinor Surface, Misthalin Underground, …) has its own tiles under `<version>/<mapId>/`, laid out as
 * public/world-map/maps.json says (lib/world-maps.ts). Older versions are one sheet in game tiles. */
export const hasMaps = (version = TILE_VERSION) => /^spooned-maps-/.test(version);
/** The surface's map id (the game's Gielinor Surface), for addresses that name no map. */
export const SURFACE_MAP = 0;
/** A map id: the game's (0 and up) or -1 for the areas no map of the game shows. */
export const isMapId = (m: number) => Number.isInteger(m) && m >= -1 && m <= 4095;

/** A tile's address. The version is part of it so browsers, which keep tiles for a month, load the new copy after a
 * switch (the route itself always serves `TILE_VERSION`). A version drawn per map names the map (`map`, the surface when
 * left out); a single sheet never does. */
export const tileUrl = (z: number, p: number, x: number, y: number, version = TILE_VERSION, map?: number) =>
  `/api/map-tile?z=${z}&p=${p}&x=${x}&y=${y}${hasMaps(version) ? `&m=${map ?? SURFACE_MAP}` : ''}&v=${version}`;

/** The tile map's attribution line (Leaflet's corner credit). */
export const mapAttribution = (version = TILE_VERSION) => isOwnTiles(version)
  ? 'Map tiles: Spooned OSRS, rendered with <a href="https://github.com/runelite/runelite" target="_blank" rel="noreferrer">RuneLite</a> · © Jagex'
  : 'Map tiles: <a href="https://github.com/mejrs/layers_osrs" target="_blank" rel="noreferrer">Mejrs</a> · © Jagex';
