-- ============================================================================
-- SmartPath — Migración 0013: Planilla del personal (Paso 12, §32, §41)
-- El sistema CALCULA y REGISTRA la nómina (IGSS/ISR/Bono 14); el dinero lo mueve
-- el director por su banco (SmartPath no es entidad financiera). El cálculo del
-- neto ocurre en el servidor (Edge Function). El empleado ve SOLO sus recibos.
-- ============================================================================

create table empleado (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  perfil_id uuid references perfil(id) on delete set null,  -- si tiene login (docente)
  nombre text not null,
  puesto text,
  salario_base numeric(10,2) not null default 0 check (salario_base >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index idx_empleado_colegio on empleado (colegio_id);
create index idx_empleado_perfil on empleado (perfil_id);

create table planilla_periodo (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  mes date not null,                        -- primer día del mes
  estado text not null default 'abierta' check (estado in ('abierta','cerrada')),
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  unique (colegio_id, mes)
);

create table pago_personal (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  empleado_id uuid not null references empleado(id) on delete cascade,
  periodo_id uuid not null references planilla_periodo(id) on delete cascade,
  bruto numeric(10,2) not null,
  descuentos jsonb not null default '{}',   -- {igss, isr, otros}
  provisiones jsonb not null default '{}',  -- {bono14, aguinaldo}
  neto numeric(10,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado')),
  pagado_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (empleado_id, periodo_id)
);
create index idx_pagopers_colegio on pago_personal (colegio_id);
create index idx_pagopers_periodo on pago_personal (periodo_id);
create index idx_pagopers_empleado on pago_personal (empleado_id);

-- Acuse firmado de pago recibido (constancia de nómina, §47.2)
create table acuse_pago_personal (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pago_personal_id uuid not null references pago_personal(id) on delete cascade,
  firmado boolean not null default false,
  firmado_en timestamptz,
  unique (pago_personal_id)
);

-- ---------- RLS ----------
-- ¿El usuario actual es el empleado de este registro?
create or replace function es_mi_empleado(p_empleado uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from empleado e where e.id = p_empleado and e.perfil_id = auth.uid())
$$;
revoke execute on function es_mi_empleado(uuid) from public, anon;

alter table empleado enable row level security;
create policy empleado_select on empleado for select to authenticated
  using (colegio_id = auth_colegio_id() and (es_director() or perfil_id = auth.uid()));
create policy empleado_write_director on empleado for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

alter table planilla_periodo enable row level security;
create policy periodo_select on planilla_periodo for select to authenticated
  using (colegio_id = auth_colegio_id() and es_director());
create policy periodo_write_director on planilla_periodo for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

alter table pago_personal enable row level security;
-- director ve todo; el empleado ve SOLO sus recibos
create policy pagopers_select on pago_personal for select to authenticated
  using (colegio_id = auth_colegio_id() and (es_director() or es_mi_empleado(empleado_id)));
-- la escritura (cálculo del neto) la hace la Edge Function con service_role;
-- el director también puede marcar pagado directamente
create policy pagopers_write_director on pago_personal for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

alter table acuse_pago_personal enable row level security;
create policy acusepers_select on acuse_pago_personal for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (es_director() or exists (
      select 1 from pago_personal pp where pp.id = acuse_pago_personal.pago_personal_id and es_mi_empleado(pp.empleado_id)
    ))
  );
-- el empleado firma de recibido su propio acuse
create policy acusepers_insert_empleado on acuse_pago_personal for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and exists (select 1 from pago_personal pp where pp.id = acuse_pago_personal.pago_personal_id and es_mi_empleado(pp.empleado_id))
  );
