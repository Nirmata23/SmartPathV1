import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'

interface TareaFila {
  id: string
  titulo: string
  descripcion: string | null
  fecha_entrega: string | null
  puntos: number | null
  materia: { nombre: string } | null
}

// Todas las tareas de la sección del estudiante (RLS: solo su sección).
export function TareasPage() {
  const { perfil } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['estudiante-tareas'],
    queryFn: async () => {
      const { data: yo } = await supabase
        .from('estudiante')
        .select('seccion_id')
        .eq('perfil_id', perfil!.id)
        .maybeSingle()
      if (!yo?.seccion_id) return []
      const { data } = await supabase
        .from('tarea')
        .select('id, titulo, descripcion, fecha_entrega, puntos, materia:materia_id(nombre)')
        .eq('seccion_id', yo.seccion_id)
        .order('fecha_entrega', { ascending: true, nullsFirst: false })
        .limit(50)
      return (data ?? []) as unknown as TareaFila[]
    },
  })

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <EncabezadoPagina
        titulo={<>Mis <em className="text-amber-d italic">tareas</em></>}
        sub="Lo que tus docentes han dejado para tu sección."
      />
      {(data ?? []).length === 0 ? (
        <Tarjeta>
          <EstadoVacio titulo="Todo al día" texto="No hay tareas pendientes por ahora. Disfruta el descanso." />
        </Tarjeta>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(data ?? []).map((t) => {
            const vencida = t.fecha_entrega && t.fecha_entrega < hoy
            return (
              <Tarjeta key={t.id}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="truncate text-[15px] font-semibold" title={t.titulo}>{t.titulo}</div>
                  {t.puntos ? (
                    <span className="shrink-0 rounded-lg bg-amber/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-d">
                      {t.puntos} pts
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted">{t.materia?.nombre ?? 'General'}</div>
                {t.descripcion && <p className="mt-2 line-clamp-3 text-sm text-muted">{t.descripcion}</p>}
                <div className={`mt-3 font-mono text-[11px] tracking-widest uppercase ${vencida ? 'text-alerta' : 'text-muted-2'}`}>
                  {t.fecha_entrega
                    ? `Entrega: ${new Date(t.fecha_entrega + 'T00:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long' })}`
                    : 'Sin fecha límite'}
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}
    </>
  )
}
