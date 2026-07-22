-- ============================================================================
-- SmartPath — Migración 0008: Gamificación (Paso 10, §9)
-- XP, racha, logros y metas. El OTORGAMIENTO de XP ocurre SOLO en el servidor
-- (Edge Function con service_role): el cliente nunca escribe xp_evento/racha/logro.
-- El estudiante solo puede LEER lo propio, y CREAR/editar sus metas.
-- ============================================================================

create table xp_evento (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  tipo text not null,          -- 'tarea' | 'asistencia' | 'meta' | 'racha'
  puntos int not null check (puntos > 0),
  referencia uuid,             -- id de la entidad que originó el XP (evita duplicados)
  creado_en timestamptz not null default now(),
  unique (estudiante_id, tipo, referencia)
);
create index idx_xp_estudiante on xp_evento (estudiante_id, creado_en desc);
create index idx_xp_colegio on xp_evento (colegio_id);

create table racha (
  estudiante_id uuid primary key references estudiante(id) on delete cascade,
  colegio_id uuid not null references colegio(id) on delete cascade,
  dias int not null default 0,
  mejor_racha int not null default 0,
  ultima_fecha date
);

create table logro (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  clave text not null,         -- 'primera_semana' | 'racha_7' | 'diez_tareas' | ...
  obtenido_en timestamptz not null default now(),
  unique (estudiante_id, clave)
);
create index idx_logro_estudiante on logro (estudiante_id);

create table meta (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  titulo text not null,
  completada boolean not null default false,
  creado_en timestamptz not null default now(),
  completada_en timestamptz
);
create index idx_meta_estudiante on meta (estudiante_id);

-- ---------- RLS ----------
-- Lectura: director todo; docente sus estudiantes; padre sus hijos; estudiante lo propio.
-- Escritura de XP/racha/logro: NADIE desde el cliente (solo Edge Function service_role).
alter table xp_evento enable row level security;
create policy xp_select on xp_evento for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );

alter table racha enable row level security;
create policy racha_select on racha for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );

alter table logro enable row level security;
create policy logro_select on logro for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );

-- Metas: el estudiante gestiona las suyas (leer/crear/editar/borrar); padres y
-- docentes las leen. Completar una meta otorga XP vía Edge Function.
alter table meta enable row level security;
create policy meta_select on meta for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );
create policy meta_write_self on meta for all to authenticated
  using (colegio_id = auth_colegio_id() and estudiante_id = mi_estudiante_id())
  with check (colegio_id = auth_colegio_id() and estudiante_id = mi_estudiante_id());

-- Realtime para que el panel del estudiante reaccione al XP otorgado
alter publication supabase_realtime add table xp_evento, racha, logro;

-- Nivel a partir del XP acumulado (curva simple: nivel = floor(sqrt(xp/100)) + 1)
create or replace function nivel_desde_xp(p_xp int) returns int
language sql immutable as $$
  select greatest(1, floor(sqrt(greatest(p_xp,0) / 100.0))::int + 1)
$$;
