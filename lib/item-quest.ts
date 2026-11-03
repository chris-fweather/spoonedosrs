/** The quest an untradeable item belongs to, read from its OSRS Wiki page (CC BY-NC-SA 3.0): the Infobox Item's
 * "quest" field, such as `|quest = [[Dragon Slayer I]]`. Only quests on the site's quest list count, and only for an
 * item the infobox calls untradeable, so a tradeable item a quest also hands out never reads as a quest item. */
import {guideQuests} from './guides';

const WIKI = 'https://oldschool.runescape.wiki/api.php';
const AGENT = 'spoonedosrs.com guide item cards (discord.gg/spoonedosrs)';
const QUESTS = new Map(guideQuests.map(q => [q.toLowerCase(), q]));

/** The infobox's value for a field, or for its first numbered version ("quest1") when the item has versions. */
function field(wikitext: string, name: string): string | null {
  const m = new RegExp(`^\\s*\\|\\s*${name}1?\\s*=([^\\n]*)$`, 'mi').exec(wikitext);
  return m ? m[1].trim() : null;
}

/** The quests an item page's Infobox Item names, in order, when the item is untradeable; none otherwise. */
export function infoboxQuests(wikitext: string): string[] {
  if (!/\{\{\s*Infobox Item/i.test(wikitext) || !/^no\b/i.test(field(wikitext, 'tradeable') ?? '')) return [];
  const value = field(wikitext, 'quest') ?? '', found: string[] = [];
  for (const [, link] of value.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const quest = QUESTS.get(link.trim().replaceAll('_', ' ').toLowerCase());
    if (quest && !found.includes(quest)) found.push(quest);
  }
  return found;
}

const cache = new Map<string, Promise<string[]>>();
/** The quests an untradeable item belongs to, by its name; none when the page names none or the Wiki is unreachable.
 * Pages are cached a week at the edge and the answer per isolate; a failed request is asked again next time. */
export function itemQuests(name: string): Promise<string[]> {
  let found = cache.get(name);
  if (!found) {
    const url = WIKI + '?' + new URLSearchParams({action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: name});
    found = fetch(url, {headers: {'User-Agent': AGENT}, signal: AbortSignal.timeout(8_000), cf: {cacheTtl: 604_800, cacheEverything: true}} as RequestInit)
      .then(r => r.ok ? r.json() as Promise<{query?: {pages?: {revisions?: {slots?: {main?: {content?: string}}}[]}[]}}> : Promise.reject(Error('Wiki ' + r.status)))
      .then(body => infoboxQuests(body.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? ''))
      .catch(() => { cache.delete(name); return []; });
    cache.set(name, found);
  }
  return found;
}
