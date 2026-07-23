-- ============================================================================
-- SmartPath — Migración 0014: Portal de admisiones (Extra, §35.2)
-- Formulario PÚBLICO para que familias nuevas soliciten inscripción. Entra a un
-- embudo para el director: nuevo → contactado → aceptado → inscrito / rechazado.
-- El registro se crea vía RPC pública (sin login) para no exponer INSERT directo.
-- ============================================================================

create table solicitud_admision (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  nombre_estudiante text not null,
  grado_deseado text,
  nombre_contacto text not null,
  telefono text,
  correo text,
  mensaje text,
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','aceptado','inscrito','rechazado')),
  origen text default 'portal',
  creado_en timestamptz not null default now()
);
create index idx_admision_colegio on solicitud_admision (colegio_id, estado);

alter table solicitud_admision enable row level security;

-- El director gestiona las solicitudes de su colegio.
create policy admision_select_director on solicitud_admision for select to authenticated
  using (colegio_id = auth_colegio_id() and es_director());
create policy admision_update_director on solicitud_admision for update to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());
create policy admision_delete_director on solicitud_admision for delete to authenticated
  using (colegio_id = auth_colegio_id() and es_director());
-- sin política de INSERT: el alta pública ocurre por RPC controlada (abajo)

-- Alta pública controlada: valida y limita, evita exponer INSERT crudo a anon.
create or replace function enviar_solicitud_admision(
  p_colegio uuid,
  p_nombre_estudiante text,
  p_grado text,
  p_nombre_contacto text,
  p_telefono text,
  p_correo text,
  p_mensaje text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from colegio where id = p_colegio) then
    raise exception 'Colegio no encontrado';
  end if;
  if length(trim(coalesce(p_nombre_estudiante,''))) < 3
     or length(trim(coalesce(p_nombre_contacto,''))) < 3 then
    raise exception 'Datos incompletos';
  end if;
  insert into solicitud_admision (colegio_id, nombre_estudiante, grado_deseado, nombre_contacto, telefono, correo, mensaje)
  values (p_colegio, left(trim(p_nombre_estudiante),120), left(coalesce(p_grado,''),60),
          left(trim(p_nombre_contacto),120), left(coalesce(p_telefono,''),30),
          left(coalesce(p_correo,''),120), left(coalesce(p_mensaje,''),500))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function enviar_solicitud_admision(uuid,text,text,text,text,text,text) to anon, authenticated;

-- Nombre del colegio para el portal público (sin exponer toda la tabla).
create or replace function nombre_colegio(p_colegio uuid) returns text
language sql stable security definer set search_path = public as $$
  select nombre from colegio where id = p_colegio
$$;
grant execute on function nombre_colegio(uuid) to anon, authenticated;
