-- Fase 4 — Fila de Espera, migration 5 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260617163000_phase7_settings.sql`,
-- com as linhas `-- ------` inseridas. Corpo do SQL sem alteração.
--
-- O bucket `logos` é o primeiro objeto de storage deste projeto — hoje o do Fila
-- está vazio e `restaurants.logo_url` é NULL, então não há arquivo para copiar.

-- ---------------------------------------------------------------------------
-- Google Sheets URL
-- ---------------------------------------------------------------------------

-- ── Google Sheets URL (stored now; integration in Phase 9) ─────────────────
alter table public.restaurants add column google_sheet_url text;

-- ---------------------------------------------------------------------------
-- Bucket de logos
-- ---------------------------------------------------------------------------

-- ── Storage bucket for restaurant logos ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Public read; authenticated host can manage objects in the logos bucket.
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');
create policy "logos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'logos');
create policy "logos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'logos');
create policy "logos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'logos');

-- ---------------------------------------------------------------------------
-- Anonimização manual (LGPD)
-- ---------------------------------------------------------------------------

-- ── Manual anonymization (§9.4) ────────────────────────────────────────────
-- Removes personal data (name, phone, email, date_of_birth) from customers
-- whose last visit is older than p_months, plus free-text observations on
-- their entries. Keeps anonymized statistical records (party size, dates,
-- wait times). Scoped to the caller's restaurant.
create or replace function public.anonymize_old_records(p_months integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid    uuid := public.current_restaurant_id();
  v_cutoff timestamptz := now() - make_interval(months => greatest(p_months, 0));
  v_count  integer;
begin
  if v_rid is null then
    return 0;
  end if;

  with old_customers as (
    select c.id
    from public.customers c
    where c.restaurant_id = v_rid
      and c.name <> 'Cliente anonimizado'
      and coalesce(
            (select max(w.created_at) from public.waiting_entries w
             where w.customer_id = c.id),
            c.created_at
          ) < v_cutoff
  )
  update public.customers c
  set name          = 'Cliente anonimizado',
      phone         = 'ANON-' || c.id::text,
      email         = null,
      date_of_birth = null
  from old_customers o
  where c.id = o.id;

  get diagnostics v_count = row_count;

  update public.waiting_entries w
  set observation = null
  from public.customers c
  where w.customer_id = c.id
    and c.restaurant_id = v_rid
    and c.name = 'Cliente anonimizado';

  return v_count;
end;
$$;

grant execute on function public.anonymize_old_records(integer) to authenticated;
