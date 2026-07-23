-- ============================================================================
-- SmartPath — Migración 0015: Web Push (Extra, §37)
-- Suscripciones de notificaciones del navegador. Cada usuario administra SUS
-- propias suscripciones. El envío ocurre en una Edge Function (enviar-push) con
-- las llaves VAPID en variables de entorno (nunca en el cliente ni el repo).
-- ============================================================================

create table push_sub (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid references colegio(id) on delete cascade,
  user_id uuid not null references perfil(id) on delete cascade,
  endpoint text not null,
  sub jsonb not null,
  creado_en timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index idx_pushsub_colegio on push_sub (colegio_id);
create index idx_pushsub_user on push_sub (user_id);

alter table push_sub enable row level security;
-- cada quien gestiona SUS suscripciones (leer/crear/borrar las propias)
create policy pushsub_all_self on push_sub for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and colegio_id = auth_colegio_id());
