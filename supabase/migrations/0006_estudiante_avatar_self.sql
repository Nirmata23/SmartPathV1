-- El estudiante puede actualizar SU registro, pero un trigger limita el cambio
-- exclusivamente a los campos de avatar (avatar_seed, avatar_pixel).
create policy estudiante_update_self on estudiante
  for update to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

create or replace function proteger_estudiante_campos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((current_setting('request.jwt.claims', true))::jsonb->>'role','') = 'authenticated'
     and not es_director()
     and (
       new.nombre is distinct from old.nombre
       or new.colegio_id is distinct from old.colegio_id
       or new.seccion_id is distinct from old.seccion_id
       or new.perfil_id is distinct from old.perfil_id
       or new.carne is distinct from old.carne
     )
  then
    raise exception 'Solo puedes cambiar tu avatar';
  end if;
  return new;
end $$;
revoke execute on function proteger_estudiante_campos() from public, anon, authenticated;

create trigger trg_proteger_estudiante before update on estudiante
  for each row execute function proteger_estudiante_campos();
