/** The profile's tabs, shared by the loaded profile (Tracker) and its loading skeleton. Insights and Connections show to the owner only. */
export const PROFILE_TABS: {n: string; img: string}[] = [
  {n: 'Overview', img: '/icons/navigation/stats-icon.png'},
  {n: 'Pets', img: '/brand/rocky-mascot.webp'},
  {n: 'Collection log', img: '/ui/collection-log-icon.png'},
  {n: 'Quests', img: '/ui/quest-point-icon.png'},
  {n: 'Diaries', img: '/ui/achievement-diaries-icon.png'},
  {n: 'Combat', img: '/icons/navigation/combat-achievements.png'},
  {n: 'Insights', img: '/icons/navigation/stats-icon.png'},
  {n: 'Connections', img: '/icons/community/settings-icon.png'},
];
export const OWNER_TABS = ['Insights', 'Connections'];
