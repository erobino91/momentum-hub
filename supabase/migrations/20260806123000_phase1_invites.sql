-- Fase 1: convites
--
-- A agência não cria o usuário — ela registra um convite (email + org + papel).
-- Quando essa pessoa se cadastra com o mesmo email, um trigger em `auth.users`
-- converte o convite em membership.
--
-- Por que assim: criar usuário pela Admin API exigiria a service key dentro do
-- app. Deste jeito o hub continua usando só a chave anon, como manda o CLAUDE.md.

create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  org_id      uuid not null references public.orgs (id) on delete cascade,
  role        public.membership_role not null default 'owner',
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

-- Um convite pendente por email+org. Emails são comparados em minúsculas.
create unique index if not exists invites_pending_email_org_idx
  on public.invites (lower(email), org_id)
  where accepted_at is null;

create index if not exists invites_email_idx on public.invites (lower(email));

alter table public.invites enable row level security;

-- Só a agência mexe em convites. O cliente nunca lê esta tabela: o vínculo dele
-- aparece em `memberships` depois que o trigger roda.
drop policy if exists invites_agency_all on public.invites;
create policy invites_agency_all on public.invites
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

-- ---------------------------------------------------------------------------
-- Trigger: cadastro consome o convite
-- ---------------------------------------------------------------------------

create or replace function public.accept_invites_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (user_id, org_id, role)
  select new.id, i.org_id, i.role
  from public.invites i
  where lower(i.email) = lower(new.email)
    and i.accepted_at is null
  on conflict (user_id, org_id) do nothing;

  update public.invites
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_accept_invites on auth.users;
create trigger on_auth_user_created_accept_invites
  after insert on auth.users
  for each row execute function public.accept_invites_for_new_user();
