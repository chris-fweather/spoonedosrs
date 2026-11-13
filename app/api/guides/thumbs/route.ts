import {HttpError} from '@/lib/auth';
import {thumbGuide} from '@/lib/guide-store';
const headers={'Cache-Control':'no-store'};
/** PUT gives the signed-in reader's thumbs up to ?guide=<id>; DELETE takes it back. Answers the guide's new count. */
async function handle(req:Request){
 try{const id=new URL(req.url).searchParams.get('guide');if(!id)throw new HttpError(400,'Choose a guide.');return Response.json(await thumbGuide(req,id,req.method==='PUT'),{headers});}
 catch(e){return Response.json({error:e instanceof HttpError?e.message:'Thumbs up are temporarily unavailable. Please retry.'},{status:e instanceof HttpError?e.status:503,headers:{...headers,...(e instanceof HttpError&&e.status===429?{'Retry-After':'600'}:{})}});}
}
export const PUT=handle;
export const DELETE=handle;
