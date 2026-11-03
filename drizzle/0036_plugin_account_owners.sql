-- A RuneScape account proven through the RuneLite plugin stays with the Discord account that proved it.
-- A binding is made when that Discord account's plugin syncs the account while the name is linked to it,
-- or when it adds the name from "Seen by the RuneLite plugin". Afterwards no other Discord account can
-- sync or add that game account, under any name (a name change or an unlinked name included); they can
-- only ask staff to review. account_key is the same keyed hash as plugin_accounts, never the raw identifier.
-- rsn is the name the owner last synced it under; rsn_at_binding the name it was first bound under.
-- Staff transfers move or clear bindings; unlinking a name keeps it (only the owner's own release clears it).
-- No backfill: existing linked characters are bound on their next sync.
CREATE TABLE plugin_account_owners (
 account_key TEXT PRIMARY KEY NOT NULL,
 discord_id TEXT NOT NULL,
 rsn TEXT NOT NULL,
 rsn_at_binding TEXT NOT NULL,
 bound_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX plugin_account_owners_owner ON plugin_account_owners(discord_id);
CREATE INDEX plugin_account_owners_rsn ON plugin_account_owners(rsn);
