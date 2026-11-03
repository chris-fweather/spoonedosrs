-- Guide writers and current and former staff are listed on the Credits page; 0 hides the person (Account settings).
ALTER TABLE users ADD COLUMN credits_listed INTEGER NOT NULL DEFAULT 1 CHECK(credits_listed IN (0,1));
