-- A supporter chooses, per name, whether "the Generous" shows after it. Existing names keep showing it (1).
ALTER TABLE profile_presentation ADD COLUMN show_title INTEGER NOT NULL DEFAULT 1 CHECK(show_title IN (0,1));
