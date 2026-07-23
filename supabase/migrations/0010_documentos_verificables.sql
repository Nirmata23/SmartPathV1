-- ============================================================================
-- SmartPath — Migración 0010: documentos verificables (Paso 11, §35)
-- Boletas de notas y constancias se generan al vuelo como PDF (no se almacena el
-- archivo). Se guarda SOLO un registro con un código público y un resumen de lo
-- certificado, para que cualquiera escanee el QR y confirme su legitimidad.
-- ============================================================================

create table documento_verificable (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  codigo text not null unique,            -- va en el QR (ej. SP-DOC-XXXXXXXX)
  tipo text not null,                     -- 'boleta' | 'solvencia' | 'constancia'
  estudiante_nombre text not null,
  colegio_nombre text not null,
  resumen jsonb not null,                 -- lo certificado (promedios, saldo, etc.)
  emitido_por uuid references perfil(id),
  emitido_en timestamptz not null default now()
);
create index idx_docver_colegio on documento_verificable (colegio_id);

alter table documento_verificable enable row level security;

-- Emisión: director y docente del colegio (dentro de su tenant)
create policy docver_insert on documento_verificable for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and emitido_por = auth.uid()
    and (es_director() or auth_rol() = 'docente')
  );
-- Lectura interna por miembros del colegio
create policy docver_select_tenant on documento_verificable for select to authenticated
  using (colegio_id = auth_colegio_id());

-- Verificación PÚBLICA por código exacto (sin login). Función security definer
-- que devuelve solo lo necesario para mostrar "documento legítimo".
create or replace function verificar_documento(p_codigo text)
returns table (
  tipo text,
  estudiante_nombre text,
  colegio_nombre text,
  resumen jsonb,
  emitido_en timestamptz
)
language sql stable security definer set search_path = public as $$
  select tipo, estudiante_nombre, colegio_nombre, resumen, emitido_en
  from documento_verificable
  where codigo = p_codigo
$$;
-- Cualquiera (incl. anónimo) puede verificar por código exacto; no lista nada.
grant execute on function verificar_documento(text) to anon, authenticated;
