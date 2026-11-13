declare namespace Cloudflare {
  interface Env {
    /** Local development only; production handler always rejects this route. */
    LOCAL_PREVIEW_LOGIN?: string;
    DB?: D1Database;
    SYNC_PAUSED?: string;
    API_READ_LIMIT?: {limit(input:{key:string}):Promise<{success:boolean}>};
    API_WRITE_LIMIT?: {limit(input:{key:string}):Promise<{success:boolean}>};
    ASSETS?: Fetcher;
    /** R2 bucket for guide images (spoonedosrs-uploads / spoonedosrs-dev-uploads). Absent until the bucket exists. */
    UPLOADS?: R2Bucket;
    /** R2 bucket holding our copy of the world map tiles (spoonedosrs-map-tiles / spoonedosrs-dev-map-tiles), lib/map-tile.ts. */
    MAP_TILES?: R2Bucket;
    /** Sync queue producer (spoonedosrs-sync / spoonedosrs-dev-sync), lib/sync-queue.ts. Absent in local runs: syncs then run inline. */
    SYNC_QUEUE?: Queue<import('../lib/sync-queue').SyncMessage>;
    /** Public Discord OAuth client id. Wrangler var, not a secret. */
    DISCORD_CLIENT_ID?: string;
    /** Worker secret. Never store the value in the repo. */
    DISCORD_CLIENT_SECRET?: string;
    /** Worker secret used to sign the session cookie. Never store the value in the repo. */
    SESSION_SECRET?: string;
    /** Worker secret that signs post-deploy sync checks (/api/health/sync). */
    DEPLOY_CHECK_SECRET?: string;
    /** Read-only Discord role bridge secret; distinct from OAuth and sessions. */
    DISCORD_ROLE_SYNC_SECRET?: string;
    /** Dev environment only: the owner's sign-in password (Worker secret). Ignored everywhere else. */
    DEV_LOGIN_PASSWORD?: string;
    /** Optional Wise Old Man API key (Worker secret): raises WOM pacing from 18 to 90 requests a minute. */
    WOM_API_KEY?: string;
  }
}
