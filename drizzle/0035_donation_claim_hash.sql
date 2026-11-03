-- Anonymous donations are claimed by their one-time code alone: the claim looks the donation up by the code's hash.
-- Codes are 80 random bits, so two live hashes never match; the index makes that a rule and the lookup direct.
-- Claiming clears the hash, and NULL hashes (claimed or signed-in donations) never collide.
CREATE UNIQUE INDEX donations_claim_hash ON donations(claim_hash) WHERE claim_hash IS NOT NULL;
