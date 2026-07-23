-- ============================================================================
-- SmartPath — Migración 0011: Agenda Escolar (Paso 7, §6, §25)
-- Libreta digital que crea el docente para su sección. El dibujo se guarda como
-- trazos vectoriales (JSON compacto), NO como imagen: unos pocos KB por página.
-- Las quejas/observaciones son privadas: visibles solo para el padre del alumno.
-- ============================================================================

create table agenda_pagina (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  seccion_id uuid not null references seccion(id) on delete cascade,
  autor_id uuid not null references perfil(id),         -- docente
  fecha date not null default current_date,
  titulo text not null,
  tipo text not null default 'nota',                    -- 'material'|'tarea'|'nota'|'queja'
  contenido text,
  dibujo jsonb,                                         -- [{color,grosor,puntos:[[x,y],...]}]
  estudiante_id uuid references estudiante(id) on delete cascade,  -- queja privada
  creado_en timestamptz not null default now()
);
create index idx_agenda_seccion_fecha on agenda_pagina (seccion_id, fecha desc);
create index idx_agenda_colegio on agenda_pagina (colegio_id);

create table agenda_respuesta (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pagina_id uuid not null references agenda_pagina(id) on delete cascade,
  autor_id uuid not null references perfil(id),
  contenido text,
  firmado boolean not null default false,
  creado_en timestamptz not null default now()
);
create index idx_agenda_resp_pagina on agenda_respuesta (pagina_id);

-- ---------- RLS ----------
-- Lectura de páginas: director; docente de la sección; padre/estudiante de la
-- sección. PERO una página tipo 'queja' con estudiante_id solo la ven el docente
-- autor, el director y el padre de ESE estudiante (privacidad, §6).
alter table agenda_pagina enable row level security;
create policy agenda_select on agenda_pagina for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      case
        when estudiante_id is not null then
          es_director() or autor_id = auth.uid() or es_padre_de(estudiante_id) or estudiante_id = mi_estudiante_id()
        else
          es_director()
          or es_docente_de_seccion(seccion_id)
          or es_padre_en_seccion(seccion_id)
          or seccion_id = mi_seccion_id()
      end
    )
  );
create policy agenda_write_docente on agenda_pagina for all to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id) and autor_id = auth.uid())
  with check (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id) and autor_id = auth.uid());

-- Respuestas: puede responder/firmar quien puede ver la página. El autor de la
-- respuesta es siempre uno mismo. Lectura por las mismas partes de la página.
alter table agenda_respuesta enable row level security;
create policy agenda_resp_select on agenda_respuesta for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and exists (select 1 from agenda_pagina p where p.id = agenda_respuesta.pagina_id)
  );
create policy agenda_resp_insert on agenda_respuesta for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and autor_id = auth.uid()
    and exists (select 1 from agenda_pagina p where p.id = agenda_respuesta.pagina_id)
  );

-- Realtime: el padre ve la nota nueva del docente al instante
alter publication supabase_realtime add table agenda_pagina, agenda_respuesta;
