# Upstream reads, caching and limits

Checked 4 November 2026. These controls require migrations `0021_provider_controls.sql` and `0039_provider_backoff.sql`.

The tracker GETs existing snapshots. It does not POST a request to make Temple,
RuneProfile or Wise Old Man refresh a player from the game. Read requests still
consume their API quotas. Quotas apply across our app, not once per player.

| Provider | Published guidance | Our minimum interval | Our response cache |
| --- | --- | --- | --- |
| TempleOSRS | FAQ recommends at most 5/min for auto-updaters; read quota needs confirmation | 12.5 seconds (under 5/min) | 5 minutes |
| RuneProfile | 30/min anonymous, 120/min standard key, 600/min partner | 2.1 seconds (under 30/min) | 1 minute |
| Wise Old Man | 20/min without key, 100/min with key; space requests | Snapshots 4 s and achievements 12 s, sharing one slot every 3.33 s (18/min). With our key: 1 s, 3 s, shared 0.67 s (90/min) | 5 minutes; achievements 6 hours |
| Official Hiscores | No verified numeric entitlement | 1.1 seconds (our own conservative ceiling) | 1 minute |

References:
- https://templeosrs.com/faq.php and https://templeosrs.com/api_doc.php
- https://api.runeprofile.com/v1/docs (documentation is also in their public repository's apps/api/src/public/v1/index.ts)
- https://docs.wiseoldman.net/api

Cache durations beyond RuneProfile's documented one-minute upstream cache are
our freshness choices, not claims about provider requirements. No key-based
quota increases are enabled except Wise Old Man's, and only when the optional
`WOM_API_KEY` Worker secret is set. Any other key needs an agreed integration first.

## Implementation

- D1's atomic provider slot is shared across Worker instances and regions. No
  fixed-window boundary bursts, IP rotation or per-player quota multiplication.
- Only allowlisted public GET endpoints are accepted. Mutation endpoints,
  caller credentials and redirects are rejected. All requests identify Spooned
  and its public Discord contact in User-Agent.
- Cache lookup happens before consuming an upstream slot or daily allowance.
  A short D1 lease prevents duplicate concurrent fetches for the same URL.
  Busy requests return Retry-After instead of opening a long server queue.
- Lanes in a group (both Wise Old Man lanes) are taken only while the group's
  shared slot is free, then take that slot, so their total stays at 18 a minute
  (90 with our key) and a busy lane never wastes the group's turn.
- HTTP 429 and 503 trigger a cooldown for the whole provider group; Retry-After
  seconds and dates are honored and never shortened. With no Retry-After,
  repeated refusals back off 1, 2, 4 and 8 minutes, capped at 15, plus up to 20%
  jitter; the count resets after the next good answer. RateLimit-Remaining: 0
  also sets cooldown, using RateLimit-Reset when no Retry-After is supplied. No
  immediate automatic retry.
- Our own API key (`WOM_API_KEY`) is sent as `x-api-key` only to Wise Old Man,
  never stored in the response cache or its key, and callers still cannot send
  a key of their own.
- Successful JSON results are capped at 1.8 MB. No cookies, private or
  no-store responses are persisted. 404s are cached for one minute. Malformed
  payloads and other errors aren't cached as valid profiles.
- Cache keys are HMACs of URLs. Cached payloads are public upstream data only;
  saved account privacy checks remain in the existing profile routes. There is
  no public raw-cache endpoint. Expired cache rows are deleted on subsequent
  outbound fetches. At rest, expired rows can remain until this cleanup runs.
- Existing 60-second per-player sync cooldown and 10,000 outbound/day cap
  remain. Cache hits do not use the outbound/day cap. SYNC_PAUSED stops misses
  but permits fresh cache reads. A cache hit is not labelled as a new upstream
  fetch internally (X-Source-Fetched-At preserves the fetch time).

The character viewer uses our own models (`public/models/`); the RuneProfile
model endpoint is no longer requested. Confirm API reuse, attribution and
donation-supported operation with the maintainers before wider launch. These changes are local until migrated and deployed.

## Sync queue

`lib/sync-queue.ts`, on Cloudflare Queues (`SYNC_QUEUE`: `spoonedosrs-sync` / `spoonedosrs-dev-sync`, dead-letter
queues `spoonedosrs-sync-dlq` / `spoonedosrs-dev-sync-dlq`).

- "Refresh all" and a first search save the OSRS Hiscores in the request and answer with `status: 'sync_queued'`.
  RuneProfile and TempleOSRS, plus Wise Old Man when the Hiscores have no answer, are queued as one message per
  source. A single RuneProfile, TempleOSRS or Wise Old Man refresh is queued too. Hiscores and file imports always
  run in the request. A name the Hiscores do not know is still asked of every source in the request.
- `sync_pending` (migration 0041) holds one row per name and source while it waits, so a source is never queued
  twice, and `/api/sync/status` tells the profile which are still on their way (owners only for a claimed name). No
  queue position is stored or shown.
- The consumer (`queue()` in `build/worker.ts`) runs each source through the provider pacing above and saves with the
  usual revision check. A refusal (busy slot, provider cooldown, daily budget, paused imports) is retried after the
  wait it carries, capped at 12 hours; other failures back off from 30 seconds. A source with nothing for the name
  finishes without saving. After 5 retries the message goes to the dead-letter queue and stops showing as pending.
- Without the binding (local runs), every source runs in the request as before.

## Fallback

Which source answers each kind of data is listed in `lib/provider-fallback.ts`:

| Data | Sources, in order | Rule |
| --- | --- | --- |
| Skills and boss KC | OSRS Hiscores, then Wise Old Man | First to answer wins. The WOM snapshot is only fetched when the Hiscores are down, slow, rate limited, invalid or have no record (WOM may still track an unranked player). |
| Collection log | RuneProfile and TempleOSRS | Combined: Temple adds unlocks RuneProfile's log is missing. |
| Dated skill milestones | Wise Old Man achievements | Only source. |
| Quests, diaries, account type | RuneProfile | Only source. |

A refresh's report lists each source as updated, unavailable, or skipped
(not asked, because an earlier source already answered). Saved data is kept
whenever a source has no answer.

## Verification

`node --loader ./lib/test-register.mjs --test lib/provider-client.test.ts`
executes the production SQL against disposable SQLite databases, with separate
client instances and mocked upstreams. No requests hit real providers in tests.
