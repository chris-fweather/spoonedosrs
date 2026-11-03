import {ACCOUNT_MODES,type AccountMode} from '@/lib/account-mode';
import {accountModeInfo} from '@/lib/badge-info';
import {BadgeHover} from './BadgeCard';
import './account-mode-badge.css';
/** The account type's badge: the game's own chat badge (public/ui/account-modes); hover, focus or tap it for what the
 * account type means. Inside a link (board rows) pass tabIndex -1 so the link stays the only tab stop. */
export function AccountModeBadge({mode,showHelp=true,tabIndex=0}:{mode?:AccountMode|null;showHelp?:boolean;tabIndex?:number}){
 if(!mode||mode==='normal')return null;
 const label=ACCOUNT_MODES[mode],info=accountModeInfo(mode);if(!label)return null;
 const img=<img src={`/ui/account-modes/${mode}.png`} width={10} height={13} alt={label}/>;
 return showHelp&&info?<BadgeHover className="account-mode-badge" info={info} tabIndex={tabIndex}>{img}</BadgeHover>:<span className="account-mode-badge" title={label}>{img}</span>;
}
