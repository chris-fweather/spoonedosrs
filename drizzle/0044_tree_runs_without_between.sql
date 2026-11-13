-- The tree runs guide lost its paragraph on trees between the three setups ("Between brackets, plant the best of each
-- you can…"). Migration 0038 no longer has it, so a site that gets the guide from 0038 now is unchanged here. A site
-- that already had the guide (the dev site, where it was written) drops the paragraph from its draft and from its
-- published copy, so both sites read the same. Every other block, and any other guide, is left as it is.
-- The new list is wrapped in json(): a list that comes out of a subquery is otherwise stored as text by newer SQLite.
UPDATE community_guides SET draft = json_set(draft, '$.blocks', json((
  SELECT json_group_array(json(value)) FROM (
    SELECT b.value FROM json_each(community_guides.draft, '$.blocks') b
    WHERE NOT (COALESCE(json_extract(b.value, '$.id'), '') = 'between' OR COALESCE(json_extract(b.value, '$.text'), '') LIKE 'Between brackets, plant the best%')
    ORDER BY b.key))))
WHERE id = 'tree-runs' AND json_valid(draft) AND EXISTS (
  SELECT 1 FROM json_each(community_guides.draft, '$.blocks') b
  WHERE COALESCE(json_extract(b.value, '$.id'), '') = 'between' OR COALESCE(json_extract(b.value, '$.text'), '') LIKE 'Between brackets, plant the best%');
UPDATE community_guides SET published = json_set(published, '$.blocks', json((
  SELECT json_group_array(json(value)) FROM (
    SELECT b.value FROM json_each(community_guides.published, '$.blocks') b
    WHERE NOT (COALESCE(json_extract(b.value, '$.id'), '') = 'between' OR COALESCE(json_extract(b.value, '$.text'), '') LIKE 'Between brackets, plant the best%')
    ORDER BY b.key))))
WHERE id = 'tree-runs' AND published IS NOT NULL AND json_valid(published) AND EXISTS (
  SELECT 1 FROM json_each(community_guides.published, '$.blocks') b
  WHERE COALESCE(json_extract(b.value, '$.id'), '') = 'between' OR COALESCE(json_extract(b.value, '$.text'), '') LIKE 'Between brackets, plant the best%');
