-- A staff member's job title for their rank scimitar's hover card ("Head Admin", "Guide Lead").
-- Set by staff who manage that member's rank (lib/staff-policy.ts staffTitle validates it); NULL shows the default ("Site Admin").
-- The rank itself stays in role, so the card's Rank line always names the real level.
ALTER TABLE staff_members ADD COLUMN title TEXT CHECK(title IS NULL OR length(title) BETWEEN 2 AND 32);
