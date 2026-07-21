import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { useRealtimeAcademico } from '../../features/realtime/useRealtimeAcademico'

interface DiaAsistencia {
  fecha: string
  pct_presente: number | null
  presentes: number
  total: number
}
interface PromMateria {
  materia_id: string
  promedio: number
  evaluaciones: number
  materia?: string
}

function colorHeatmap(pct: number | null): string {
  if (pct === null) return '#e8e0d4'
  if (pct >= 0.95) return '#16a34a'
  if (pct >= 0.85) return '#5cd08a'
  if (pct >= 0.7) return '#f7a927'
  return '#dc2626'
}

// Académico del director (§42): heatmap de asistencia (30 días) y rendimiento
// por materia — SIEMPRE desde vistas de agregación reales.
export function AcademicoPage() {
  useRealtimeAcademico(['dir-asistencia-30', 'dir-promedios'])

  const { data: dias } = useQuery({
    queryKey: ['dir-asistencia-30'],
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('v_asistencia_diaria')
        .select('fecha, pct_presente, presentes, total')
        .gte('fecha', desde)
        .order('fecha')
      return (data ?? []) as DiaAsistencia[]
    },
  })

  const { data: promedios } = useQuery({
    queryKey: ['dir-promedios'],
    queryFn: async () => {
      const [p, m] = await Promise.all([
        supabase.from('v_promedio_materia').select('materia_id, promedio, evaluaciones'),
        supabase.from('materia').select('id, nombre'),
      ])
      const nombres = new Map((m.data ?? []).map((x) => [x.id, x.nombre]))
      return ((p.data ?? []) as PromMateria[]).map((x) => ({
        ...x,
        materia: nombres.get(x.materia_id) ?? 'Materia',
      }))
    },
  })

  return (
    <>
      <EncabezadoPagina
        titulo={<>Pulso <em className="text-amber-d italic">académico</em></>}
        sub="Asistencia y rendimiento del colegio, con datos reales."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">
            Asistencia · últimos 30 días
          </div>
          {(dias ?? []).length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay asistencia registrada"
              texto="Cuando los docentes pasen lista, este mapa de calor mostrará el pulso diario del colegio."
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(dias ?? []).map((d) => (
                  <div
                    key={d.fecha}
                    title={`${new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}: ${Math.round((d.pct_presente ?? 0) * 100)}% (${d.presentes}/${d.total})`}
                    className="h-8 w-8 rounded-md"
                    style={{ background: colorHeatmap(d.pct_presente) }}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 font-mono text-[10px] text-muted-2 uppercase">
                <span>Menos</span>
                {['#dc2626', '#f7a927', '#5cd08a', '#16a34a'].map((c) => (
                  <span key={c} className="h-3 w-3 rounded-sm" style={{ background: c }} />
                ))}
                <span>Más presencia</span>
              </div>
            </>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">
            Promedio por materia
          </div>
          {(promedios ?? []).length === 0 ? (
            <p className="text-sm text-muted">Aún no hay calificaciones.</p>
          ) : (
            <ul className="space-y-3">
              {(promedios ?? []).map((p) => (
                <li key={p.materia_id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{p.materia}</span>
                    <span className="shrink-0 font-mono font-bold">{Number(p.promedio).toFixed(1)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-cream-2">
                    <div
                      className={`h-full rounded-full ${Number(p.promedio) >= 60 ? 'bg-exito' : 'bg-alerta'}`}
                      style={{ width: `${Math.min(100, Number(p.promedio))}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-2">{p.evaluaciones} evaluación(es)</div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
