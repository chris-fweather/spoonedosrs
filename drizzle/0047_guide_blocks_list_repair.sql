-- An earlier form of 0044 could store a guide's blocks as text holding a list, instead of the list itself, on newer
-- SQLite (the list came out of a subquery). Where that happened (possible on the dev site only: 0044 changes nothing on
-- a site that gets the tree runs guide from 0038), this turns the text back into the list. Guides whose blocks are
-- already a list are not touched.
UPDATE community_guides SET draft = json_set(draft, '$.blocks', json(json_extract(draft, '$.blocks')))
WHERE json_valid(draft) AND json_type(draft, '$.blocks') = 'text' AND json_valid(json_extract(draft, '$.blocks')) AND json_type(json_extract(draft, '$.blocks')) = 'array';
UPDATE community_guides SET published = json_set(published, '$.blocks', json(json_extract(published, '$.blocks')))
WHERE published IS NOT NULL AND json_valid(published) AND json_type(published, '$.blocks') = 'text' AND json_valid(json_extract(published, '$.blocks')) AND json_type(json_extract(published, '$.blocks')) = 'array';
