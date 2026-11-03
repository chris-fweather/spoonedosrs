import {ShieldCheck} from 'lucide-react';
import {VERIFIED_INFO} from '@/lib/badge-info';
import {BadgeHover} from './BadgeCard';
import './verified-badge.css';

/** A profile whose name is linked to the same Discord account that proved it through the RuneLite plugin
 * (lib/verified-profile.ts). One small green mark beside the name; its card says what it means. */
export function VerifiedBadge({size=15}:{size?:number}){
 return <BadgeHover className="verified-badge" info={VERIFIED_INFO}><ShieldCheck size={size} strokeWidth={2.25} role="img" aria-label="Verified"/></BadgeHover>;
}
