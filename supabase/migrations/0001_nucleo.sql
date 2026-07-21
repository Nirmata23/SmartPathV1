-- ============================================================================
-- SmartPath — Migración 0001: núcleo del MVP (Pasos 0–4)
-- Basada en docs/ESQUEMA-BASE-DATOS.sql. Solo las tablas que el MVP necesita;
-- el resto del esquema entra en fases posteriores.
-- ============================================================================

-- ---------- Tipos ----------
create type rol_tipo as enum ('director','docente','padre','estudiante');
create type asistencia_estado as enum ('presente','ausente','tardanza','justificado');

-- ---------- Tenant raíz ----------
create table colegio (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  pais          text not null default 'GT',
  moneda        text not null default 'GTQ',
  idioma        text not null default 'es',
  curriculo     text not null default 'CNB',      -- 'CNB' | 'internacional'
  logo_url      text,
  creado_en     timestamptz not null default now()
);

-- ---------- Perfil (extiende auth.users) ----------
create table perfil (
  id            uuid primary key references auth.users(id) on delete cascade,
  colegio_id    uuid not null references colegio(id) on delete cascade,
  rol           rol_tipo not null,
  nombre        text not null,
  correo        text,
  -- avatar: adultos pueden tener foto opcional; estudiantes SOLO avatar generado
  avatar_foto_url text,
  avatar_seed     text,
  avatar_pixel    text,
  creado_en     timestamptz not null default now()
);

-- ---------- Estructura académica ----------
create table grado (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  nombre text not null
);
create table seccion (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  grado_id uuid not null references grado(id) on delete cascade,
  nombre text not null
);
create table materia (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  nombre text not null
);
create table asignacion_docente (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  docente_id uuid not null references perfil(id) on delete cascade,
  seccion_id uuid not null references seccion(id) on delete cascade,
  materia_id uuid not null references materia(id) on delete cascade,
  unique (docente_id, seccion_id, materia_id)
);

