/** The header's signed-in state, shared by every account menu on the page and remembered between page loads.
 *
 * Every page is a full load, so the header used to start signed out and fetch /api/auth/session each time: a
 * signed-in player saw "Sign in" until the request came back. The last signed-in session is kept in this browser
 * (display details only: name, avatar URL, linked RuneScape names; never a token or cookie) so the header can show
 * the account straight away, then the server's answer replaces it. Signing out clears it, and an expired session or
 * Log out everywhere is corrected by that same answer. */

export type SessionUser = {id: string; username: string; globalName: string | null; avatarUrl: string};
export type SiteSession = {user: SessionUser | null; names: string[]};
/** `known` is false until this page has an answer, from the server or the remembered copy. */
export type SessionState = SiteSession & {known: boolean};
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SESSION_CACHE_KEY = 'spooned-session-v1';
/** As long as a session lasts: a copy older than that cannot belong to a live session. */
export const SESSION_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_NAMES = 50, MAX_TEXT = 100, AVATAR = /^https:\/\/cdn\.discordapp\.com\/[A-Za-z0-9_./-]{1,200}$/;

export const UNKNOWN: SessionState = Object.freeze({known: false, user: null, names: []}) as SessionState;
export const SIGNED_OUT: SessionState = Object.freeze({known: true, user: null, names: []}) as SessionState;

const text = (value: unknown, max = MAX_TEXT): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

/** Keeps only the display fields, or null when the value is not a signed-in session. */
export function cleanSession(value: unknown): SiteSession | null {
  if (!value || typeof value !== 'object') return null;
  const {user, names} = value as {user?: unknown; names?: unknown};
  if (!user || typeof user !== 'object' || !Array.isArray(names) || names.length > MAX_NAMES || !names.every(name => text(name, 12))) return null;
  const {id, username, globalName, avatarUrl} = user as Record<string, unknown>;
  if (!text(id, 32) || !text(username) || !(globalName === null || text(globalName)) || typeof avatarUrl !== 'string' || !AVATAR.test(avatarUrl)) return null;
  return {user: {id, username, globalName: globalName as string | null, avatarUrl}, names: [...names] as string[]};
}

/** The remembered session, or null when there is none, it is malformed, too old, or storage is unavailable. */
export function readCachedSession(storage: StorageLike | null, now = Date.now()): SiteSession | null {
  try {
    const raw = storage?.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {at?: unknown; session?: unknown};
    const age = typeof parsed?.at === 'number' ? now - parsed.at : NaN;
    const session = age >= 0 && age < SESSION_CACHE_MAX_AGE_MS ? cleanSession(parsed.session) : null;
    if (!session) storage?.removeItem(SESSION_CACHE_KEY);
    return session;
  } catch {
    try { storage?.removeItem(SESSION_CACHE_KEY); } catch { /* storage is unavailable */ }
    return null;
  }
}

/** Remembers a signed-in session; a signed-out one clears the copy. */
export function writeCachedSession(storage: StorageLike | null, session: SiteSession, now = Date.now()) {
  const clean = cleanSession(session);
  try {
    if (clean) storage?.setItem(SESSION_CACHE_KEY, JSON.stringify({at: now, session: clean}));
    else storage?.removeItem(SESSION_CACHE_KEY);
  } catch { /* storage is full or blocked: the header still works, it just cannot remember */ }
}

export function clearCachedSession(storage: StorageLike | null) {
  try { storage?.removeItem(SESSION_CACHE_KEY); } catch { /* storage is unavailable */ }
}

/** What a /api/auth/session answer means for the header: a session, signed out, or 'keep' to leave it as it is. */
export async function sessionFromResponse(response: Pick<Response, 'ok' | 'status' | 'json'>): Promise<SiteSession | 'keep'> {
  // 401 is the dev environment's own sign-in gate: no session there either.
  if (response.status === 401) return {user: null, names: []};
  if (!response.ok) return 'keep';
  try {
    const body = await response.json() as {user?: unknown};
    if (body && typeof body === 'object' && body.user === null) return {user: null, names: []};
    return cleanSession(body) ?? 'keep';
  } catch { return 'keep'; }
}

export type SessionStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SessionState;
  getServerSnapshot(): SessionState;
  /** Asks the server once per page (later calls share the request unless `force`). */
  load(force?: boolean): Promise<SessionState>;
  set(session: SiteSession): void;
  clear(): void;
};

/** One store per page. `storage` is read lazily so server rendering and blocked storage both fall back to UNKNOWN. */
export function createSessionStore({storage, fetchSession, now = Date.now}: {
  storage: () => StorageLike | null;
  fetchSession: () => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
  now?: () => number;
}): SessionStore {
  const listeners = new Set<() => void>();
  let state: SessionState | null = null, pending: Promise<SessionState> | null = null;
  const store = () => { try { return storage(); } catch { return null; } };
  const emit = (next: SessionState) => { state = next; listeners.forEach(listener => listener()); };
  const known = (session: SiteSession): SessionState => session.user ? {known: true, ...session} : SIGNED_OUT;
  function initial(): SessionState {
    const cached = readCachedSession(store(), now());
    return cached ? known(cached) : UNKNOWN;
  }
  function set(session: SiteSession) {
    writeCachedSession(store(), session, now());
    emit(known(cleanSession(session) ?? {user: null, names: []}));
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state ??= initial(),
    getServerSnapshot: () => UNKNOWN,
    load(force = false) {
      if (pending && !force) return pending;
      const request = (async () => {
        try {
          const result = await sessionFromResponse(await fetchSession());
          if (result !== 'keep') set(result);
        } catch { /* offline: keep what the header shows */ }
        state ??= initial();
        // A failed first answer with nothing remembered: show Sign in rather than a placeholder forever.
        if (!state.known) emit(SIGNED_OUT);
        return state;
      })();
      pending = request;
      return request;
    },
    set,
    clear() { clearCachedSession(store()); emit(SIGNED_OUT); },
  };
}
