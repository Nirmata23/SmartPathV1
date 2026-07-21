-- ============================================================================
-- SmartPath — Migración 0002: RLS en TODAS las tablas
-- Deny-by-default. Cada política exige (a) mismo colegio_id y (b) el rol/vínculo
-- correcto según la matriz de permisos (§3 de la especificación).
-- Escrituras sensibles (crear colegio/perfil, canjear invitación) NO tienen
-- política de cliente: solo ocurren vía Edge Functions con service_role.
-- ============================================================================

-- Helpers adicionales (security definer: evitan recursión de políticas)
create or replace function mi_seccion_id() returns uuid
language sql stable security definer set search_path = public as $$
  select seccion_id from estudiante where perfil_id = auth.uid()
$$;

create or replace function es_padre_en_seccion(p_seccion uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from parentesco p
    join estudiante e on e.id = p.estudiante_id
    where p.padre_id = auth.uid() and e.seccion_id = p_seccion
  )
$$;

create or replace function es_director() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfil where id = auth.uid() and rol = 'director'
  )
$$;

-- ---------- colegio ----------
alter table colegio enable row level security;
create policy colegio_select on colegio for select to authenticated
  using (id = auth_colegio_id());
create policy colegio_update_director on colegio for update to authenticated
  using (id = auth_colegio_id() and es_director())
  with check (id = auth_colegio_id());
-- sin insert/delete desde el cliente: crear-colegio es una Edge Function

-- ---------- perfil ----------
alter table perfil enable row level security;
create policy perfil_select on perfil for select to authenticated
  using (id = auth.uid() or colegio_id = auth_colegio_id());
create policy perfil_update_self on perfil for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- rol/colegio_id protegidos por trigger; alta de perfiles solo en servidor

-- ---------- estructura académica (lectura: colegio; escritura: director) ----------
alter table grado enable row level security;
create policy grado_select on grado for select to authenticated
  using (colegio_id = auth_colegio_id());
create policy grado_write on grado for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

alter table seccion enable row level security;
create policy seccion_select on seccion for select to authenticated
  using (colegio_id = auth_colegio_id());
create policy seccion_write on seccion for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

alter table materia enable row level security;
create policy materia_select on materia for select to authenticated
  using (colegio_id = auth_colegio_id());
create policy materia_write on materia for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

alter table asignacion_docente enable row level security;
create policy asigdoc_select on asignacion_docente for select to authenticated
  using (colegio_id = auth_colegio_id());
create policy asigdoc_write on asignacion_docente for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

-- ---------- estudiante ----------
alter table estudiante enable row level security;
create policy estudiante_select on estudiante for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_seccion(seccion_id)
      or es_padre_de(id)
      or perfil_id = auth.uid()
    )
  );
create policy estudiante_write_director on estudiante for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

-- ---------- parentesco ----------
alter table parentesco enable row level security;
create policy parentesco_select on parentesco for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (es_director() or padre_id = auth.uid())
  );
create policy parentesco_write_director on parentesco for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

-- ---------- invitacion (solo director; el canje ocurre en servidor) ----------
alter table invitacion enable row level security;
create policy invitacion_director on invitacion for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

-- ---------- asistencia ----------
alter table asistencia enable row level security;
create policy asistencia_select on asistencia for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_seccion(seccion_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );
create policy asistencia_insert_docente on asistencia for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and es_docente_de_seccion(seccion_id)
    and registrado_por = auth.uid()
  );
create policy asistencia_update_docente on asistencia for update to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id))
  with check (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id));
create policy asistencia_delete_docente on asistencia for delete to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id));

-- ---------- calificacion ----------
alter table calificacion enable row level security;
create policy calificacion_select on calificacion for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );
create policy calificacion_insert_docente on calificacion for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and es_docente_de_estudiante(estudiante_id, materia_id)
    and registrado_por = auth.uid()
  );
create policy calificacion_update_docente on calificacion for update to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_estudiante(estudiante_id, materia_id))
  with check (colegio_id = auth_colegio_id() and es_docente_de_estudiante(estudiante_id, materia_id));
create policy calificacion_delete_docente on calificacion for delete to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_estudiante(estudiante_id, materia_id));

-- ---------- tarea ----------
alter table tarea enable row level security;
create policy tarea_select on tarea for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_seccion(seccion_id)
      or es_padre_en_seccion(seccion_id)
      or seccion_id = mi_seccion_id()
    )
  );
create policy tarea_insert_docente on tarea for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and es_docente_de_seccion(seccion_id)
    and creado_por = auth.uid()
  );
create policy tarea_update_docente on tarea for update to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id))
  with check (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id));
create policy tarea_delete_docente on tarea for delete to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_seccion(seccion_id));

-- ---------- entrega ----------
alter table entrega enable row level security;
create policy entrega_select on entrega for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or es_docente_de_estudiante(estudiante_id)
      or es_padre_de(estudiante_id)
      or estudiante_id = mi_estudiante_id()
    )
  );
create policy entrega_write_docente on entrega for all to authenticated
  using (colegio_id = auth_colegio_id() and es_docente_de_estudiante(estudiante_id))
  with check (colegio_id = auth_colegio_id() and es_docente_de_estudiante(estudiante_id));

-- ---------- auditoria (lee el director; escribe solo el servidor via triggers) ----------
alter table auditoria enable row level security;
create policy auditoria_select_director on auditoria for select to authenticated
  using (colegio_id = auth_colegio_id() and es_director());
-- sin políticas de escritura: los triggers (security definer) son los únicos que insertan
