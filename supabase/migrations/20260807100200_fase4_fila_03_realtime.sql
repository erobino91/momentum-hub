-- Fase 4 — Fila de Espera, migration 3 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260617160000_phase4_realtime.sql`.
-- Uma seção só: o arquivo é um bloco `do $$` e não pode ser cortado.
--
-- Sem esta publicação o Fila não quebra visivelmente — ele só para de atualizar
-- entre aparelhos, e o balcão descobre pelo caminho errado (dois tablets
-- discordando). Por isso o verify confere `pg_publication_tables`.

-- Phase 4: enable Supabase Realtime on the queue table so the active queue
-- updates live across devices. RLS still governs which rows each client sees.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'waiting_entries'
  ) then
    alter publication supabase_realtime add table public.waiting_entries;
  end if;
end
$$;
