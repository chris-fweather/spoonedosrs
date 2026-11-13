/** The sync queue (Cloudflare Queues: SYNC_QUEUE on spoonedosrs-sync / spoonedosrs-dev-sync, with a dead-letter queue).
 *
 * A refresh or a first search answers at once with what is fast: saved data plus the official Hiscores. The slower,
 * paced sources (RuneProfile, TempleOSRS, and Wise Old Man when the Hiscores had no answer) go on the queue, one
 * message per source. The consumer (build/worker.ts `queue()`) runs each through the shared provider pacing, merges it
 * with `syncJournal` and saves it with the usual revision check, so saved progress is never replaced by empty data.
 *
 * - A busy or rate-limited source waits its turn: the message is sent again with the wait the source asked for plus a
 *   random spread, so a crowd of names behind one slow source (TempleOSRS takes one request every 12.5 seconds) does not
 *   wake together and lose. Waiting never uses up the retries; it ends after WAIT_LIMIT_MS.
 * - A source with nothing for the name (not tracked, no RuneProfile) is finished without saving.
 * - After MAX_RETRIES retries the message goes to the dead-letter queue and the source stops showing as pending.
 * - `sync_pending` (migration 0041) holds one row per name and source while it is queued: the same source is never
 *   queued twice, and the profile asks it which sources are still on their way. No queue position is ever exposed. */
import type {Journal} from './model';
import {RequestError} from './request-body';
import {logEvent} from './log';

export const QUEUED_SOURCES = ['runeprofile', 'temple', 'wom'] as const;
export type QueuedSource = (typeof QUEUED_SOURCES)[number];
export type SyncMessage = {rsn: string; source: QueuedSource; /** When the source was first queued, and how often it has waited for a busy source since. */ since?: number; waits?: number};
/** Matches max_retries in vite.config.ts: a message is delivered at most MAX_RETRIES + 1 times. */
export const MAX_RETRIES = 5;
/** A pending row older than this is treated as lost and may be queued again. */
export const PENDING_MS = 15 * 60_000;
const MAX_DELAY = 12 * 3600; // Cloudflare Queues' longest retry delay.
/** How long a source may wait in line behind a busy provider before it is given up (the player can refresh again). */
export const WAIT_LIMIT_MS = 6 * 3600_000;
/** The random spread added to a busy wait, in seconds: wider each time, so a long line thins out instead of colliding. */
export const waitSpread = (waits: number) => Math.min(600, 20 * (waits + 1));

export type QueueProducer = {sendBatch(messages: {body: SyncMessage}[]): Promise<unknown>; send?(body: SyncMessage, options?: {delaySeconds?: number}): Promise<unknown>};
type Statement = {bind(...values: (string | number)[]): Statement; first<T>(): Promise<T | null>; run(): Promise<unknown>; all<T>(): Promise<{results: T[]}>};
export type QueueDatabase = {prepare(sql: string): Statement};

export const isQueuedSource = (source: string): source is QueuedSource => (QUEUED_SOURCES as readonly string[]).includes(source);

/** Queues the sources not already waiting for this name; returns the ones queued now. A failed send frees its rows. */
export async function enqueueSources(database: QueueDatabase, queue: QueueProducer, rsn: string, sources: readonly QueuedSource[], now = Date.now()): Promise<QueuedSource[]> {
  const name = rsn.toLowerCase(), queued: QueuedSource[] = [];
  for (const source of new Set(sources)) {
    const row = await database.prepare(`INSERT INTO sync_pending(rsn,source,queued_at) VALUES(?,?,?)
      ON CONFLICT(rsn,source) DO UPDATE SET queued_at=excluded.queued_at WHERE sync_pending.queued_at<? RETURNING source`).bind(name, source, now, now - PENDING_MS).first<{source: string}>();
    if (row) queued.push(source);
  }
  if (!queued.length) return [];
  try {await queue.sendBatch(queued.map(source => ({body: {rsn: name, source, since: now}})));}
  catch (error) {
    for (const source of queued) await database.prepare('DELETE FROM sync_pending WHERE rsn=? AND source=? AND queued_at=?').bind(name, source, now).run();
    throw error;
  }
  logEvent('sync-queued', {rsn: name, sources: queued.join(',')});
  return queued;
}

/** Sources still on their way for a name. */
export async function pendingSources(database: QueueDatabase, rsn: string, now = Date.now()): Promise<QueuedSource[]> {
  const rows = await database.prepare('SELECT source FROM sync_pending WHERE rsn=? AND queued_at>=? ORDER BY source').bind(rsn.toLowerCase(), now - PENDING_MS).all<{source: string}>();
  return rows.results.map(r => r.source).filter(isQueuedSource);
}

export type Loaded = {journal: Journal; revision: number; save(next: Journal): Promise<boolean>};
export type Outcome = {kind: 'done'; status: 'updated' | 'unavailable' | 'gone'} | {kind: 'retry'; delaySeconds: number; reason: string};
export type ConsumerDeps = {
  /** The journal to merge into and how to save it, or null when nothing may be saved for this name any more
   * (deleted, now private, or reserved by someone without a claim). */
  load(rsn: string): Promise<Loaded | null>;
  sync(source: QueuedSource, journal: Journal): Promise<Journal>;
};

