-- Fix: no auditar cuando el borrado viene de la eliminación del colegio
-- (el insert en auditoria violaría la FK porque el colegio ya no existe)
create or replace function auditar_calificacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from colegio c where c.id = coalesce(new.colegio_id, old.colegio_id)) then
    return coalesce(new, old);
  end if;
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
