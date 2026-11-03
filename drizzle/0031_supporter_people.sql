-- Supporters are people: one total per Discord account, shown once on the supporters list under the linked
-- RuneScape name the person picks (featured_rsn). Per-name totals of linked names are merged into their owner's
-- total, and the largest one becomes the featured name. Totals in more than one currency, and totals on names
-- nobody has linked, are left per name.
ALTER TABLE supporter_totals ADD COLUMN featured_rsn TEXT;
INSERT INTO supporter_totals(discord_id,amount_minor,currency,featured_rsn)
 SELECT c.discord_id,SUM(p.amount_minor),MIN(p.currency),
  (SELECT p2.rsn FROM profile_supporter_totals p2 JOIN claimed_names c2 ON c2.rsn=p2.rsn WHERE c2.discord_id=c.discord_id ORDER BY p2.amount_minor DESC,c2.claimed_at,p2.rsn LIMIT 1)
 FROM profile_supporter_totals p JOIN claimed_names c ON c.rsn=p.rsn
 WHERE 1 GROUP BY c.discord_id HAVING COUNT(DISTINCT p.currency)=1
 ON CONFLICT(discord_id) DO UPDATE SET amount_minor=COALESCE(supporter_totals.amount_minor,0)+excluded.amount_minor,featured_rsn=COALESCE(supporter_totals.featured_rsn,excluded.featured_rsn)
 WHERE supporter_totals.currency=excluded.currency;
DELETE FROM profile_supporter_totals WHERE rsn IN (SELECT p.rsn FROM profile_supporter_totals p JOIN claimed_names c ON c.rsn=p.rsn JOIN supporter_totals s ON s.discord_id=c.discord_id AND s.currency=p.currency);
