-- The RuneLite plugin section shows each token's last sync: when, which character, which plugin version.
ALTER TABLE plugin_tokens ADD COLUMN last_sync_at INTEGER;
ALTER TABLE plugin_tokens ADD COLUMN last_sync_rsn TEXT;
ALTER TABLE plugin_tokens ADD COLUMN plugin_version TEXT;

-- Donations are a ledger. Each one supports one chosen profile (target_rsn) or nobody (NULL).
-- donor_id is the Discord account that made or claimed it; NULL while an anonymous donation is unclaimed.
-- An anonymous donation has a public number ("Anonymous #0042") and the SHA-256 of a one-time claim code;
-- the code itself is shown once to the donor and never stored. Claiming clears the hash.
-- kind 'grant' is supporter status without an amount (the old users.title='the Generous' flag).
CREATE TABLE donations (
 id TEXT PRIMARY KEY NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),
 currency TEXT NOT NULL CHECK(length(currency)=3),
 target_rsn TEXT,
 donor_id TEXT,
 anonymous_number INTEGER UNIQUE,
 claim_hash TEXT,
 kind TEXT NOT NULL DEFAULT 'payment' CHECK(kind IN ('payment','grant')),
 source TEXT NOT NULL CHECK(source IN ('staff','provider','legacy')),
 provider_ref TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','refunded','reversed')),
 created_by TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX donations_target ON donations(target_rsn,status);
CREATE INDEX donations_donor ON donations(donor_id,created_at DESC);

-- A donor's choices before paying: the payment provider returns intent_id with the payment, and the webhook
-- turns it into a donation. Unused until a provider is configured.
CREATE TABLE donation_intents (
 id TEXT PRIMARY KEY NOT NULL,
 donor_id TEXT,
 target_rsn TEXT,
 anonymous INTEGER NOT NULL DEFAULT 0 CHECK(anonymous IN (0,1)),
 claim_hash TEXT,
 donation_id TEXT,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);

-- A recipient can hide supporter status someone gifted to their profile.
ALTER TABLE profile_presentation ADD COLUMN show_supporter INTEGER NOT NULL DEFAULT 1 CHECK(show_supporter IN (0,1));
-- profile_supporter_totals becomes the per-profile sum of the ledger; granted marks a 'grant' row.
ALTER TABLE profile_supporter_totals ADD COLUMN granted INTEGER NOT NULL DEFAULT 0 CHECK(granted IN (0,1));

-- Backfill, keeping every existing amount:
-- 1. Totals recorded per name stay on that name (donor unknown).
INSERT INTO donations(id,amount_minor,currency,target_rsn,kind,source,created_at,updated_at)
 SELECT 'legacy-name:'||rsn,amount_minor,currency,rsn,'payment','legacy',0,0 FROM profile_supporter_totals WHERE amount_minor>0;
-- 2. A person's total moves to their featured name if still theirs, else their first linked name (else nobody).
--    The donor can move it to another of their names in Account settings.
INSERT INTO donations(id,amount_minor,currency,target_rsn,donor_id,kind,source,created_at,updated_at)
 SELECT 'legacy-person:'||s.discord_id,s.amount_minor,s.currency,
  COALESCE((SELECT c.rsn FROM claimed_names c WHERE c.discord_id=s.discord_id AND c.rsn=s.featured_rsn),
   (SELECT c.rsn FROM claimed_names c WHERE c.discord_id=s.discord_id ORDER BY c.claimed_at,c.rsn LIMIT 1)),
  s.discord_id,'payment','legacy',0,0
 FROM supporter_totals s WHERE COALESCE(s.amount_minor,0)>0;
-- 3. The old account-wide "the Generous" flag becomes a grant on the first linked name.
INSERT INTO donations(id,amount_minor,currency,target_rsn,donor_id,kind,source,created_at,updated_at)
 SELECT 'legacy-grant:'||u.discord_id,0,'USD',(SELECT c.rsn FROM claimed_names c WHERE c.discord_id=u.discord_id ORDER BY c.claimed_at,c.rsn LIMIT 1),
  u.discord_id,'grant','legacy',0,0
 FROM users u WHERE u.title='the Generous' AND EXISTS(SELECT 1 FROM claimed_names c WHERE c.discord_id=u.discord_id);
-- 4. Rebuild the per-profile totals from the ledger. A profile holds one currency; if old data mixed two, the larger stays.
DELETE FROM profile_supporter_totals;
INSERT OR IGNORE INTO profile_supporter_totals(rsn,amount_minor,currency,granted)
 SELECT target_rsn,SUM(amount_minor),currency,MAX(kind='grant') FROM donations
 WHERE status='completed' AND target_rsn IS NOT NULL GROUP BY target_rsn,currency ORDER BY SUM(amount_minor) DESC;
-- Per-person totals are now in the ledger; nothing reads supporter_totals any more. Kept for audit.

-- What visitors see: the amount and supporter status of a profile, with the recipient's choice to hide it applied.
CREATE VIEW profile_support AS
 SELECT t.rsn,
  CASE WHEN COALESCE(p.show_supporter,1)=1 THEN t.amount_minor END AS amount_minor,
  t.currency,
  CASE WHEN COALESCE(p.show_supporter,1)=1 AND (t.amount_minor>0 OR t.granted=1) THEN 1 ELSE 0 END AS supporter
 FROM profile_supporter_totals t LEFT JOIN profile_presentation p ON p.rsn=t.rsn;
