/** The address of a world map data file (public/world-map/). Browsers keep these files for up to a day, so each one
 * carries the release's build ID: a new deploy always loads the data it was built with, never yesterday's copy. */
declare const __SPOONED_RELEASE__: {buildId: string} | undefined;
const BUILD = typeof __SPOONED_RELEASE__ === 'undefined' ? '' : __SPOONED_RELEASE__.buildId;
export const worldMapData = (file: string, build = BUILD) => `/world-map/${file}${build ? `?v=${build}` : ''}`;
