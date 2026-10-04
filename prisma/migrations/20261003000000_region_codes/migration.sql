-- Data migration: align stored region values with g2bulk's own game codes (e.g.
-- "freefire_me") instead of a custom human label, now that catalogue entries are
-- synced live across every g2bulk Free Fire region rather than just one hand-seeded one.
UPDATE "SupplierCatalogEntry" SET region = 'freefire_me' WHERE region = 'middle_east';
