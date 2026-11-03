-- RuneLite plugin: tokens that let the plugin write to a player's linked profiles, the game accounts
-- the plugin has seen (keyed, never the raw account identifier), the events already received so a
-- resent event is never counted twice, and site notifications about profile links.
CREATE TABLE plugin_tokens (
 id TEXT PRIMARY KEY NOT NULL,
 discord_id TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 label TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 last_used_at INTEGER,
 revoked_at INTEGER
);
CREATE INDEX plugin_tokens_owner ON plugin_tokens(discord_id,revoked_at);
-- A character the plugin saw a player log in to. It is the player's proof for adding the name or
-- asking staff to review someone else's link; it never links anything by itself.
CREATE TABLE plugin_accounts (
 account_key TEXT NOT NULL,
 discord_id TEXT NOT NULL,
 rsn TEXT NOT NULL,
 display_name TEXT NOT NULL,
 first_seen INTEGER NOT NULL,
 last_seen INTEGER NOT NULL,
 PRIMARY KEY(account_key,discord_id)
);
CREATE INDEX plugin_accounts_owner ON plugin_accounts(discord_id,last_seen DESC);
CREATE INDEX plugin_accounts_rsn ON plugin_accounts(rsn);
CREATE TABLE plugin_events (
 discord_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 rsn TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('PET','COLLECTION_ITEM','COMBAT_TASK')),
 received_at INTEGER NOT NULL,
 PRIMARY KEY(discord_id,event_id)
);
CREATE INDEX plugin_events_received ON plugin_events(received_at);
-- Messages for a Discord account about its profiles, shown on the Account page until dismissed.
CREATE TABLE notifications (
 id TEXT PRIMARY KEY NOT NULL,
 discord_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('link_review_requested','link_review_opened','link_review_approved','link_review_rejected')),
 rsn TEXT NOT NULL,
 case_id TEXT,
 created_at INTEGER NOT NULL,
 read_at INTEGER
);
CREATE INDEX notifications_inbox ON notifications(discord_id,read_at,created_at DESC);
