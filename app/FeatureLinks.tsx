'use client';
import {HoverTip} from './HoverTip';
import {navLinks} from '@/lib/features';
import {pluginNavLinks} from '@/lib/plugin-page';
import './feature-links.css';
/** The site's feature buttons, with the plugin page (when shown) just before Support. */
function links(){const all=navLinks(),support=all.findIndex(l=>l.key==='support');return support<0?[...all,...pluginNavLinks()]:[...all.slice(0,support),...pluginNavLinks(),...all.slice(support)];}
export function FeatureLinks({page}:{page?:string}) {
 return <>{links().map(({path,label,image,key})=><HoverTip key={key} className="feature-nav-wrap" touchPreview={false} label={label} tabIndex={-1}><a className="btn sm ghost feature-nav-icon" href={'/'+path} aria-label={label} aria-current={page===key?'page':undefined}><img src={image} alt=""/><span className="feature-nav-label">{label}</span></a></HoverTip>)}</>;
}
