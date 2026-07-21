-- ============================================================================
-- SmartPath — Prueba de RLS con los 4 roles y 2 colegios
-- Ejecutar como postgres (dueño). Crea datos de prueba, simula el JWT de cada
-- rol con set_config('request.jwt.claims'), verifica accesos y limpia todo.
-- Resultado esperado: todas las filas en 'OK'. Ver limpieza al final.
-- ============================================================================

-- ---------- infraestructura de resultados ----------
create table if not exists _rls_resultados (orden serial, prueba text, resultado text);
grant insert, select on _rls_resultados to authenticated;
grant usage on sequence _rls_resultados_orden_seq to authenticated;
create or replace function _chk(nombre text, cond boolean) returns void
language sql as $$
  insert into _rls_resultados (prueba, resultado)
  values (nombre, case when cond then 'OK' else 'FALLO' end)
$$;
grant execute on function _chk(text, boolean) to authenticated;

-- ---------- datos de prueba (como postgres, sin RLS) ----------
insert into colegio (id, nombre) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Colegio A'),
  ('bbbbbbbb-0000-0000-0000-000000000001','Colegio B');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('Prueba123!', gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}', '{}'
from (values
  ('11111111-0000-0000-0000-000000000001'::uuid,'dira@test.local'),
  ('11111111-0000-0000-0000-000000000002'::uuid,'doca@test.local'),
  ('11111111-0000-0000-0000-000000000003'::uuid,'pada@test.local'),
  ('11111111-0000-0000-0000-000000000004'::uuid,'esta@test.local'),
  ('11111111-0000-0000-0000-000000000005'::uuid,'dirb@test.local')
) as u(id,email);

insert into perfil (id, colegio_id, rol, nombre) values
  ('11111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','director','Directora A'),
  ('11111111-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','docente','Docente A'),
  ('11111111-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','padre','Padre A'),
  ('11111111-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001','estudiante','Estudiante A'),
  ('11111111-0000-0000-0000-000000000005','bbbbbbbb-0000-0000-0000-000000000001','director','Director B');

insert into grado (id, colegio_id, nombre) values
  ('22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Primero'),
  ('22222222-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','Primero');
insert into seccion (id, colegio_id, grado_id, nombre) values
  ('33333333-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','S1'),
  ('33333333-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','S2'),
  ('33333333-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','S1B');
insert into materia (id, colegio_id, nombre) values
  ('44444444-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Matemática'),
  ('44444444-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Lenguaje');