/** A source has nothing for this name: no point retrying. Everything else that fails is retried. */
const NOTHING_HERE = /not tracked|no RuneProfile|No public|not found|unranked/i;
const backoff = (attempts: number) => Math.min(MAX_DELAY, 30 * 2 ** Math.max(0, attempts - 1));

/** Runs one queued source for one name. `attempts` is the delivery count (1 on the first delivery). */
export async function runQueuedSync(message: SyncMessage, attempts: number, deps: ConsumerDeps): Promise<Outcome> {
  const loaded = await deps.load(message.rsn);
  if (!loaded) return {kind: 'done', status: 'gone'};
  let next: Journal;
  try {next = await deps.sync(message.source, structuredClone(loaded.journal));}
  catch (error) {
    // The provider client's refusals (busy slot, provider cooldown, daily budget, paused imports) carry the wait.
    if (error instanceof RequestError && (error.status === 429 || error.status === 503))
      return {kind: 'retry', delaySeconds: Math.min(MAX_DELAY, Math.max(5, error.retryAfter ?? backoff(attempts))), reason: 'busy'};
    if (error instanceof Error && NOTHING_HERE.test(error.message)) return {kind: 'done', status: 'unavailable'};
    return {kind: 'retry', delaySeconds: backoff(attempts), reason: 'failed'};
  }
  delete (next as Journal & {syncReport?: unknown}).syncReport;
  // A save that loses a revision race (the owner saved meanwhile) is retried shortly on the newer journal.
  if (!(await loaded.save(next).catch(() => false))) return {kind: 'retry', delaySeconds: 5, reason: 'conflict'};
  return {kind: 'done', status: 'updated'};
}

type QueueMessage = {body: unknown; attempts: number; ack(): void; retry(options?: {delaySeconds?: number}): void};
/** The Worker's queue() handler body: each message is acknowledged, retried, or (after MAX_RETRIES) sent on to the
 * dead-letter queue. The pending row is removed when the source finishes either way. */
export async function handleSyncBatch(messages: readonly QueueMessage[], database: QueueDatabase, deps: ConsumerDeps, queue?: QueueProducer | null, now: () => number = Date.now, random: () => number = Math.random) {
  for (const msg of messages) {
    const body = msg.body as Partial<SyncMessage>;
    if (typeof body?.rsn !== 'string' || !isQueuedSource(String(body.source))) {logEvent('sync-queue-invalid', {}, 'warn'); msg.ack(); continue;}
    const message = {rsn: body.rsn.toLowerCase(), source: body.source as QueuedSource};
    const waits = Number.isInteger(body.waits) && body.waits! > 0 ? body.waits! : 0, since = typeof body.since === 'number' && body.since > 0 ? body.since : now();
    const clear = () => database.prepare('DELETE FROM sync_pending WHERE rsn=? AND source=?').bind(message.rsn, message.source).run().catch(() => undefined);
    let outcome: Outcome;
    try {outcome = await runQueuedSync(message, msg.attempts, deps);}
    catch {outcome = {kind: 'retry', delaySeconds: backoff(msg.attempts), reason: 'error'};}
    if (outcome.kind === 'done') {
      await clear(); msg.ack();
      logEvent('sync-queue-done', {rsn: message.rsn, source: message.source, status: outcome.status, attempts: msg.attempts, waits});
      continue;
    }
    // Waiting for a busy source is not a failure: send the message again later, as a new one, so the wait does not use
    // up the retries. The pending row is kept fresh, so the profile still shows the source as queued.
    if (outcome.reason === 'busy' && queue?.send) {
      if (now() - since > WAIT_LIMIT_MS) {
        await clear(); msg.ack();
        logEvent('sync-queue-failed', {rsn: message.rsn, source: message.source, reason: 'waited too long', attempts: msg.attempts, waits}, 'error');
        continue;
      }
      const delaySeconds = Math.min(MAX_DELAY, outcome.delaySeconds + Math.floor(random() * waitSpread(waits)));
      const sent = await queue.send({...message, since, waits: waits + 1}, {delaySeconds}).then(() => true, () => false);
      if (sent) {
        await database.prepare('UPDATE sync_pending SET queued_at=? WHERE rsn=? AND source=?').bind(now(), message.rsn, message.source).run().catch(() => undefined);
        msg.ack();
        logEvent('sync-queue-wait', {rsn: message.rsn, source: message.source, delaySeconds, waits: waits + 1});
        continue;
      }
    }
    if (msg.attempts > MAX_RETRIES) {
      // The last delivery: stop showing it as pending, and let Queues move it to the dead-letter queue.
      await clear(); msg.retry();
      logEvent('sync-queue-failed', {rsn: message.rsn, source: message.source, reason: outcome.reason, attempts: msg.attempts}, 'error');
    } else {
      msg.retry({delaySeconds: outcome.delaySeconds});
      logEvent('sync-queue-retry', {rsn: message.rsn, source: message.source, reason: outcome.reason, delaySeconds: outcome.delaySeconds, attempts: msg.attempts});
    }
  }
}
