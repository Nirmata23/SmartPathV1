-- ============================================================================
-- SmartPath — Migración 0016: Carné digital y control de acceso (Extra, §35, §10)
-- Registro de entrada/salida del estudiante. El carné muestra un QR con el código
-- del estudiante; en recepción se registra el ingreso/egreso. El padre ve los
-- movimientos de sus hijos (seguridad y tranquilidad).
-- ============================================================================

create table acceso_registro (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','salida')),
  metodo text not null default 'codigo' check (metodo in ('codigo','qr','manual')),
  registrado_por uuid references perfil(id),
  creado_en timestamptz not null default now()
);
create index idx_acceso_colegio_fecha on acceso_registro (colegio_id, creado_en desc);
create index idx_acceso_estudiante on acceso_registro (estudiante_id, creado_en desc);

alter table acceso_registro enable row level security;

-- Lectura: director todo; docente de la sección; padre de sus hijos; estudiante lo propio.
create policy acceso_select on acceso_registro for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );
-- Registro: director o docente del colegio (recepción / control de acceso).
create policy acceso_insert on acceso_registro for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and registrado_por = auth.uid()
    and (es_director() or auth_rol() = 'docente')
  );

-- Realtime: el padre ve el ingreso/egreso de su hijo al instante
alter publication supabase_realtime add table acceso_registro;

-- Buscar estudiante por carné dentro del colegio del usuario (para el registro
-- rápido en recepción). Security definer pero acotado al colegio del que llama.
create or replace function buscar_estudiante_por_carne(p_carne text)
returns table (id uuid, nombre text, seccion_id uuid)
language sql stable security definer set search_path = public as $$
  select e.id, e.nombre, e.seccion_id
  from estudiante e
  where e.colegio_id = auth_colegio_id()
    and e.carne = p_carne
$$;
revoke execute on function buscar_estudiante_por_carne(text) from public, anon;
