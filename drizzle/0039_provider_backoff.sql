-- Repeated "too many requests" answers from a provider back off further each time (1, 2, 4, 8 minutes, capped at 15)
-- when the provider gives no Retry-After. The count resets after the next good answer. Existing rows start at zero.
ALTER TABLE provider_pacing ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0;
