import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'

interface Clase {
  id: string
  seccion: { id: string; nombre: string; grado: { nombre: string } } | null
  materia: { id: string; nombre: string } | null
}

// Panel del docente: sus clases (asignaciones reales bajo RLS).
export function DocenteHome() {
  const { perfil } = useAuth()

  const { data: clases, isLoading } = useQuery({
    queryKey: ['docente-clases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asignacion_docente')
        .select('id, seccion:seccion_id(id, nombre, grado:grado_id(nombre)), materia:materia_id(id, nombre)')
        .eq('docente_id', perfil!.id)
        .limit(50)
      if (error) throw error
      return data as unknown as Clase[]
    },
  })

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Tus <em className="text-amber-d italic">clases</em>
          </>
        }
        sub="Las secciones y materias que el colegio te asignó."
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-cream-2" />
          ))}
        </div>
      ) : clases && clases.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clases.map((c) => (
            <Tarjeta key={c.id}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber/10">
                <BookOpen className="h-5 w-5 text-amber-d" />
              </div>
              <div className="truncate text-[15px] font-semibold">{c.materia?.nombre ?? 'Materia'}</div>
              <div className="mt-1 truncate text-sm text-muted">
                {c.seccion?.grado?.nombre} · Sección {c.seccion?.nombre}
              </div>
            </Tarjeta>
          ))}
        </div>
      ) : (
        <Tarjeta>
          <EstadoVacio
            titulo="Aún no tienes clases asignadas"
            texto="Cuando la dirección te asigne secciones y materias, aparecerán aquí y podrás pasar asistencia y calificar."
          />
        </Tarjeta>
      )}
    </>
  )
}
