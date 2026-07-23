-- ============================================================================
-- SmartPath — Migración 0012: Planificador docente (Paso 8, §7, §24)
-- Cada docente crea sus planes de clase en modo CNB (áreas curriculares GT ya
-- cargadas) o modo libre (estructura propia). Puede compartir con el director y
-- otros docentes del colegio, o mantenerlo privado.
-- ============================================================================

create table plan_clase (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  docente_id uuid not null references perfil(id) on delete cascade,
  materia_id uuid references materia(id) on delete set null,
  titulo text not null,
  modo text not null default 'libre' check (modo in ('cnb','libre')),
  contenido jsonb not null default '{}',   -- estructura flexible por modo
  compartido boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index idx_plan_colegio on plan_clase (colegio_id);
create index idx_plan_docente on plan_clase (docente_id);

alter table plan_clase enable row level security;

-- Lectura: el autor siempre; el director todo; otros docentes solo los compartidos.
create policy plan_select on plan_clase for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      docente_id = auth.uid()
      or es_director()
      or (compartido and auth_rol() = 'docente')
    )
  );
-- Escritura: solo el docente dueño gestiona sus planes.
create policy plan_write_owner on plan_clase for all to authenticated
  using (colegio_id = auth_colegio_id() and docente_id = auth.uid())
  with check (colegio_id = auth_colegio_id() and docente_id = auth.uid());
