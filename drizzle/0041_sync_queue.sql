-- Sources waiting in the sync queue (lib/sync-queue.ts), one row per name and source. A row stops the same source being
-- queued twice for a name, and tells the profile which sources are still on their way. The consumer deletes the row
-- when the source lands, has nothing for the name, or finally fails. A row older than 15 minutes is stale and may be
-- queued again. Times are Unix ms.
CREATE TABLE sync_pending (
  rsn TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('runeprofile','temple','wom')),
  queued_at INTEGER NOT NULL,
  PRIMARY KEY (rsn, source)
);
