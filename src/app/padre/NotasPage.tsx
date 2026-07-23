import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton } from '../../components/ui'
import { generarBoleta } from '../../features/reportes/pdf'
import { useRealtimeAcademico } from '../../features/realtime/useRealtimeAcademico'

interface Nota {
  id: string
  actividad: string
  nota: number
  creado_en: string
  estudiante: { id: string; nombre: string } | null
  materia: { nombre: string } | null
}
interface Promedio {
  estudiante_id: string
  materia_id: string
  promedio: number
  materia?: string
}

// Notas de los hijos (RLS: el padre solo ve las suyas). Con Realtime: cuando el
// docente guarda una nota, esta vista se refresca sola.
export function NotasPage() {
  const { perfil } = useAuth()
  useRealtimeAcademico(['padre-notas'])
  const [generando, setGenerando] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['padre-notas'],
    queryFn: async () => {
      const [notas, promedios, materias, evals, colegio, hijos] = await Promise.all([
        supabase
          .from('calificacion')
          .select('id, actividad, nota, creado_en, estudiante:estudiante_id(id, nombre), materia:materia_id(nombre)')
          .order('creado_en', { ascending: false })
          .limit(40),
        supabase.from('v_promedio_estudiante_materia').select('estudiante_id, materia_id, promedio, evaluaciones'),
        supabase.from('materia').select('id, nombre'),
        Promise.resolve(null),
        supabase.from('colegio').select('nombre').eq('id', perfil!.colegio_id).maybeSingle(),
        supabase.from('estudiante').select('id, nombre'),
      ])
      void evals
      const nombreMateria = new Map((materias.data ?? []).map((m) => [m.id, m.nombre]))
      return {
        notas: (notas.data ?? []) as unknown as Nota[],
        promedios: ((promedios.data ?? []) as (Promedio & { evaluaciones: number })[]).map((p) => ({
          ...p,
          materia: nombreMateria.get(p.materia_id) ?? 'Materia',
        })),
        colegioNombre: colegio.data?.nombre ?? 'Colegio',
        hijos: (hijos.data ?? []) as { id: string; nombre: string }[],
      }
    },
  })

  async function descargarBoleta(estudianteId: string, estudianteNombre: string) {
    setErrorPdf(null)
    setGenerando(true)
    try {
      const materias = (data?.promedios ?? [])
        .filter((p) => p.estudiante_id === estudianteId)
        .map((p) => ({ materia: p.materia!, promedio: Number(p.promedio), evaluaciones: p.evaluaciones }))
      await generarBoleta(
        { colegioId: perfil!.colegio_id, colegioNombre: data!.colegioNombre, estudianteNombre, emitidoPor: perfil!.id },
        materias,
        `Ciclo ${new Date().getFullYear()}`,
      )
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : 'No se pudo generar la boleta')
    } finally {
      setGenerando(false)
    }
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Notas de tus <em className="text-amber-d italic">hijos</em></>}
        sub="Cada nota llega aquí en el momento en que el docente la guarda."
      />

      {errorPdf && <p className="mb-4 rounded-xl bg-alerta/10 px-4 py-2.5 text-sm text-alerta">{errorPdf}</p>}

      {(data?.hijos ?? []).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(data?.hijos ?? []).map((h) => (
            <Boton key={h.id} variante="fantasma" onClick={() => descargarBoleta(h.id, h.nombre)} disabled={generando}>
              <FileDown className="h-4 w-4" /> Boleta de {h.nombre.split(' ')[0]} (PDF)
            </Boton>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta>
          <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">Promedios por materia</div>
          {(data?.promedios ?? []).length === 0 ? (
            <p className="text-sm text-muted">Aún no hay promedios.</p>
          ) : (
            <ul className="space-y-2.5">
              {(data?.promedios ?? []).map((p) => (
                <li key={`${p.estudiante_id}-${p.materia_id}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{p.materia}</span>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold ${
                      Number(p.promedio) >= 60 ? 'bg-exito/10 text-exito' : 'bg-alerta/10 text-alerta'
                    }`}
                  >
                    {Number(p.promedio).toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta className="lg:col-span-2">
          <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">Notas recientes</div>
          {(data?.notas ?? []).length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay notas"
              texto="Cuando los docentes califiquen, verás aquí cada actividad con su punteo."
            />
          ) : (
            <ul className="divide-y divide-borde/60">
              {(data?.notas ?? []).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{n.actividad}</div>
                    <div className="truncate text-xs text-muted">
                      {n.estudiante?.nombre} · {n.materia?.nombre} ·{' '}
                      {new Date(n.creado_en).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-cream-2 px-2.5 py-1 font-mono text-sm font-bold">
                    {Number(n.nota)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
