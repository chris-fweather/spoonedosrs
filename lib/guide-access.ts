/**
 * Who can read a guide, and its thumbs up. A guide is 'public' (everyone) or 'staff' (signed-in staff of any rank). Every
 * read goes through GUIDE_VISIBLE, which takes the viewer's Discord ID (or '' when signed out) and checks staff_members in
 * the same query, so a guide hidden from a viewer is never listed, counted or found: to them it does not exist (404).
 * The queries take any D1-shaped database, so the unit tests run them on the real schema in node:sqlite.
 */
export const GUIDE_VISIBILITIES=['public','staff'] as const;
export type GuideVisibility=(typeof GUIDE_VISIBILITIES)[number];
export const isGuideVisibility=(value:unknown):value is GuideVisibility=>GUIDE_VISIBILITIES.includes(value as GuideVisibility);

type Statement={bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<unknown>};
export type GuideDatabase={prepare(query:string):Statement};

/** Published, and public or read by a staff member. `?1` is the viewer's Discord ID, '' when signed out. */
export const GUIDE_VISIBLE=`g.published IS NOT NULL AND (g.visibility='public' OR EXISTS(SELECT 1 FROM staff_members s WHERE s.discord_id=?1 AND ?1<>''))`;
/** Public guides only: for places that never know the viewer (Squire, Credits). */
export const GUIDE_PUBLIC=`g.published IS NOT NULL AND g.visibility='public'`;

/** A guide as a reader sees it, with a public byline: the author's earliest claimed name with a public profile (never a
 * private one), their staff rank, when the guide first went live and when it was last updated, plus its thumbs up. */
const LISTED=`SELECT g.id,g.published,g.published_at,g.visibility,
 (SELECT c.display_name FROM claimed_names c LEFT JOIN profile_visibility v ON v.rsn=c.rsn WHERE c.discord_id=g.author_id AND COALESCE(v.visibility,'public')='public' ORDER BY c.claimed_at LIMIT 1) AS author,
 (SELECT s.role FROM staff_members s WHERE s.discord_id=g.author_id) AS author_role,
 (SELECT MIN(a.created_at) FROM staff_audit a WHERE a.target_id=g.id AND a.action='guide-publish') AS first_published,
 (SELECT COUNT(*) FROM guide_thumbs t WHERE t.guide_id=g.id) AS thumbs,
 EXISTS(SELECT 1 FROM guide_thumbs t WHERE t.guide_id=g.id AND t.voter_id=?1 AND ?1<>'') AS thumbed
 FROM community_guides g WHERE ${GUIDE_VISIBLE}`;
type ListedRow={id:string;published:string;published_at:string;visibility:GuideVisibility;author:string|null;author_role:string|null;first_published:string|null;thumbs:number;thumbed:number};
export type ListedGuide<G=unknown>={id:string;guide:G;publishedAt:string;updatedAt:string;author:{name:string;role:string|null}|null;visibility:GuideVisibility;thumbs:number;thumbed:boolean};
const listed=<G>(r:ListedRow):ListedGuide<G>=>({id:r.id,guide:JSON.parse(r.published) as G,publishedAt:r.first_published??r.published_at,updatedAt:r.published_at,author:r.author?{name:r.author,role:r.author_role}:null,visibility:r.visibility,thumbs:Number(r.thumbs),thumbed:!!r.thumbed});

/** The guides this viewer may read, newest first. */
export async function listGuides<G=unknown>(database:GuideDatabase,viewerId:string|null):Promise<ListedGuide<G>[]>{
 return (await database.prepare(LISTED+' ORDER BY g.published_at DESC LIMIT 200').bind(viewerId??'').all<ListedRow>()).results.map(r=>listed<G>(r));
}
/** One guide, or null when it is missing, unpublished or hidden from this viewer (all answered the same way: 404). */
export async function findGuide<G=unknown>(database:GuideDatabase,viewerId:string|null,id:string):Promise<ListedGuide<G>|null>{
 const row=await database.prepare(LISTED+' AND g.id=?2').bind(viewerId??'',id).first<ListedRow>();
 return row?listed<G>(row):null;
}
/** Gives (on) or takes back (off) the viewer's one thumbs up. The insert repeats the visibility check, so a guide hidden or
 * unpublished meanwhile takes none, and the primary key keeps it to one per person even when requests arrive together.
 * Returns the guide's new count and whether the viewer's thumbs up is on it, or null when the viewer cannot see the guide. */
export async function setGuideThumb(database:GuideDatabase,viewerId:string,id:string,on:boolean,now=new Date().toISOString()):Promise<{thumbs:number;thumbed:boolean}|null>{
 if(!viewerId)return null;
 if(!await findGuide(database,viewerId,id))return null;
 if(on)await database.prepare(`INSERT INTO guide_thumbs(guide_id,voter_id,created_at) SELECT g.id,?1,?3 FROM community_guides g WHERE g.id=?2 AND ${GUIDE_VISIBLE} ON CONFLICT DO NOTHING`).bind(viewerId,id,now).run();
 else await database.prepare('DELETE FROM guide_thumbs WHERE guide_id=? AND voter_id=?').bind(id,viewerId).run();
 const after=await findGuide(database,viewerId,id);
 return after?{thumbs:after.thumbs,thumbed:after.thumbed}:null;
}
/** Thumbs up on the published guides written by whoever linked this RuneScape name, staff-only guides included: they add
 * to the profile's reputation even though only staff see them on the guide. 0 when nobody has linked the name. */
export const AUTHOR_THUMBS_SQL=`SELECT COUNT(*) AS n FROM guide_thumbs t JOIN community_guides g ON g.id=t.guide_id
 WHERE g.published IS NOT NULL AND g.author_id=(SELECT c.discord_id FROM claimed_names c WHERE c.rsn=?)`;
export async function authorGuideThumbs(database:GuideDatabase,rsn:string):Promise<number>{
 return Number((await database.prepare(AUTHOR_THUMBS_SQL).bind(rsn).first<{n:number}>())?.n??0);
}
