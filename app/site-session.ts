'use client';
import {useEffect, useSyncExternalStore} from 'react';
import {createSessionStore, type SessionState} from '@/lib/session-cache';

/** The page's one session store: every account menu reads it, and it is filled from the remembered copy at once. */
export const siteSession = createSessionStore({
  storage: () => typeof window === 'undefined' ? null : window.localStorage,
  fetchSession: () => fetch('/api/auth/session', {cache: 'no-store'}),
});

/** The header's session: the remembered copy straight away, then the server's answer. */
export function useSiteSession(): SessionState {
  const session = useSyncExternalStore(siteSession.subscribe, siteSession.getSnapshot, siteSession.getServerSnapshot);
  useEffect(() => { void siteSession.load(); }, []);
  return session;
}
