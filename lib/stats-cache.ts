/** A small shared cache for public counters (plugin page, Support page). Kept free of Worker imports so it can be tested in node. */
export type StatsCache={match(key:string):Promise<Response|undefined>;put(key:string,response:Response):Promise<void>};

/** The counters from the shared cache when fresh, otherwise counted and stored for maxAge seconds. A cache failure never
 * blocks the count. */
export async function cachedStats<T>(load:()=>Promise<T>,cache:StatsCache|null,key:string,maxAge:number):Promise<T>{
 if(cache)try{const hit=await cache.match(key);if(hit)return await hit.json() as T;}catch{/* count instead */}
 const stats=await load();
 if(cache)try{await cache.put(key,Response.json(stats,{headers:{'Cache-Control':`public, max-age=${maxAge}`}}));}catch{/* next request counts again */}
 return stats;
}
