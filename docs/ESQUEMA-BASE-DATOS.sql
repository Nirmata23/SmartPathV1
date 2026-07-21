-- ============================================================================
-- SmartPath — Esquema base de datos (Supabase / PostgreSQL) con RLS
-- Plantilla de arranque para Fable. Revisar y ampliar antes de producción.
-- Principio: RLS ACTIVADA en todo; aislamiento por colegio_id; validar en servidor.
-- ============================================================================

-- ---------- Tipos ----------
create type rol_tipo as enum ('director','docente','padre','estudiante');
create type asistencia_estado as enum ('presente','ausente','tardanza','justificado');
create type pago_estado as enum ('pendiente','en_revision','pagado','rechazado');

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
  -- avatar: para adultos, foto opcional; para estudiantes, semilla/código de pixel art
  avatar_foto_url text,          -- solo roles adultos (opcional)
  avatar_seed     text,          -- estudiantes: semilla del avatar generado
  avatar_pixel    text,          -- estudiantes: código de pixel art propio (texto corto)
  creado_en     timestamptz not null default now()
);

-- helper: colegio del usuario autenticado
create or replace function auth_colegio_id() returns uuid
language sql stable security definer set search_path = public as $$
  select colegio_id from perfil where id = auth.uid()
$$;

create or replace function auth_rol() returns rol_tipo
language sql stable security definer set search_path = public as $$
  select rol from perfil where id = auth.uid()
$$;

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
  materia_id uuid not null references materia(id) on delete cascade
);