-- ---------- Estudiantes y parentesco ----------
create table estudiante (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  perfil_id uuid references perfil(id) on delete set null,  -- si tiene login propio
  nombre text not null,
  carne text,                                               -- código interno para login usuario+PIN
  seccion_id uuid references seccion(id),
  avatar_seed text,
  avatar_pixel text,
  creado_en timestamptz not null default now(),
  unique (colegio_id, carne)
);
create table parentesco (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  padre_id uuid not null references perfil(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  unique (padre_id, estudiante_id)
);

-- ---------- Invitaciones (códigos de un solo uso, canje SOLO en servidor) ----------
create table invitacion (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  codigo text not null unique,
  rol rol_tipo not null,
  datos jsonb,                 -- payload por rol: p.ej. {"estudiante_ids":[...]} para padre
  usado boolean not null default false,
  usado_por uuid references perfil(id),
  expira_en timestamptz not null default (now() + interval '30 days'),
  creado_por uuid references perfil(id),
  creado_en timestamptz not null default now()
);

-- ---------- Académico: asistencia, notas, tareas ----------
create table asistencia (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  seccion_id uuid not null references seccion(id),
  fecha date not null default current_date,
  estado asistencia_estado not null,
  registrado_por uuid references perfil(id),
  creado_en timestamptz not null default now(),
  unique (estudiante_id, fecha)
);
create table calificacion (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  materia_id uuid not null references materia(id),
  actividad text not null,
  nota numeric(5,2) not null check (nota >= 0),
  ponderacion numeric(5,2) default 100 check (ponderacion > 0),
  registrado_por uuid references perfil(id),
  creado_en timestamptz not null default now()
);
create table tarea (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  seccion_id uuid not null references seccion(id),
  materia_id uuid references materia(id),
  titulo text not null,
  descripcion text,
  fecha_entrega date,
  puntos int default 0,
  creado_por uuid references perfil(id),
  creado_en timestamptz not null default now()
);
create table entrega (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  tarea_id uuid not null references tarea(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  completada boolean default false,
  fecha timestamptz,
  unique (tarea_id, estudiante_id)
);

-- ---------- Auditoría (solo lectura para director; escribe el servidor) ----------
create table auditoria (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  actor_id uuid references perfil(id),
  accion text not null,
  entidad text,
  entidad_id uuid,
  detalle jsonb,
  creado_en timestamptz not null default now()
);

-- ---------- Índices (colegio_id + FKs calientes) ----------
create index idx_perfil_colegio on perfil (colegio_id);
create index idx_grado_colegio on grado (colegio_id);
create index idx_seccion_colegio on seccion (colegio_id);
create index idx_seccion_grado on seccion (grado_id);
create index idx_materia_colegio on materia (colegio_id);
create index idx_asigdoc_colegio on asignacion_docente (colegio_id);
create index idx_asigdoc_docente on asignacion_docente (docente_id);
create index idx_asigdoc_seccion on asignacion_docente (seccion_id);
create index idx_asigdoc_materia on asignacion_docente (materia_id);
create index idx_estudiante_colegio on estudiante (colegio_id);
create index idx_estudiante_seccion on estudiante (seccion_id);
create index idx_estudiante_perfil on estudiante (perfil_id);
create index idx_parentesco_colegio on parentesco (colegio_id);
create index idx_parentesco_padre on parentesco (padre_id);
create index idx_parentesco_estudiante on parentesco (estudiante_id);
create index idx_invitacion_colegio on invitacion (colegio_id);
create index idx_asistencia_colegio_fecha on asistencia (colegio_id, fecha);
create index idx_asistencia_estudiante on asistencia (estudiante_id);
create index idx_asistencia_seccion_fecha on asistencia (seccion_id, fecha);
create index idx_calificacion_colegio on calificacion (colegio_id);
create index idx_calificacion_estudiante on calificacion (estudiante_id);
create index idx_calificacion_materia on calificacion (materia_id);
create index idx_tarea_colegio on tarea (colegio_id);
create index idx_tarea_seccion on tarea (seccion_id);
create index idx_entrega_colegio on entrega (colegio_id);
create index idx_entrega_tarea on entrega (tarea_id);
create index idx_entrega_estudiante on entrega (estudiante_id);
create index idx_auditoria_colegio on auditoria (colegio_id, creado_en desc);

-- ---------- Helpers de autorización (security definer, search_path fijo) ----------
-- Internamente ignoran RLS (dueño postgres) para evitar recursión de políticas.
create or replace function auth_colegio_id() returns uuid
language sql stable security definer set search_path = public as $$
  select colegio_id from perfil where id = auth.uid()
$$;

create or replace function auth_rol() returns rol_tipo
language sql stable security definer set search_path = public as $$
  select rol from perfil where id = auth.uid()
$$;

-- ¿El usuario actual es docente asignado a la sección?
create or replace function es_docente_de_seccion(p_seccion uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from asignacion_docente ad
    where ad.docente_id = auth.uid() and ad.seccion_id = p_seccion
  )
$$;

-- ¿El usuario actual es docente del estudiante (opcionalmente en una materia)?
create or replace function es_docente_de_estudiante(p_estudiante uuid, p_materia uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from asignacion_docente ad
    join estudiante e on e.seccion_id = ad.seccion_id
    where ad.docente_id = auth.uid()
      and e.id = p_estudiante
      and (p_materia is null or ad.materia_id = p_materia)
  )
$$;

-- ¿El usuario actual es padre/tutor del estudiante?
create or replace function es_padre_de(p_estudiante uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from parentesco p
    where p.padre_id = auth.uid() and p.estudiante_id = p_estudiante
  )
$$;

-- id del registro estudiante vinculado al usuario actual (o null)
create or replace function mi_estudiante_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from estudiante where perfil_id = auth.uid()
$$;

-- ---------- Protección de perfil: nadie se auto-promueve ----------
create or replace function proteger_perfil_campos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.rol is distinct from old.rol or new.colegio_id is distinct from old.colegio_id)
     and coalesce((current_setting('request.jwt.claims', true))::jsonb->>'role','') = 'authenticated'
  then
    raise exception 'No autorizado a cambiar rol o colegio';
  end if;
  return new;
end $$;
create trigger trg_proteger_perfil before update on perfil
  for each row execute function proteger_perfil_campos();

-- ---------- Auditoría automática de cambios de nota ----------
create or replace function auditar_calificacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (colegio_id, actor_id, accion, entidad, entidad_id, detalle)
  values (
    coalesce(new.colegio_id, old.colegio_id),
    auth.uid(),
    lower(tg_op),
    'calificacion',
    coalesce(new.id, old.id),
    jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new))
  );
  return coalesce(new, old);
end $$;
create trigger trg_auditar_calificacion
  after insert or update or delete on calificacion
  for each row execute function auditar_calificacion();

-- ---------- Realtime: notas y asistencia llegan al instante (respetando RLS) ----------
alter publication supabase_realtime add table calificacion, asistencia;
