import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Flame, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { PixelAvatar } from '../../components/PixelAvatar'
import { useGamificacion } from '../../features/gamificacion/useGamificacion'
import { useRealtimeAcademico } from '../../features/realtime/useRealtimeAcademico'

interface TareaFila {
  id: string
  titulo: string
  fecha_entrega: string | null
  materia: { nombre: string } | null
}

// Panel del estudiante: su avatar y sus tareas (solo lo propio, por RLS).
export function EstudianteHome() {
  const { perfil } = useAuth()
  const { data: juego } = useGamificacion()
  useRealtimeAcademico(['gamificacion', 'estudiante-inicio'])

  const { data, isLoading } = useQuery({
    queryKey: ['estudiante-inicio'],
    queryFn: async () => {
      const { data: yo } = await supabase
        .from('estudiante')
        .select('id, nombre, avatar_seed, avatar_pixel, seccion_id')
        .eq('perfil_id', perfil!.id)
        .maybeSingle()
      let tareas: TareaFila[] = []
      if (yo?.seccion_id) {
        const { data: t } = await supabase
          .from('tarea')
          .select('id, titulo, fecha_entrega, materia:materia_id(nombre)')
          .eq('seccion_id', yo.seccion_id)
          .order('fecha_entrega', { ascending: true, nullsFirst: false })
          .limit(10)
        tareas = (t ?? []) as unknown as TareaFila[]
      }
      return { yo, tareas }
    },
  })

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Hola, <em className="text-amber-d italic">{perfil?.nombre.split(' ')[0]}</em>
          </>
        }
        sub="Tus tareas de hoy y tu espacio."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta className="flex flex-col items-center gap-3 text-center">
          <PixelAvatar
            seed={data?.yo?.avatar_seed ?? perfil?.nombre ?? 'SmartPath'}
            codigoPixel={data?.yo?.avatar_pixel}
            tamano={96}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber" />
              <span className="font-display text-lg leading-none">{juego?.xpTotal ?? 0}</span>
              <span className="font-mono text-[9px] tracking-widest text-muted uppercase">XP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className={`h-4 w-4 ${(juego?.racha ?? 0) > 0 ? 'text-amber' : 'text-muted-2'}`} />
              <span className="font-display text-lg leading-none">{juego?.racha ?? 0}</span>
              <span className="font-mono text-[9px] tracking-widest text-muted uppercase">racha</span>
            </div>
          </div>
          <div className="text-[15px] font-semibold">{perfil?.nombre}</div>
        </Tarjeta>

        <Tarjeta className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
            <CalendarDays className="h-4 w-4 text-amber" /> Próximas tareas
          </div>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-cream-2" />
          ) : data && data.tareas.length > 0 ? (
            <ul className="divide-y divide-borde">
              {data.tareas.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.titulo}</div>
                    <div className="truncate text-xs text-muted">{t.materia?.nombre ?? 'General'}</div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-cream-2 px-2.5 py-1 font-mono text-[11px] text-muted">
                    {t.fecha_entrega
                      ? new Date(t.fecha_entrega + 'T00:00:00').toLocaleDateString('es-GT', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : 'Sin fecha'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVacio
              titulo="Todo al día"
              texto="Aún no hay tareas pendientes. Cuando tus docentes publiquen algo, lo verás aquí."
            />
          )}
        </Tarjeta>
      </div>
    </>
  )
}