-- ---------- Estudiantes y parentesco ----------
create table estudiante (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  perfil_id uuid references perfil(id) on delete set null,  -- si tiene login propio
  nombre text not null,
  seccion_id uuid references seccion(id),
  avatar_seed text,
  avatar_pixel text
);
create table parentesco (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  padre_id uuid not null references perfil(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade
);

-- ---------- Invitaciones (códigos de un solo uso) ----------
create table invitacion (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  codigo text not null unique,
  rol rol_tipo not null,
  usado boolean not null default false,
  expira_en timestamptz not null default (now() + interval '30 days'),
  creado_en timestamptz not null default now()
);

-- ---------- Académico: asistencia, notas, tareas ----------
create table asistencia (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  seccion_id uuid not null references seccion(id),
  fecha date not null,
  estado asistencia_estado not null,
  registrado_por uuid references perfil(id)
);
create table calificacion (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  materia_id uuid not null references materia(id),
  actividad text not null,
  nota numeric(5,2) not null,
  ponderacion numeric(5,2) default 100,
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
  creado_por uuid references perfil(id)
);
create table entrega (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  tarea_id uuid not null references tarea(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  completada boolean default false,
  fecha timestamptz
);

-- ---------- Agenda virtual "hoja real" ----------
create table agenda_pagina (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  seccion_id uuid not null references seccion(id),
  autor_id uuid not null references perfil(id),   -- docente
  fecha date not null default current_date,
  tipo text not null,          -- 'material' | 'tarea' | 'propuesta' | 'queja' | 'nota'
  contenido jsonb not null,
  estudiante_id uuid references estudiante(id)     -- para quejas privadas a un alumno
);
create table agenda_respuesta (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pagina_id uuid not null references agenda_pagina(id) on delete cascade,
  autor_id uuid not null references perfil(id),
  contenido text,
  firmado boolean default false,
  creado_en timestamptz not null default now()
);

-- ---------- Planificador ----------
create table plan_clase (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  docente_id uuid not null references perfil(id),
  materia_id uuid references materia(id),
  titulo text not null,
  contenido jsonb,
  compartido boolean default false,      -- visible a otros docentes/director
  creado_en timestamptz not null default now()
);

-- ---------- Noticias ----------
create table noticia (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid references colegio(id) on delete cascade,  -- null = fuente global
  fuente text not null,        -- 'colegio' | 'MINEDUC' | 'municipalidad' | ...
  titulo text not null,
  resumen text,
  cuerpo text,
  alcance text default 'colegio', -- 'colegio' | 'grado' | 'seccion'
  alcance_ref uuid,
  prioridad int default 0,
  publicado_en timestamptz not null default now(),
  expira_en timestamptz default (now() + interval '45 days')  -- auto-limpieza
);
-- Limpieza automática gratis (pg_cron). Ejecutar una vez para programar:
--   select cron.schedule('purga_noticias','0 3 * * *',
--     $$ delete from noticia where expira_en is not null and expira_en < now() $$);

-- ---------- Cobros ----------
create table cuota (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  concepto text not null,
  monto numeric(10,2) not null,
  vence date,
  estado pago_estado not null default 'pendiente'
);
create table pago (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  cuota_id uuid not null references cuota(id) on delete cascade,
  metodo text,                 -- 'tarjeta' | 'referencia' | 'efectivo'
  referencia text,             -- No. de boleta (texto, sin imagen)
  monto numeric(10,2) not null,
  estado pago_estado not null default 'en_revision',
  aprobado_por uuid references perfil(id),
  creado_en timestamptz not null default now()
);

-- ---------- Planilla / pagos al personal (el dinero se mueve por el banco) ----------
create table empleado (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  perfil_id uuid references perfil(id) on delete set null,
  nombre text not null,
  puesto text,
  salario_base numeric(10,2) not null default 0
);
create table planilla_periodo (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  mes date not null,
  estado text not null default 'abierta'   -- 'abierta' | 'cerrada'
);
create table asistencia_personal (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  empleado_id uuid not null references empleado(id) on delete cascade,
  fecha date not null,
  estado text not null,        -- presente|ausente|tardanza|permiso|vacaciones|incapacidad
  hora_entrada timestamptz,    -- marcaje de entrada
  hora_salida timestamptz,     -- marcaje de salida
  metodo text default 'manual',-- manual|qr|codigo
  justificacion text
);
-- Acuse firmado de pago recibido (constancia de nómina)
create table acuse_pago_personal (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pago_personal_id uuid not null references pago_personal(id) on delete cascade,
  firmado boolean default false,
  firmado_en timestamptz
);
create table pago_personal (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  empleado_id uuid not null references empleado(id) on delete cascade,
  periodo_id uuid not null references planilla_periodo(id) on delete cascade,
  bruto numeric(10,2) not null,
  descuentos jsonb,              -- {igss, isr, otros}
  neto numeric(10,2) not null,
  estado pago_estado not null default 'pendiente',
  pagado_en timestamptz
);

-- ---------- Gamificación ----------
create table xp_evento (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  tipo text not null,          -- 'tarea' | 'asistencia' | 'material' | 'meta'
  puntos int not null,
  creado_en timestamptz not null default now()
);
create table racha (
  estudiante_id uuid primary key references estudiante(id) on delete cascade,
  colegio_id uuid not null references colegio(id) on delete cascade,
  dias int not null default 0,
  ultima_fecha date
);
create table logro (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  clave text not null,
  obtenido_en timestamptz not null default now()
);

-- ---------- Auditoría ----------
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

-- ---------- Calendario editable ----------
create table evento_calendario (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  titulo text not null,
  fecha_ini timestamptz not null,
  fecha_fin timestamptz,
  color text default '#e07b00',
  categoria text,
  alcance text default 'colegio',   -- 'personal'|'seccion'|'grado'|'colegio'
  alcance_ref uuid,
  creado_por uuid references perfil(id)
);

-- ---------- Extras de cobros ----------
create table recibo (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pago_id uuid not null references pago(id) on delete cascade,
  correlativo text not null
);
create table convenio_pago (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  total numeric(10,2) not null,
  cuotas jsonb,
  estado text default 'activo'
);
create table descuento (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid references estudiante(id) on delete cascade,
  tipo text not null,               -- 'hermanos'|'pronto_pago'|'beca'
  valor numeric(10,2) not null,
  es_porcentaje boolean default true
);

-- ---------- Módulos adicionales ----------
create table solicitud_admision (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  datos jsonb not null,             -- nombre, grado deseado, contacto, etc.
  estado text default 'nuevo',      -- nuevo|contactado|aceptado|inscrito|rechazado
  origen text,
  creado_en timestamptz not null default now()
);
create table conducta (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  tipo text not null,               -- 'positiva'|'negativa'
  descripcion text,
  registrado_por uuid references perfil(id),
  fecha date not null default current_date
);
create table evento (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  titulo text not null,
  fecha timestamptz,
  cupo int,
  costo numeric(10,2) default 0
);
create table inscripcion_evento (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  evento_id uuid not null references evento(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  estado text default 'inscrito'
);
create table encuesta (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pregunta text not null,
  opciones jsonb not null,
  alcance text default 'colegio',
  creado_en timestamptz not null default now()
);
create table respuesta_encuesta (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  encuesta_id uuid not null references encuesta(id) on delete cascade,
  autor_id uuid references perfil(id),
  opcion text not null
);

-- ---------- Suscripciones Web Push ----------
create table push_sub (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid references colegio(id) on delete cascade,
  user_id uuid not null references perfil(id) on delete cascade,
  sub jsonb not null,
  creado_en timestamptz not null default now()
);

-- ============================================================================
-- RLS — activar en TODAS las tablas y aislar por colegio
-- ============================================================================
-- Patrón general (repetir por tabla que tenga colegio_id):
--   alter table X enable row level security;
--   create policy X_tenant on X using (colegio_id = auth_colegio_id());
-- Luego afinar con políticas por rol/acción. Ejemplos abajo.

alter table colegio enable row level security;
create policy colegio_self on colegio
  using (id = auth_colegio_id());

alter table perfil enable row level security;
create policy perfil_tenant on perfil
  using (colegio_id = auth_colegio_id());
create policy perfil_self_update on perfil
  for update using (id = auth.uid());

-- Ejemplo tablas con tenant simple:
do $$
declare t text;
begin
  foreach t in array array[
    'grado','seccion','materia','asignacion_docente','estudiante','parentesco',
    'invitacion','asistencia','calificacion','tarea','entrega','agenda_pagina',
    'agenda_respuesta','plan_clase','cuota','pago','xp_evento','racha','logro','auditoria',
    'empleado','planilla_periodo','pago_personal','asistencia_personal','acuse_pago_personal','evento_calendario','recibo',
    'convenio_pago','descuento','solicitud_admision','conducta','evento',
    'inscripcion_evento','encuesta','respuesta_encuesta','push_sub'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('create policy %I_tenant on %I using (colegio_id = auth_colegio_id());', t, t);
  end loop;
end $$;

-- Noticias: del colegio o globales
alter table noticia enable row level security;
create policy noticia_read on noticia
  for select using (colegio_id is null or colegio_id = auth_colegio_id());
create policy noticia_write on noticia
  for all using (colegio_id = auth_colegio_id() and auth_rol() = 'director');

-- ----------------------------------------------------------------------------
-- Afinamientos por rol (ejemplos — ampliar):
--  * Docente edita notas/asistencia solo de sus secciones (via asignacion_docente).
--  * Padre lee datos solo de sus hijos (via parentesco).
--  * Estudiante lee solo lo propio.
--  * Aprobación de pagos y otorgamiento de XP: mediante Edge Function / RPC
--    'security definer', nunca por escritura directa del cliente.
-- ----------------------------------------------------------------------------

-- Ejemplo: docente solo escribe calificaciones de secciones asignadas
create policy calificacion_docente_write on calificacion
  for insert with check (
    auth_rol() = 'docente'
    and exists (
      select 1 from asignacion_docente ad
      join estudiante e on e.seccion_id = ad.seccion_id
      where ad.docente_id = auth.uid()
        and e.id = calificacion.estudiante_id
        and ad.materia_id = calificacion.materia_id
    )
  );

-- Ejemplo: padre lee calificaciones de sus hijos
create policy calificacion_padre_read on calificacion
  for select using (
    auth_rol() = 'padre'
    and exists (
      select 1 from parentesco p
      where p.padre_id = auth.uid()
        and p.estudiante_id = calificacion.estudiante_id
    )
  );

-- NOTA: las políticas de arriba conviven con la policy _tenant. En producción,
-- define el conjunto completo por tabla y rol, y prueba cada caso (director,
-- docente, padre, estudiante) para confirmar el aislamiento.

-- ============================================================================
-- VISTAS DE AGREGACIÓN para gráficos (datos REALES, no simulados)
-- Heredan RLS de las tablas base. Usar en los dashboards de los 4 roles.
-- ============================================================================
create view v_asistencia_diaria as
select colegio_id, fecha,
       count(*) filter (where estado='presente')::float / nullif(count(*),0) as pct_presente,
       count(*) as total
from asistencia group by colegio_id, fecha;

create view v_cobros_diarios as
select colegio_id, date(creado_en) as dia, sum(monto) as total
from pago where estado='pagado' group by colegio_id, date(creado_en);

create view v_promedio_materia as
select colegio_id, materia_id, round(avg(nota),2) as promedio, count(*) as evaluaciones
from calificacion group by colegio_id, materia_id;

-- Cartera vencida por antigüedad (morosidad del director)
create view v_cartera_vencida as
select colegio_id, estudiante_id, sum(monto) as saldo,
       max(current_date - vence) as dias_atraso
from cuota where estado in ('pendiente','en_revision') and vence < current_date
group by colegio_id, estudiante_id;
