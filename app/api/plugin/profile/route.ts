import {HttpError} from '@/lib/auth';
import {publicMessage,RequestError} from '@/lib/request-body';
import {profileJournal,publicProfile} from '@/lib/profile-store';
import {pluginProfile} from '@/lib/plugin-profile';

/**
 * A player's public profile for the RuneLite plugin, in one small reply. Read with no session, so it shows
 * exactly what a logged-out visitor sees: private profiles and hidden sections stay hidden.
 */
export async function GET(req:Request){
 try{
  const name=new URL(req.url).searchParams.get('username');
  const anonymous=new Request(new URL('/',req.url));
  const [journal,flair]=await Promise.all([profileJournal(anonymous,name),publicProfile(name,null)]);
  return Response.json(pluginProfile(journal,flair),{headers:{'Cache-Control':'public, max-age=60'}});
 }catch(e){
  const status=e instanceof HttpError||e instanceof RequestError?e.status:400;
  return Response.json({error:publicMessage(e,'Profile unavailable.')},{status,headers:{'Cache-Control':'no-store'}});
 }
}
