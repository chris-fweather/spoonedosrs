/** The profile's tabs, shared by the loaded profile (Tracker) and its loading skeleton. Insights and Connections show to the owner only.
 * Navigation uses the site's own icon set (public/icons/navigation); the pages behind the tabs keep the game's icons. */
export const PROFILE_TABS: {n: string; img: string}[] = [
  {n: 'Overview', img: '/icons/navigation/stats-icon.png'},
  {n: 'Pets', img: '/brand/rocky-mascot.webp'},
  {n: 'Collection log', img: '/icons/navigation/collection-log-icon.png'},
  {n: 'Quests', img: '/icons/navigation/quest-point-icon.png'},
  {n: 'Diaries', img: '/icons/navigation/achievement-diaries-icon.png'},
  {n: 'Combat', img: '/icons/navigation/combat-achievements.png'},
  {n: 'Insights', img: '/icons/navigation/stats-icon.png'},
  {n: 'Connections', img: '/icons/community/settings-icon.png'},
];
export const OWNER_TABS = ['Insights', 'Connections'];
