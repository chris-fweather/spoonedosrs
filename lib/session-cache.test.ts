import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSession, clearCachedSession, createSessionStore, readCachedSession, sessionFromResponse, SESSION_CACHE_KEY, SESSION_CACHE_MAX_AGE_MS, SIGNED_OUT, UNKNOWN, writeCachedSession, type StorageLike} from './session-cache.ts';

const user = {id: '1234', username: 'sample', globalName: 'Sample', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png'};
const signedIn = {user, names: ['Zezima', 'Lynx Titan']};
function memory(): StorageLike & {data: Map<string, string>} {
  const data = new Map<string, string>();
  return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); }};
}
const broken: StorageLike = {getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); }, removeItem() { throw Error('blocked'); }};
const reply = (status: number, body: unknown) => ({ok: status >= 200 && status < 300, status, json: async () => body});

test('only display fields are remembered, and nothing for a signed-out visitor', () => {
  const storage = memory();
  writeCachedSession(storage, {user: {...user, token: 'secret'} as typeof user, names: signedIn.names}, 1000);
  const raw = storage.data.get(SESSION_CACHE_KEY)!;
  assert.ok(!raw.includes('secret'));
  assert.deepEqual(readCachedSession(storage, 2000), signedIn);
  writeCachedSession(storage, {user: null, names: []}, 3000);
  assert.equal(storage.data.has(SESSION_CACHE_KEY), false);
});

test('a malformed, foreign or stale copy is dropped', () => {
  const storage = memory();
  for (const raw of ['not json', '{}', JSON.stringify({at: 1000, session: {user: {...user, avatarUrl: 'javascript:alert(1)'}, names: []}}), JSON.stringify({at: 1000, session: {user, names: ['a name far too long']}})]) {
    storage.data.set(SESSION_CACHE_KEY, raw);
    assert.equal(readCachedSession(storage, 2000), null);
    assert.equal(storage.data.has(SESSION_CACHE_KEY), false);
  }
  writeCachedSession(storage, signedIn, 1000);
  assert.equal(readCachedSession(storage, 1000 + SESSION_CACHE_MAX_AGE_MS), null);
  writeCachedSession(storage, signedIn, 5000);
  assert.equal(readCachedSession(storage, 4000), null, 'a copy from the future is not trusted');
  assert.equal(cleanSession({user: {...user, globalName: null}, names: []})?.user?.globalName, null);
});

test('blocked or full storage never throws', () => {
  assert.equal(readCachedSession(broken), null);
  assert.equal(readCachedSession(null), null);
  assert.doesNotThrow(() => writeCachedSession(broken, signedIn));
  assert.doesNotThrow(() => clearCachedSession(broken));
  const store = createSessionStore({storage: () => { throw Error('SecurityError'); }, fetchSession: async () => reply(200, signedIn)});
  assert.equal(store.getSnapshot(), UNKNOWN);
  assert.doesNotThrow(() => store.set(signedIn));
  assert.deepEqual(store.getSnapshot(), {known: true, ...signedIn});
});

test('server answers: signed out, dev sign-in gate and failures', async () => {
  assert.deepEqual(await sessionFromResponse(reply(200, {user: null, names: []})), {user: null, names: []});
  assert.deepEqual(await sessionFromResponse(reply(401, {error: 'Sign in to the dev environment first.'})), {user: null, names: []});
  assert.equal(await sessionFromResponse(reply(503, {error: 'Could not load your linked names.'})), 'keep');
  assert.equal(await sessionFromResponse({ok: true, status: 200, json: async () => { throw SyntaxError('bad'); }}), 'keep');
  assert.deepEqual(await sessionFromResponse(reply(200, signedIn)), signedIn);
});

test('a remembered session shows at once and the server corrects it', async () => {
  const storage = memory();
  writeCachedSession(storage, signedIn);
  let answer = reply(200, {user: null, names: []}), calls = 0;
  const store = createSessionStore({storage: () => storage, fetchSession: async () => { calls++; return answer; }});
  assert.equal(store.getServerSnapshot(), UNKNOWN, 'server rendering never guesses');
  assert.deepEqual(store.getSnapshot(), {known: true, ...signedIn});
  let changes = 0;
  store.subscribe(() => changes++);
  await Promise.all([store.load(), store.load()]);
  assert.equal(calls, 1, 'one request per page');
  assert.equal(store.getSnapshot(), SIGNED_OUT, 'an ended session (Log out everywhere, expiry) is corrected');
  assert.equal(storage.data.has(SESSION_CACHE_KEY), false);
  assert.equal(changes, 1);
  answer = reply(200, {...signedIn, names: ['Zezima']});
  await store.load(true);
  assert.deepEqual(store.getSnapshot(), {known: true, user, names: ['Zezima']});
  assert.deepEqual(readCachedSession(storage), {user, names: ['Zezima']});
  store.clear();
  assert.equal(store.getSnapshot(), SIGNED_OUT);
  assert.equal(storage.data.has(SESSION_CACHE_KEY), false);
});

test('a failed answer keeps the remembered session, or shows Sign in when there is none', async () => {
  const storage = memory();
  writeCachedSession(storage, signedIn);
  const kept = createSessionStore({storage: () => storage, fetchSession: async () => reply(503, {})});
  await kept.load();
  assert.deepEqual(kept.getSnapshot(), {known: true, ...signedIn});
  const offline = createSessionStore({storage: () => memory(), fetchSession: async () => { throw TypeError('offline'); }});
  assert.equal(offline.getSnapshot(), UNKNOWN);
  await offline.load();
  assert.equal(offline.getSnapshot(), SIGNED_OUT);
});
