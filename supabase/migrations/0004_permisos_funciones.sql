-- SmartPath — Migración 0004: cerrar EXECUTE de funciones security definer
-- Los helpers de RLS solo los evalúa el rol authenticated (dentro de políticas).
-- Las funciones de trigger no deben ser llamables por ningún cliente.

-- Trigger functions: nadie las llama por RPC
revoke execute on function proteger_perfil_campos() from public, anon, authenticated;
revoke execute on function auditar_calificacion() from public, anon, authenticated;

-- Helpers de RLS: fuera de anon/public; authenticated los necesita para las políticas
revoke execute on function auth_colegio_id() from public, anon;
revoke execute on function auth_rol() from public, anon;
revoke execute on function es_director() from public, anon;
revoke execute on function es_docente_de_seccion(uuid) from public, anon;
revoke execute on function es_docente_de_estudiante(uuid, uuid) from public, anon;
revoke execute on function es_padre_de(uuid) from public, anon;
revoke execute on function es_padre_en_seccion(uuid) from public, anon;
revoke execute on function mi_estudiante_id() from public, anon;
revoke execute on function mi_seccion_id() from public, anon;
