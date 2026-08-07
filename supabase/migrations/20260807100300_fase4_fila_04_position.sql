-- Fase 4 — Fila de Espera, migration 4 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260617161500_phase6_position.sql`.
-- Uma seção só. O backfill roda sobre tabela vazia aqui (os dados chegam depois,
-- pelo `migrate-to-hub.mjs`, já com o `position` de origem) — fica no arquivo para
-- a migration continuar sendo a mesma dos dois lados.

-- Phase 6: manual queue ordering.
-- A `position` column persists the host's manual order so it survives realtime
-- refetches and is consistent across devices. Default order remains arrival
-- time; new entries are appended at the bottom (handled in the app).

alter table public.waiting_entries add column position integer;

-- Backfill existing rows by arrival time, per restaurant.
with ordered as (
  select id,
         row_number() over (partition by restaurant_id order by created_at) as rn
  from public.waiting_entries
)
update public.waiting_entries w
set position = o.rn
from ordered o
where o.id = w.id;

create index waiting_entries_position_idx
  on public.waiting_entries (restaurant_id, position);
