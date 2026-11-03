import type {ReactNode} from 'react';
import {LegalPage} from '../LegalPage';
import {PETCORD_SHEET} from '@/lib/petcord';
import {CreditsPeople} from './CreditsPeople';
export const metadata={title:'Credits · Spooned OSRS',description:'The people, projects and data sources behind Spooned OSRS.'};

/** An outside link, opened in a new tab. */
const X=({href,children}:{href:string;children:ReactNode})=><a href={href} target="_blank" rel="noreferrer">{children}</a>;
const CC=<X href="https://creativecommons.org/licenses/by-nc-sa/3.0/">CC BY-NC-SA 3.0</X>;

export default function Page(){return <LegalPage title="Credits & thanks" updated="23 October 2026" contact={false}>
 <p>Spooned OSRS is built on the work of the Old School RuneScape community. Thank you to everyone below.</p>

 <CreditsPeople/>

 <h2 id="game">Game data &amp; art</h2>
 <ul className="credits-list">
  <li><b>Old School RuneScape</b> by <X href="https://www.jagex.com">Jagex Ltd</X>. Item, pet, boss and interface artwork, chat badges, character and item models and the world map are © Jagex Ltd. Old School RuneScape and RuneScape are trademarks of Jagex Ltd. Spooned OSRS is an independent fan project, not affiliated with, endorsed by or sponsored by Jagex.</li>
  <li><b><X href="https://oldschool.runescape.wiki">OSRS Wiki</X></b> contributors: drop and pet rates, quest, diary and combat achievement reference, Grand Exchange prices and some images (including the Friends Chat and Clan Chat interface artwork and the settings cog), licensed {CC}. Reference text and tables are adapted for this site; each one keeps its Wiki article link and revision, so check the article for updates.</li>
  <li><b><X href="https://github.com/weirdgloop/osrs-dps-calc">OSRS DPS calculator</X></b> by the OSRS Wiki team: newer equipment icons (OSRS Wiki images, {CC}).</li>
  <li><b><X href="https://secure.runescape.com/m=hiscore_oldschool/">OSRS Hiscores</X></b>: skill levels, XP, boss and activity counts.</li>
 </ul>

 <h2 id="players">Player data sources</h2>
 <ul className="credits-list">
  <li><b><X href="https://runeprofile.com">RuneProfile</X></b>: collection log, quests and achievement diaries.</li>
  <li><b><X href="https://templeosrs.com">TempleOSRS</X></b>: collection log imports.</li>
  <li><b><X href="https://wiseoldman.net">Wise Old Man</X></b>: tracked skills, boss counts and skill milestone dates.</li>
 </ul>

 <h2 id="community">Community</h2>
 <ul className="credits-list">
  <li><b>PetCord</b>: the pet hours sheet (by Koekenpan, edited for PetCord by Ptfo) that the pet summary, luck and hours follow, plus Tangleroot tree methods and example paces; and the <X href={PETCORD_SHEET}>driest streak records</X>.</li>
  <li><b><X href="https://templeosrs.com/pets/hours.php">TempleOSRS pet hours</X></b>: reference hunts and planning benchmarks in the pet panel.</li>
 </ul>

 <h2 id="maps">Maps &amp; travel</h2>
 <ul className="credits-list">
  <li><b>Map tiles</b> rendered from the game by <X href="https://github.com/mejrs/layers_osrs">Mejrs</X>; the map itself is © Jagex Ltd.</li>
  <li><b><X href="https://github.com/Skretzo/shortest-path">Shortest Path</X></b> by Skretzo and contributors: collision map, transports, teleports, banks and agility shortcut requirements. BSD 2-Clause.</li>
  <li><b><X href="https://github.com/Zoinkwiz/quest-helper">Quest Helper</X></b> by Zoinkwiz and contributors: quest start positions. BSD 2-Clause, © 2020 Zoinkwiz.</li>
  <li><b><X href="https://github.com/runelite/runelite">RuneLite</X></b>: agility shortcut names and levels, and which fish each fishing spot gives (with Fishing levels), for the map icons&rsquo; hover cards. BSD 2-Clause.</li>
  <li>Quest names, difficulty, length and start text come from the OSRS Wiki ({CC}).</li>
 </ul>
 <p>Full licence texts and changes: <a href="/world-map/NOTICE.txt" target="_blank">map data notices</a>.</p>

 <h2 id="assets">Code &amp; assets</h2>
 <ul className="credits-list">
  <li><b><X href="https://github.com/ReinhardtR/runeprofile">RuneProfile</X></b> by ReinhardtR: the collection-log catalogue, item icons and atlas (rendered from the game cache with RuneLite’s rasterizer), boss and activity hiscore icons, and the RuneScape Bold heading font file. No licence is published for the font.</li>
  <li><b><X href="https://github.com/0xNeffarion/osrsreboxed-db">osrsreboxed-db</X></b> by 0xNeffarion: item icons for the guide editor and outfit picker.</li>
  <li><b><X href="https://github.com/osrsbox/osrsbox-db">osrsbox-db</X></b>: prayer icons and the museum map icon.</li>
  <li><b><X href="https://github.com/abextm/osrs-cache">osrs-cache</X></b> by abextm: the game cache mirror we read item names and sprites from (equipment slots, account-type badges, spell icons, the world map globe).</li>
  <li><b><X href="https://github.com/runelite/runelite">RuneLite</X></b>: sprite and item loaders we follow, sprite IDs, and the client icons on the plugin page (configuration wrench, Plugin Hub plug, plugin and warning icons). BSD 2-Clause, © 2016-2017 Adam; <a href="/icons/runelite/LICENSE.txt" target="_blank">licence</a>.</li>
  <li><b>Share-card font</b>: © Google LLC, <a href="/fonts/share-sans-LICENSE.txt" target="_blank">SIL Open Font License</a>. Body text uses <X href="https://fonts.google.com/specimen/DM+Sans">DM Sans</X> from Google Fonts.</li>
  <li><b>Rocky</b>, our mascot, and the site&rsquo;s own icons belong to Spooned OSRS.</li>
 </ul>
 <p>Want to be credited, or removed? Contact us through our <X href="https://discord.gg/spoonedosrs">Discord server</X>.</p>
 </LegalPage>;}
