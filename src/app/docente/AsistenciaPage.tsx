import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, claseInput } from '../../components/ui'
import { PixelAvatar } from '../../components/PixelAvatar'

type Estado = 'presente' | 'ausente' | 'tardanza' | 'justificado'

const ESTADOS: { id: Estado; txt: string; clase: string }[] = [
  { id: 'presente', txt: 'P', clase: 'bg-exito text-white' },
  { id: 'ausente', txt: 'A', clase: 'bg-alerta text-white' },
  { id: 'tardanza', txt: 'T', clase: 'bg-aviso text-white' },
  { id: 'justificado', txt: 'J', clase: 'bg-info text-white' },
]

interface ClaseSeccion {
  seccion_id: string
  etiqueta: string
}

// Toma de asistencia con un clic (§2.2): P/A/T/J por estudiante, upsert por día.
// La RLS solo permite escribir en secciones asignadas al docente.
export function AsistenciaPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(hoy)
  const [seccionSel, setSeccionSel] = useState('')
  const [marcas, setMarcas] = useState<Record<string, Estado>>({})
  const [guardado, setGuardado] = useState(false)

  const { data: secciones } = useQuery({
    queryKey: ['docente-secciones'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asignacion_docente')
        .select('seccion_id, seccion:seccion_id(nombre, grado:grado_id(nombre))')
        .eq('docente_id', perfil!.id)
      const vistos = new Set<string>()
      const out: ClaseSeccion[] = []
      for (const a of (data ?? []) as unknown as {
        seccion_id: string
        seccion: { nombre: string; grado: { nombre: string } | null } | null
      }[]) {
        if (vistos.has(a.seccion_id)) continue
        vistos.add(a.seccion_id)
        out.push({
          seccion_id: a.seccion_id,
          etiqueta: `${a.seccion?.grado?.nombre ?? ''} ${a.seccion?.nombre ?? ''}`.trim(),
        })
      }
      if (out.length > 0) setSeccionSel((s) => s || out[0].seccion_id)
      return out
    },
  })

  const { data: lista, isLoading } = useQuery({
    queryKey: ['asistencia-lista', seccionSel, fecha],
    enabled: !!seccionSel,
    queryFn: async () => {
      const [est, asi] = await Promise.all([
        supabase
          .from('estudiante')
          .select('id, nombre, avatar_seed, avatar_pixel')
          .eq('seccion_id', seccionSel)
          .order('nombre'),
        supabase
          .from('asistencia')
          .select('estudiante_id, estado')
          .eq('seccion_id', seccionSel)
          .eq('fecha', fecha),
      ])
      const previa: Record<string, Estado> = {}
      for (const a of asi.data ?? []) previa[a.estudiante_id] = a.estado as Estado
      setMarcas(previa)
      setGuardado(false)
      return (est.data ?? []) as { id: string; nombre: string; avatar_seed: string | null; avatar_pixel: string | null }[]
    },
  })

  const pendientes = useMemo(
    () => (lista ?? []).filter((e) => !marcas[e.id]).length,
    [lista, marcas],
  )

  const guardar = useMutation({
    mutationFn: async () => {
      const filas = Object.entries(marcas).map(([estudiante_id, estado]) => ({
        colegio_id: perfil!.colegio_id,
        estudiante_id,
        seccion_id: seccionSel,
        fecha,
        estado,
        registrado_por: perfil!.id,
      }))
      if (filas.length === 0) return
      const { error } = await supabase
        .from('asistencia')
        .upsert(filas, { onConflict: 'estudiante_id,fecha' })
      if (error) throw error
    },
    onSuccess: () => {
      setGuardado(true)
      qc.invalidateQueries({ queryKey: ['asistencia-lista'] })
    },
  })

  const marcarTodos = (estado: Estado) => {
    const m: Record<string, Estado> = {}
    for (const e of lista ?? []) m[e.id] = estado
    setMarcas(m)
    setGuardado(false)
  }

  if (secciones && secciones.length === 0)
    return (
      <>
        <EncabezadoPagina titulo={<>Pasar <em className="text-amber-d italic">lista</em></>} />
        <Tarjeta>
          <EstadoVacio
            titulo="Sin secciones asignadas"
            texto="Cuando la dirección te asigne una sección podrás pasar asistencia aquí."
          />
        </Tarjeta>
      </>
    )

  return (
    <>
      <EncabezadoPagina
        titulo={<>Pasar <em className="text-amber-d italic">lista</em></>}
        sub="Presente · Ausente · Tardanza · Justificado. Los padres se enteran al instante."
      />
      <Tarjeta>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <div className="mb-1.5 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Sección</div>
            <select className={claseInput} value={seccionSel} onChange={(e) => setSeccionSel(e.target.value)}>
              {(secciones ?? []).map((s) => (
                <option key={s.seccion_id} value={s.seccion_id}>{s.etiqueta}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Fecha</div>
            <input type="date" className={claseInput} max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <Boton variante="fantasma" onClick={() => marcarTodos('presente')}>Todos presentes</Boton>
          <div className="ml-auto flex items-center gap-3">
            {pendientes > 0 && <span className="text-xs text-muted">{pendientes} sin marcar</span>}
            {guardado && (
              <span className="flex items-center gap-1 text-xs font-bold text-exito">
                <Check className="h-3.5 w-3.5" /> Guardado
              </span>
            )}
            <Boton onClick={() => guardar.mutate()} disabled={guardar.isPending || Object.keys(marcas).length === 0}>
              {guardar.isPending ? 'Guardando…' : 'Guardar asistencia'}
            </Boton>
          </div>
        </div>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-cream-2" />
        ) : (lista ?? []).length === 0 ? (
          <EstadoVacio titulo="Sección sin estudiantes" texto="La dirección aún no agrega estudiantes a esta sección." />
        ) : (
          <ul className="divide-y divide-borde/60">
            {(lista ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <PixelAvatar seed={e.avatar_seed ?? e.nombre} codigoPixel={e.avatar_pixel} tamano={32} />
                  <span className="truncate text-sm font-semibold" title={e.nombre}>{e.nombre}</span>
                </div>
                <div className="flex gap-1.5">
                  {ESTADOS.map((s) => (
                    <button
                      key={s.id}
                      title={s.id}
                      aria-label={`${s.id} para ${e.nombre}`}
                      onClick={() => {
                        setMarcas({ ...marcas, [e.id]: s.id })
                        setGuardado(false)
                      }}
                      className={`h-9 w-9 rounded-lg text-xs font-extrabold transition-all ${
                        marcas[e.id] === s.id ? s.clase : 'bg-cream-2 text-muted hover:bg-cream-3'
                      }`}
                    >
                      {s.txt}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  )
}
