-- Fase 4 — Fila de Espera, migration 6 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260620120000_optional_party_wait.sql`.
-- Uma seção só.

-- Party size and estimated wait are now optional fields (the host may register a
-- customer without them). Drop the NOT NULL so blank values are stored as null.
-- The existing CHECK constraints stay: in Postgres a CHECK passes when the value
-- is NULL, and still rejects out-of-range numbers when a value is present.

alter table waiting_entries alter column party_size drop not null;
alter table waiting_entries alter column estimated_wait_minutes drop not null;
