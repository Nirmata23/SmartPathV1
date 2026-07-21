import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, claseInput } from '../../components/ui'
import { PixelAvatar } from '../../components/PixelAvatar'

interface Clase {
  id: string
  seccion_id: string
  materia_id: string
  etiqueta: string
}

// Libro de calificaciones (§2.2): notas por actividad con ponderación.
// Cada cambio queda en auditoría (trigger) y llega al padre al guardarse.
export function CalificacionesPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [claseSel, setClaseSel] = useState('')
  const [actividad, setActividad] = useState('')
  const [ponderacion, setPonderacion] = useState('100')
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: clases } = useQuery({
    queryKey: ['docente-clases-cal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asignacion_docente')
        .select('id, seccion_id, materia_id, seccion:seccion_id(nombre, grado:grado_id(nombre)), materia:materia_id(nombre)')
        .eq('docente_id', perfil!.id)
      const out: Clase[] = ((data ?? []) as unknown as {
        id: string
        seccion_id: string
        materia_id: string
        seccion: { nombre: string; grado: { nombre: string } | null } | null
        materia: { nombre: string } | null
      }[]).map((a) => ({
        id: a.id,
        seccion_id: a.seccion_id,
        materia_id: a.materia_id,
        etiqueta: `${a.materia?.nombre ?? ''} — ${a.seccion?.grado?.nombre ?? ''} ${a.seccion?.nombre ?? ''}`.trim(),
      }))
      if (out.length > 0) setClaseSel((s) => s || out[0].id)
      return out
    },
  })

  const clase = (clases ?? []).find((c) => c.id === claseSel)

  const { data: lista, isLoading } = useQuery({
    queryKey: ['cal-lista', clase?.seccion_id],
    enabled: !!clase,
    queryFn: async () => {
      const { data } = await supabase
        .from('estudiante')
        .select('id, nombre, avatar_seed, avatar_pixel')
        .eq('seccion_id', clase!.seccion_id)
        .order('nombre')
      return (data ?? []) as { id: string; nombre: string; avatar_seed: string | null; avatar_pixel: string | null }[]
    },
  })

  const { data: recientes } = useQuery({
    queryKey: ['cal-recientes', clase?.materia_id, clase?.seccion_id],
    enabled: !!clase,
    queryFn: async () => {
      const { data } = await supabase
        .from('calificacion')
        .select('id, actividad, nota, creado_en, estudiante:estudiante_id(nombre)')
        .eq('materia_id', clase!.materia_id)
        .order('creado_en', { ascending: false })
        .limit(8)
      return (data ?? []) as unknown as { id: string; actividad: string; nota: number; estudiante: { nombre: string } | null }[]
    },
  })

  const guardar = useMutation({
    mutationFn: async () => {
      setError(null)
      const act = actividad.trim()
      if (act.length < 2) throw new Error('Escribe el nombre de la actividad')
      const pond = Number(ponderacion)
      if (!Number.isFinite(pond) || pond <= 0) throw new Error('Ponderación inválida')
      const filas = Object.entries(notas)
        .filter(([, v]) => v.trim() !== '')
        .map(([estudiante_id, v]) => {
          const n = Number(v)
          if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`Nota inválida (${v}): usa 0–100`)
          return {
            colegio_id: perfil!.colegio_id,
            estudiante_id,
            materia_id: clase!.materia_id,
            actividad: act,
            nota: n,
            ponderacion: pond,
            registrado_por: perfil!.id,
          }
        })
      if (filas.length === 0) throw new Error('Ingresa al menos una nota')
      const { error } = await supabase.from('calificacion').insert(filas)
      if (error) throw error
    },
    onSuccess: () => {
      setOk(true)
      setNotas({})
      setActividad('')
      qc.invalidateQueries({ queryKey: ['cal-recientes'] })
    },
    onError: (e) => {
      setOk(false)
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    },
  })

  if (clases && clases.length === 0)
    return (
      <>
        <EncabezadoPagina titulo={<>Libro de <em className="text-amber-d italic">notas</em></>} />
        <Tarjeta>
          <EstadoVacio titulo="Sin clases asignadas" texto="Cuando tengas una materia asignada podrás calificar aquí." />
        </Tarjeta>
      </>
    )

  return (
    <>
      <EncabezadoPagina
        titulo={<>Libro de <em className="text-amber-d italic">notas</em></>}
        sub="Sube notas por actividad. Todo cambio queda en auditoría."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <div className="mb-1.5 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Clase</div>
              <select className={claseInput} value={claseSel} onChange={(e) => { setClaseSel(e.target.value); setNotas({}); setOk(false) }}>
                {(clases ?? []).map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-1.5 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Actividad</div>
              <input className={claseInput} value={actividad} onChange={(e) => setActividad(e.target.value)} placeholder="Examen unidad 1" />
            </div>
            <div>
              <div className="mb-1.5 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Ponderación</div>
              <input className={claseInput} inputMode="decimal" value={ponderacion} onChange={(e) => setPonderacion(e.target.value)} />
            </div>
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl bg-alerta/10 px-4 py-2.5 text-sm text-alerta">{error}</p>}
          {ok && (
            <p className="mb-4 flex items-center gap-1.5 rounded-xl bg-exito/10 px-4 py-2.5 text-sm font-semibold text-exito">
              <Check className="h-4 w-4" /> Notas guardadas — el padre y el estudiante ya pueden verlas.
            </p>
          )}

          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-cream-2" />
          ) : (lista ?? []).length === 0 ? (
            <EstadoVacio titulo="Sección sin estudiantes" texto="La dirección aún no agrega estudiantes a esta sección." />
          ) : (
            <>
              <ul className="divide-y divide-borde/60">
                {(lista ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <PixelAvatar seed={e.avatar_seed ?? e.nombre} codigoPixel={e.avatar_pixel} tamano={30} />
                      <span className="truncate text-sm font-semibold" title={e.nombre}>{e.nombre}</span>
                    </div>
                    <input
                      className={`${claseInput} !h-9 !w-20 text-center font-mono`}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Nota de ${e.nombre}`}
                      value={notas[e.id] ?? ''}
                      onChange={(ev) => { setNotas({ ...notas, [e.id]: ev.target.value }); setOk(false) }}
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <Boton onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                  {guardar.isPending ? 'Guardando…' : 'Guardar notas'}
                </Boton>
              </div>
            </>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">Últimas notas</div>
          {(recientes ?? []).length === 0 ? (
            <p className="text-sm text-muted">Aún no hay notas en esta clase.</p>
          ) : (
            <ul className="space-y-2.5">
              {(recientes ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{r.estudiante?.nombre}</div>
                    <div className="truncate text-xs text-muted">{r.actividad}</div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-cream-2 px-2.5 py-1 font-mono text-sm font-bold">
                    {Number(r.nota)}
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
