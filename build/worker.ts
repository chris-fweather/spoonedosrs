import {securityHeaders} from '../lib/security-headers';
import handler from "vinext/server/fetch-handler";

declare const __SPOONED_ENV__: string;

/** Paths the dev environment answers without its owner sign-in. */
const DEV_OPEN_PATHS=new Set(['/api/auth/dev-login','/api/plugin/manifest','/api/plugin/sync','/api/plugin/profile','/api/share']);

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const started=performance.now(),path=new URL(request.url).pathname;
    // Map tiles are public game imagery and a map screen asks for dozens: answer them first, from the edge cache, without
    // the dev sign-in check, the per-IP API budget or the app.
    if(path==='/api/map-tile'&&(request.method==='GET'||request.method==='HEAD')){
      const {mapTile}=await import('../lib/map-tile');
      return securityHeaders(await mapTile(request,ctx));
    }
    // The dev environment is private: everything except its sign-in page needs the owner's dev session.
    // The RuneLite plugin cannot hold a dev session: sync uses its own token, and the profile and share card reads
    // show only public data (the dev database holds only the owner's profile).
    if(__SPOONED_ENV__==='dev'&&!DEV_OPEN_PATHS.has(path)){
      const {readSession}=await import('../lib/auth');
      if(!(await readSession(request))){
        if(path.startsWith('/api/'))return securityHeaders(Response.json({error:'Sign in to the dev environment first.'},{status:401,headers:{'Cache-Control':'no-store'}}));
        return new Response(null,{status:302,headers:{Location:'/api/auth/dev-login','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
      }
    }
    if(path.startsWith('/api/')&&path!=='/api/discord/interactions'){
      const limiter=request.method==='GET'||request.method==='HEAD'?env.API_READ_LIMIT:env.API_WRITE_LIMIT;
      const ip=request.headers.get('CF-Connecting-IP');
      if(limiter&&ip){
        const {budgetKey}=await import('../lib/request-controls');
        const key=await budgetKey('edge:'+Math.floor(Date.now()/3_600_000)+':'+ip);
        if(!(await limiter.limit({key})).success)return securityHeaders(Response.json({error:'Too many requests. Please wait a minute.'},{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}}));
      }
    }
    let response=await handler.fetch(request, env, ctx);
    if(!import.meta.env.DEV)response=securityHeaders(response);
    // The dev environment is for review only: keep it out of search results.
    if(__SPOONED_ENV__==='dev'){response=new Response(response.body,response);response.headers.set('X-Robots-Tag','noindex, nofollow');}
    if(!path.startsWith('/api/'))return response;
    const measured=new Response(response.body,response);
    measured.headers.append('Server-Timing',`app;dur=${(performance.now()-started).toFixed(1)}`);
    measured.headers.set('X-Content-Type-Options','nosniff');
    return measured;
  },
  // Every ten minutes: give a couple of profiles that never had a full pull one pass over all four sources.
  async scheduled(_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil(import('../lib/background-refresh').then(({backgroundRefresh}) => backgroundRefresh()).then(
      results => console.log(JSON.stringify({event:'background-refresh',profiles:Object.keys(results).length,updated:Object.values(results).filter(r=>r==='updated').length})),
      error => console.error(JSON.stringify({event:'background-refresh-failed',message:String(error).slice(0,200)}))));
  },
};
