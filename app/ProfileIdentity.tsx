import {StaffPrefix} from './StaffBadge';
import {AccountModeBadge} from './AccountModeBadge';
import {AchievementTitle} from './AchievementTitle';
import {BadgeHover} from './BadgeCard';
import {supporterTitleInfo} from '@/lib/badge-info';
import {VerifiedBadge} from './VerifiedBadge';
import type {Donation} from '@/lib/presentation';
import {rankNameClass,type PublicStaff} from '@/lib/staff-policy';
import type {Journal} from '@/lib/model';
import type {NamePrefix} from '@/lib/name-prefix';
import {PLUGIN_FEATURES} from '@/lib/plugin-page';
import './profile-identity.css';
export type IdentityProps={username:string;accountMode:Journal['accountMode'];staff?:PublicStaff|null;
 /** The Squire of someone not on staff (staff carry theirs in staff.displayPrefix). */
 namePrefix?:NamePrefix|null;donation?:Donation;title:string|null;earnedTitle:string|null;
 /** Linked and proven through the RuneLite plugin by the same Discord account; shown only while the plugin page is on. */
 verified?:boolean};
/** A player's name block as their profile shows it: staff scimitar and Sir, account mode, name, donation title, then the achievement title.
 * The name and the achievement title start at the same edge (as in the account menu), so Sir always sits right beside the name. */
export function ProfileIdentity({username,accountMode,staff,namePrefix,donation,title,earnedTitle,verified=false}:IdentityProps){
 return <div className={`char-name ${username.length>9?'long-name':''}`}><div className="profile-identity"><span className="profile-prefixes"><StaffPrefix staff={staff} prefix={namePrefix} donation={donation}/></span><span className="profile-mode"><AccountModeBadge mode={accountMode}/></span><div className="profile-name-lines"><b><span className={rankNameClass(staff)}>{username}</span>{verified&&PLUGIN_FEATURES&&<VerifiedBadge/>}{title && <BadgeHover className="rs-title" info={supporterTitleInfo(title,donation)}>{title}</BadgeHover>}</b>{earnedTitle && <AchievementTitle label={earnedTitle}/>}</div></div></div>;
}
