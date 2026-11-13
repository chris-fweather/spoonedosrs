-- The collection log has 1,734 unique items (The Fractured Archive added 17), so the collection log emblems are
-- shares of 1,734 instead of 1,717 and their ids change (lib/flair.ts, CLOG_UNIQUE). Pinned emblems move to the
-- same share of the new total, so nobody loses the emblem they show. 1% (17) keeps its id.
UPDATE claimed_names SET pinned_mark = CASE pinned_mark
  WHEN 'clog-86' THEN 'clog-87'
  WHEN 'clog-172' THEN 'clog-173'
  WHEN 'clog-343' THEN 'clog-347'
  WHEN 'clog-429' THEN 'clog-434'
  WHEN 'clog-687' THEN 'clog-694'
  WHEN 'clog-859' THEN 'clog-867'
  WHEN 'clog-1030' THEN 'clog-1040'
  WHEN 'clog-1288' THEN 'clog-1301'
  WHEN 'clog-1545' THEN 'clog-1561'
  WHEN 'clog-1717' THEN 'clog-1734'
  ELSE pinned_mark END
WHERE pinned_mark IN ('clog-86','clog-172','clog-343','clog-429','clog-687','clog-859','clog-1030','clog-1288','clog-1545','clog-1717');
-- Saved choices of a profile whose link was removed, restored when the same account links it again.
UPDATE profile_link_owners SET saved_flair = json_set(saved_flair, '$.pinned_mark', CASE json_extract(saved_flair, '$.pinned_mark')
  WHEN 'clog-86' THEN 'clog-87'
  WHEN 'clog-172' THEN 'clog-173'
  WHEN 'clog-343' THEN 'clog-347'
  WHEN 'clog-429' THEN 'clog-434'
  WHEN 'clog-687' THEN 'clog-694'
  WHEN 'clog-859' THEN 'clog-867'
  WHEN 'clog-1030' THEN 'clog-1040'
  WHEN 'clog-1288' THEN 'clog-1301'
  WHEN 'clog-1545' THEN 'clog-1561'
  WHEN 'clog-1717' THEN 'clog-1734'
  END)
WHERE json_valid(saved_flair) AND json_extract(saved_flair, '$.pinned_mark') IN ('clog-86','clog-172','clog-343','clog-429','clog-687','clog-859','clog-1030','clog-1288','clog-1545','clog-1717');
