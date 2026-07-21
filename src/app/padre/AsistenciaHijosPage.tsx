import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Chip } from '../../components/ui'
import { useRealtimeAcademico } from '../../features/realtime/useRealtimeAcademico'

const TONO: Record<string, 'exito' | 'alerta' | 'aviso' | 'info'> = {
  presente: 'exito',
  ausente: 'alerta',
  tardanza: 'aviso',
  justificado: 'info',
}

interface Fila {
  id: string
  fecha: string
  estado: string
  estudiante: { nombre: string } | null
}

// Asistencia de los hijos, últimos 30 días. Si el docente marca una falta,
// el padre la ve llegar en tiempo real (§27).
export function AsistenciaHijosPage() {
  useRealtimeAcademico(['padre-asistencia'])

  const { data, isLoading } = useQuery({
    queryKey: ['padre-asistencia'],
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('asistencia')
        .select('id, fecha, estado, estudiante:estudiante_id(nombre)')
        .gte('fecha', desde)
        .order('fecha', { ascending: false })
        .limit(120)
      return (data ?? []) as unknown as Fila[]
    },
  })

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Asistencia de tus <em className="text-amber-d italic">hijos</em></>}
        sub="Últimos 30 días. Si hay una ausencia, te enteras al instante."
      />
      <Tarjeta>
        {(data ?? []).length === 0 ? (
          <EstadoVacio
            titulo="Sin registros aún"
            texto="Cuando el docente pase lista verás aquí el día a día de tus hijos."
          />
        ) : (
          <ul className="divide-y divide-borde/60">
            {(data ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{f.estudiante?.nombre}</div>
                  <div className="text-xs text-muted">
                    {new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-GT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </div>
                </div>
                <Chip tono={TONO[f.estado] ?? 'neutro'}>{f.estado.toUpperCase()}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  )
}
