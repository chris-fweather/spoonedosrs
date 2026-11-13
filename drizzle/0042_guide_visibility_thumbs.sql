-- Who may read a guide: everyone ('public', every guide so far) or signed-in staff of any rank only ('staff', for guides
-- such as how to write a guide). Publishers choose it in the staff guide workshop; every public read filters on it.
ALTER TABLE community_guides ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','staff'));
-- One thumbs up per signed-in Discord account per guide (authors may give their own guide one). Taking it back deletes the
-- row. The thumbs on an author's published guides add to the reputation shown on each profile they have linked.
CREATE TABLE guide_thumbs (
 guide_id TEXT NOT NULL REFERENCES community_guides(id) ON DELETE CASCADE,
 voter_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY (guide_id, voter_id)
);
CREATE INDEX guide_thumbs_voter ON guide_thumbs(voter_id);
