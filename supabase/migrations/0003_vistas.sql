-- ============================================================================
-- SmartPath — Migración 0003: vistas de agregación para gráficos con datos REALES
-- security_invoker: las vistas se evalúan con los permisos del usuario que
-- consulta, por lo que heredan la RLS de las tablas base (nadie ve de más).
-- ============================================================================

-- Asistencia diaria (heatmap del director / anillos por rol)
create view v_asistencia_diaria
with (security_invoker = true) as
select colegio_id, fecha,
       count(*) filter (where estado = 'presente')::float / nullif(count(*), 0) as pct_presente,
       count(*) filter (where estado = 'presente') as presentes,
       count(*) filter (where estado = 'ausente')  as ausentes,
       count(*) filter (where estado = 'tardanza') as tardanzas,
       count(*) as total
from asistencia
group by colegio_id, fecha;

-- Asistencia diaria por sección (heatmap del docente)
create view v_asistencia_seccion_diaria
with (security_invoker = true) as
select colegio_id, seccion_id, fecha,
       count(*) filter (where estado = 'presente')::float / nullif(count(*), 0) as pct_presente,
       count(*) as total
from asistencia
group by colegio_id, seccion_id, fecha;

-- Promedio por materia (rendimiento)
create view v_promedio_materia
with (security_invoker = true) as
select colegio_id, materia_id,
       round(avg(nota), 2) as promedio,
       count(*) as evaluaciones
from calificacion
group by colegio_id, materia_id;

-- Promedio por estudiante y materia (vista del padre/estudiante)
create view v_promedio_estudiante_materia
with (security_invoker = true) as
select colegio_id, estudiante_id, materia_id,
       round(sum(nota * ponderacion) / nullif(sum(ponderacion), 0), 2) as promedio,
       count(*) as evaluaciones
from calificacion
group by colegio_id, estudiante_id, materia_id;
