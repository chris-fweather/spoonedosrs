-- 0044 and 0045 looked for the tree runs paragraph ("…plant the best of each you can…") only in the guide saved under
-- the id 'tree-runs'. On the dev site the guide people read was written there first and is saved under another id, so
-- it kept the paragraph. This removes that one paragraph from whichever guide holds it, in the draft and the published
-- copy (twice each, in case a copy holds it in two places). No other text and no other block is touched; a site
-- without the paragraph (production) is unchanged.
UPDATE community_guides SET published = json_remove(published, (SELECT t.fullkey FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE published IS NOT NULL AND published LIKE '%plant the best of each you can%' AND json_valid(published) AND EXISTS (SELECT 1 FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
UPDATE community_guides SET published = json_remove(published, (SELECT t.fullkey FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE published IS NOT NULL AND published LIKE '%plant the best of each you can%' AND json_valid(published) AND EXISTS (SELECT 1 FROM json_tree(community_guides.published) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
UPDATE community_guides SET draft = json_remove(draft, (SELECT t.fullkey FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE draft IS NOT NULL AND draft LIKE '%plant the best of each you can%' AND json_valid(draft) AND EXISTS (SELECT 1 FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
UPDATE community_guides SET draft = json_remove(draft, (SELECT t.fullkey FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]' ORDER BY length(t.fullkey) DESC LIMIT 1))
WHERE draft IS NOT NULL AND draft LIKE '%plant the best of each you can%' AND json_valid(draft) AND EXISTS (SELECT 1 FROM json_tree(community_guides.draft) t
  WHERE t.type = 'object' AND json_extract(t.value, '$.kind') = 'text' AND json_extract(t.value, '$.text') LIKE '%plant the best of each you can%' AND t.fullkey LIKE '%]');