-- docente A: asignado SOLO a S1 / Matemática
insert into asignacion_docente (colegio_id, docente_id, seccion_id, materia_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001');

insert into estudiante (id, colegio_id, perfil_id, nombre, seccion_id) values
  ('55555555-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000004','Est E1 (S1)','33333333-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',null,'Est E2 (S2)','33333333-0000-0000-0000-000000000002'),
  ('55555555-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000001',null,'Est E3 (B)','33333333-0000-0000-0000-000000000003');
-- padre A es tutor SOLO de E1
insert into parentesco (colegio_id, padre_id, estudiante_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000001');

insert into asistencia (colegio_id, estudiante_id, seccion_id, fecha, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',current_date - 1,'presente'),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000002',current_date - 1,'ausente'),
  ('bbbbbbbb-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000003',current_date - 1,'presente');
insert into calificacion (colegio_id, estudiante_id, materia_id, actividad, nota) values
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','Examen 1',85),
  ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002','44444444-0000-0000-0000-000000000001','Examen 1',70);
insert into tarea (colegio_id, seccion_id, materia_id, titulo, creado_por) values
  ('aaaaaaaa-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','Tarea S1','11111111-0000-0000-0000-000000000002');
insert into invitacion (colegio_id, codigo, rol) values
  ('aaaaaaaa-0000-0000-0000-000000000001','TEST-CODE-A','docente');

-- ---------- pruebas por rol (dentro de un solo bloque/transacción) ----------
do $$
declare
  n int;
begin
  execute 'set local role authenticated';

  -- ===== DIRECTOR A =====
  perform set_config('request.jwt.claims','{"sub":"11111111-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into n from colegio;      perform _chk('dirA ve solo su colegio', n = 1);
  select count(*) into n from estudiante;   perform _chk('dirA ve 2 estudiantes de A', n = 2);
  select count(*) into n from estudiante where id = '55555555-0000-0000-0000-000000000003';
                                            perform _chk('dirA NO ve estudiante de B ni por id', n = 0);
  select count(*) into n from asistencia;   perform _chk('dirA ve toda la asistencia de A', n = 2);
  select count(*) into n from calificacion; perform _chk('dirA ve todas las notas de A', n = 2);
  select count(*) into n from invitacion;   perform _chk('dirA ve sus invitaciones', n = 1);
  select count(*) into n from auditoria;    perform _chk('dirA puede leer auditoria', n >= 2);
  begin
    insert into grado (colegio_id, nombre) values ('bbbbbbbb-0000-0000-0000-000000000001','Intruso');
    perform _chk('dirA NO crea grado en colegio B', false);
  exception when others then perform _chk('dirA NO crea grado en colegio B', true); end;

  -- ===== DOCENTE A (solo S1/Matemática) =====
  perform set_config('request.jwt.claims','{"sub":"11111111-0000-0000-0000-000000000002","role":"authenticated"}',true);
  select count(*) into n from estudiante;   perform _chk('docA ve solo estudiantes de S1', n = 1);
  select count(*) into n from asistencia;   perform _chk('docA ve solo asistencia de S1', n = 1);
  select count(*) into n from calificacion; perform _chk('docA ve solo notas de S1', n = 1);
  select count(*) into n from invitacion;   perform _chk('docA NO ve invitaciones', n = 0);
  select count(*) into n from auditoria;    perform _chk('docA NO lee auditoria', n = 0);
  begin
    insert into asistencia (colegio_id, estudiante_id, seccion_id, fecha, estado, registrado_por)
    values ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',current_date,'presente','11111111-0000-0000-0000-000000000002');
    perform _chk('docA SI registra asistencia en S1', true);
  exception when others then perform _chk('docA SI registra asistencia en S1', false); end;
  begin
    insert into asistencia (colegio_id, estudiante_id, seccion_id, fecha, estado, registrado_por)
    values ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000002',current_date,'presente','11111111-0000-0000-0000-000000000002');
    perform _chk('docA NO registra asistencia en S2', false);
  exception when others then perform _chk('docA NO registra asistencia en S2', true); end;
  begin
    insert into calificacion (colegio_id, estudiante_id, materia_id, actividad, nota, registrado_por)
    values ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','Tarea 2',90,'11111111-0000-0000-0000-000000000002');
    perform _chk('docA SI califica su materia en S1', true);
  exception when others then perform _chk('docA SI califica su materia en S1', false); end;
  begin
    insert into calificacion (colegio_id, estudiante_id, materia_id, actividad, nota, registrado_por)
    values ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000002','Tarea 2',90,'11111111-0000-0000-0000-000000000002');
    perform _chk('docA NO califica materia no asignada', false);
  exception when others then perform _chk('docA NO califica materia no asignada', true); end;

  -- ===== PADRE A (tutor solo de E1) =====
  perform set_config('request.jwt.claims','{"sub":"11111111-0000-0000-0000-000000000003","role":"authenticated"}',true);
  select count(*) into n from estudiante;   perform _chk('padA ve solo a su hijo E1', n = 1);
  select count(*) into n from calificacion where estudiante_id <> '55555555-0000-0000-0000-000000000001';
                                            perform _chk('padA NO ve notas de otros', n = 0);
  select count(*) into n from asistencia where estudiante_id <> '55555555-0000-0000-0000-000000000001';
                                            perform _chk('padA NO ve asistencia de otros', n = 0);
  select count(*) into n from tarea;        perform _chk('padA ve tareas de la seccion de E1', n = 1);
  begin
    insert into calificacion (colegio_id, estudiante_id, materia_id, actividad, nota)
    values ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','Hack',100);
    perform _chk('padA NO puede escribir notas', false);
  exception when others then perform _chk('padA NO puede escribir notas', true); end;
  begin
    update perfil set rol = 'director' where id = '11111111-0000-0000-0000-000000000003';
    select count(*) into n from perfil where id = '11111111-0000-0000-0000-000000000003' and rol = 'padre';
    perform _chk('padA NO puede auto-promoverse a director', n = 1);
  exception when others then perform _chk('padA NO puede auto-promoverse a director', true); end;

  -- ===== ESTUDIANTE A (E1) =====
  perform set_config('request.jwt.claims','{"sub":"11111111-0000-0000-0000-000000000004","role":"authenticated"}',true);
  select count(*) into n from estudiante;   perform _chk('estA ve solo su registro', n = 1);
  select count(*) into n from calificacion where estudiante_id <> '55555555-0000-0000-0000-000000000001';
                                            perform _chk('estA NO ve notas ajenas', n = 0);
  select count(*) into n from tarea;        perform _chk('estA ve tareas de su seccion', n = 1);
  select count(*) into n from invitacion;   perform _chk('estA NO ve invitaciones', n = 0);
  begin
    insert into calificacion (colegio_id, estudiante_id, materia_id, actividad, nota)
    values ('aaaaaaaa-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001','44444444-0000-0000-0000-000000000001','Autonota',100);
    perform _chk('estA NO puede ponerse notas', false);
  exception when others then perform _chk('estA NO puede ponerse notas', true); end;

  -- ===== DIRECTOR B (aislamiento entre colegios) =====
  perform set_config('request.jwt.claims','{"sub":"11111111-0000-0000-0000-000000000005","role":"authenticated"}',true);
  select count(*) into n from estudiante;   perform _chk('dirB ve solo su estudiante', n = 1);
  select count(*) into n from calificacion; perform _chk('dirB NO ve notas de A', n = 0);
  select count(*) into n from invitacion;   perform _chk('dirB NO ve invitaciones de A', n = 0);
  select count(*) into n from perfil where colegio_id = 'aaaaaaaa-0000-0000-0000-000000000001';
                                            perform _chk('dirB NO ve perfiles de A', n = 0);
  select count(*) into n from v_asistencia_diaria where colegio_id = 'aaaaaaaa-0000-0000-0000-000000000001';
                                            perform _chk('vistas heredan RLS (dirB no ve agregados de A)', n = 0);
end $$;

select prueba, resultado from _rls_resultados order by orden;

-- ---------- LIMPIEZA (ejecutar después de revisar resultados) ----------
-- delete from colegio where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001');
-- delete from auth.users where email like '%@test.local';
-- drop function _chk(text, boolean);
-- drop table _rls_resultados;
