"use client";
import {useState} from 'react';
import {Search} from 'lucide-react';
import {PublicHeader} from './Community';
import './in-development.css';
/** Any address the site doesn't know: the usual header, a short message, and the ways back (home, or the header's player search). */
export function NotFound(){
 const [error,setError]=useState('');
 const search=()=>{const input=document.querySelector<HTMLInputElement>('.hdr input');input?.scrollIntoView({block:'center'});input?.focus();};
 return <div className="site"><PublicHeader onError={setError}/><main className="community-page development-page">{error&&<p role="alert">{error}</p>}<section className="development-window"><div className="development-message"><img src="/brand/rocky-mascot.webp" alt=""/><span className="kicker">Error 404</span><h1>Page not found</h1><p>This page doesn’t exist or has moved.</p><div className="not-found-actions"><a className="btn primary" href="/">Return home</a><button type="button" className="btn" onClick={search}><Search size={16} aria-hidden="true"/> Search a player</button></div></div></section></main></div>;
}
