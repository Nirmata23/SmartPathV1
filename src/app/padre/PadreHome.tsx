import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { PixelAvatar } from '../../components/PixelAvatar'
import type { Estudiante } from '../../types/db'

// Panel del padre/tutor: sus hijos (la RLS garantiza que solo ve los suyos).
export function PadreHome() {
  const { data: hijos, isLoading } = useQuery({
    queryKey: ['padre-hijos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estudiante')
        .select('id, colegio_id, perfil_id, nombre, carne, seccion_id, avatar_seed, avatar_pixel')
        .order('nombre')
        .limit(20)
      if (error) throw error
      return data as Estudiante[]
    },
  })

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Tu <em className="text-amber-d italic">familia</em>
          </>
        }
        sub="El estado de tus hijos e hijas en el colegio, en un solo lugar."
      />
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-cream-2" />
      ) : hijos && hijos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hijos.map((h) => (
            <Tarjeta key={h.id} className="flex items-center gap-4">
              <PixelAvatar seed={h.avatar_seed ?? h.nombre} codigoPixel={h.avatar_pixel} tamano={56} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{h.nombre}</div>
                <div className="mt-0.5 text-sm text-muted">
                  Asistencia, notas y tareas llegarán aquí al instante.
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      ) : (
        <Tarjeta>
          <EstadoVacio
            titulo="Aún no hay estudiantes vinculados"
            texto="Pide al colegio tu código familiar y canjéalo para vincularte con tu hijo o hija."
          />
        </Tarjeta>
      )}
    </>
  )
}
