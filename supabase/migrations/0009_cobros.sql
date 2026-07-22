-- ============================================================================
-- SmartPath — Migración 0009: Cobros (Paso 9, §8, §33)
-- Cuotas del estudiante y pagos por referencia. Regla anti-fraude: nada se marca
-- 'pagado' hasta que el DIRECTOR lo aprueba contra el banco (Edge Function).
-- Estados de cuota: pendiente → en_revision → pagado / rechazado.
-- El padre puede REGISTRAR una referencia (crea pago en_revision) pero NO puede
-- marcar pagado: eso solo ocurre en el servidor.
-- ============================================================================

create type cobro_estado as enum ('pendiente','en_revision','pagado','rechazado');

create table cuota (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  estudiante_id uuid not null references estudiante(id) on delete cascade,
  concepto text not null,
  monto numeric(10,2) not null check (monto >= 0),
  vence date,
  estado cobro_estado not null default 'pendiente',
  creado_en timestamptz not null default now()
);
create index idx_cuota_colegio on cuota (colegio_id);
create index idx_cuota_estudiante on cuota (estudiante_id);
create index idx_cuota_estado on cuota (colegio_id, estado);

create table pago (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  cuota_id uuid not null references cuota(id) on delete cascade,
  metodo text not null default 'referencia',    -- 'referencia' | 'efectivo'
  referencia text,                               -- No. de boleta (texto, sin imagen)
  monto numeric(10,2) not null check (monto >= 0),
  estado cobro_estado not null default 'en_revision',
  registrado_por uuid references perfil(id),
  aprobado_por uuid references perfil(id),
  motivo_rechazo text,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);
create index idx_pago_colegio_estado on pago (colegio_id, estado);
create index idx_pago_cuota on pago (cuota_id);

create table recibo (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegio(id) on delete cascade,
  pago_id uuid not null references pago(id) on delete cascade,
  correlativo text not null,
  emitido_en timestamptz not null default now(),
  unique (colegio_id, correlativo)
);

-- ---------- RLS ----------
-- cuota: director CRUD; padre lee las de sus hijos; estudiante las propias
alter table cuota enable row level security;
create policy cuota_select on cuota for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (es_director() or es_padre_de(estudiante_id) or estudiante_id = mi_estudiante_id())
  );
create policy cuota_write_director on cuota for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

-- pago: director lee todo; padre lee/registra los de sus hijos.
-- El padre SOLO puede insertar pagos en_revision (registro de referencia). La
-- aprobación (estado='pagado') ocurre en la Edge Function con service_role.
alter table pago enable row level security;
create policy pago_select on pago for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or exists (
        select 1 from cuota c
        where c.id = pago.cuota_id
          and (es_padre_de(c.estudiante_id) or c.estudiante_id = mi_estudiante_id())
      )
    )
  );
create policy pago_insert_padre on pago for insert to authenticated
  with check (
    colegio_id = auth_colegio_id()
    and estado = 'en_revision'
    and metodo = 'referencia'
    and registrado_por = auth.uid()
    and exists (
      select 1 from cuota c
      where c.id = pago.cuota_id and es_padre_de(c.estudiante_id)
    )
  );
-- director puede escribir/corregir pagos directamente (además de la Edge Function)
create policy pago_write_director on pago for all to authenticated
  using (colegio_id = auth_colegio_id() and es_director())
  with check (colegio_id = auth_colegio_id() and es_director());

-- recibo: lo lee el director y la familia; lo crea el servidor
alter table recibo enable row level security;
create policy recibo_select on recibo for select to authenticated
  using (
    colegio_id = auth_colegio_id()
    and (
      es_director()
      or exists (
        select 1 from pago p join cuota c on c.id = p.cuota_id
        where p.id = recibo.pago_id
          and (es_padre_de(c.estudiante_id) or c.estudiante_id = mi_estudiante_id())
      )
    )
  );

-- Realtime: la bandeja del director y el estado del padre se actualizan solos
alter publication supabase_realtime add table cuota, pago;

-- Vista: estado de cuenta por estudiante (saldo pendiente real)
create view v_estado_cuenta
with (security_invoker = true) as
select
  c.colegio_id,
  c.estudiante_id,
  sum(c.monto) filter (where c.estado <> 'pagado') as saldo_pendiente,
  sum(c.monto) filter (where c.estado = 'pagado') as pagado,
  count(*) filter (where c.estado <> 'pagado' and c.vence < current_date) as cuotas_vencidas
from cuota c
group by c.colegio_id, c.estudiante_id;
