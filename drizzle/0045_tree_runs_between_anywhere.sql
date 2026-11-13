-- 0044 removed the "plant the best of each you can" paragraph from the tree runs guide only where it was a block of its
-- own at the top of the guide. On the dev site the published copy still showed it: it sat inside another block there.
-- This removes it wherever it is, in the draft and the published copy, one occurrence per statement (run twice in case
-- both a column and the top level hold one). Where the paragraph is not present (production), nothing changes.
UPDATE community_guides SET published = json_remove(published, (SELECT t.fullkey FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE id = 'tree-runs' AND published IS NOT NULL AND json_valid(published) AND EXISTS (SELECT 1 FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
UPDATE community_guides SET published = json_remove(published, (SELECT t.fullkey FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE id = 'tree-runs' AND published IS NOT NULL AND json_valid(published) AND EXISTS (SELECT 1 FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
UPDATE community_guides SET draft = json_remove(draft, (SELECT t.fullkey FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE id = 'tree-runs' AND json_valid(draft) AND EXISTS (SELECT 1 FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
UPDATE community_guides SET draft = json_remove(draft, (SELECT t.fullkey FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE id = 'tree-runs' AND json_valid(draft) AND EXISTS (SELECT 1 FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
