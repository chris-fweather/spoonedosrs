import type {ReactNode} from 'react';
import './legal.css';
export function LegalPage({title,children,updated='6 October 2026',contact=true}:{title:string;children:ReactNode;updated?:string;contact?:boolean}){
 return <main className="legal-page"><a href="/">← Spooned OSRS</a><p className="kicker">Updated {updated}</p><h1>{title}</h1>{children}{contact&&<p>Contact the Spooned OSRS team through our <a href="https://discord.gg/spoonedosrs" target="_blank" rel="noreferrer">Discord server</a>. Ask a server owner for a private conversation before sharing account or privacy details.</p>}</main>;
}
