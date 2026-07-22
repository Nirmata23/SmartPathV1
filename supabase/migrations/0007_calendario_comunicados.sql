-- ============================================================================
-- SmartPath — Migración 0007: Paso 5 (calendario) y Paso 6 (comunicados)
-- ============================================================================

-- ---------- Calendario editable con colores (§24) ----------
create table evento_calendario (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  titulo text not null,
  fecha_ini timestamptz not null,
  fecha_fin timestamptz,
  color text not null default '#e07b00',
  categoria text,                    -- 'examen' | 'entrega' | 'reunion' | 'feriado' | 'actividad'
  alcance text not null default 'colegio' check (alcance in ('personal','seccion','colegio')),
  alcance_ref uuid,                  -- seccion_id cuando alcance='seccion'
  creado_por uuid references perfil(id),
  creado_en timestamptz not null default now()
);
create index idx_evento_colegio_fecha on evento_calendario (colegio_id, fecha_ini);
create index idx_evento_creador on evento_calendario (creado_por);

alter table evento_calendario enable row level security;
create policy evento_select on evento_calendario for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      alcance = 'colegio'
      or (alcance = 'personal' and creado_por = auth.uid())
      or (
        alcance = 'seccion'
        and (
          es_director()
          or es_docente_de_seccion(alcance_ref)
          or es_padre_en_seccion(alcance_ref)
          or alcance_ref = mi_seccion_id()
        )
      )
    )
  );
-- director: cualquier evento; docente: colegio no, sus secciones y personales sí;
-- padre/estudiante: solo eventos personales
create policy evento_write on evento_calendario for all to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or (creado_por = auth.uid() and alcance = 'personal')
      or (creado_por = auth.uid() and alcance = 'seccion' and es_docente_de_seccion(alcance_ref))
    )
  )
  with check (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or (creado_por = auth.uid() and alcance = 'personal')
      or (creado_por = auth.uid() and alcance = 'seccion' and es_docente_de_seccion(alcance_ref))
    )
  );

-- ---------- Comunicados / noticias con expiración (§5, §28) ----------
create table noticia (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid references colegio(id) on delete cascade,  -- null = fuente global
  fuente text not null default 'colegio',
  titulo text not null,
  resumen text,
  cuerpo text,
  alcance text not null default 'colegio' check (alcance in ('colegio','seccion')),
  alcance_ref uuid,                  -- seccion_id cuando alcance='seccion'
  prioridad int not null default 0,  -- 1 = urgente
  publicado_por uuid references perfil(id),
  publicado_en timestamptz not null default now(),
  expira_en timestamptz default (now() + interval '45 days')
);
create index idx_noticia_colegio on noticia (colegio_id, publicado_en desc);

alter table noticia enable row level security;
create policy noticia_select on noticia for select to authenticated
  using (
    (colegio_id is null or colegio_id = auth_colegio_id())
    and (expira_en is null or expira_en > now())
    and (
      alcance = 'colegio'
      or (
        alcance = 'seccion'
        and (
          es_director()
          or es_docente_de_seccion(alcance_ref)
          or es_padre_en_seccion(alcance_ref)
          or alcance_ref = mi_seccion_id()
        )
      )
    )
  );
-- director publica a todo el colegio o a una sección; docente solo a SUS secciones (§3)
create policy noticia_write on noticia for all to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (es_director() or (publicado_por = auth.uid() and alcance = 'seccion' and es_docente_de_seccion(alcance_ref)))
  )
  with check (
    colegio_id = auth_colegio_id()
    and (es_director() or (publicado_por = auth.uid() and alcance = 'seccion' and es_docente_de_seccion(alcance_ref)))
  );

-- ---------- Acuse de lectura (§10: circulares con acuse) ----------
create table acuse_lectura (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  noticia_id uuid not null references noticia(id) on delete cascade,
  perfil_id uuid not null references perfil(id) on delete cascade,
  leido_en timestamptz not null default now(),
  unique (noticia_id, perfil_id)
);
create index idx_acuse_noticia on acuse_lectura (noticia_id);
create index idx_acuse_colegio on acuse_lectura (colegio_id);

alter table acuse_lectura enable row level security;
create policy acuse_select on acuse_lectura for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (es_director() or perfil_id = auth.uid())
  );
create policy acuse_insert_self on acuse_lectura for insert to authenticated
  with check (colegio_id = auth_colegio_id() and perfil_id = auth.uid());

-- ---------- Purga automática de noticias vencidas (gratis, pg_cron) ----------
create extension if not exists pg_cron;
select cron.schedule(
  'purga_noticias',
  '0 3 * * *',
  $$ delete from noticia where expira_en is not null and expira_en < now() - interval '7 days' $$
);

-- Realtime para comunicados (respeta RLS)
alter publication supabase_realtime add table noticia;
