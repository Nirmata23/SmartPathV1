import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookText, Eye, Globe, Lock, Plus, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'

// Áreas del Currículo Nacional Base (GT) precargadas para el modo CNB (§24).
const AREAS_CNB = [
  'Comunicación y Lenguaje',
  'Matemáticas',
  'Medio Social y Natural',
  'Expresión Artística',
  'Educación Física',
  'Formación Ciudadana',
  'Productividad y Desarrollo',
]

interface Plan {
  id: string
  titulo: string
  modo: 'cnb' | 'libre'
  contenido: Record<string, unknown>
  compartido: boolean
  docente_id: string
  materia_id: string | null
}

// Planificador docente (§7): planes en modo CNB (áreas precargadas) o libre.
// Compartibles con el director y otros docentes del colegio.
export function PlanificadorPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [verPlan, setVerPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [modo, setModo] = useState<'cnb' | 'libre'>('cnb')
  const [area, setArea] = useState(AREAS_CNB[0])
  const [competencia, setCompetencia] = useState('')
  const [contenidos, setContenidos] = useState('')
  const [actividades, setActividades] = useState('')
  const [evaluacion, setEvaluacion] = useState('')
  const [libre, setLibre] = useState('')
  const [compartido, setCompartido] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['planes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plan_clase')
        .select('id, titulo, modo, contenido, compartido, docente_id, materia_id')
        .order('actualizado_en', { ascending: false })
        .limit(100)
      return (data ?? []) as unknown as Plan[]
    },
  })

  const crear = useMutation({
    mutationFn: async () => {
      setError(null)
      if (titulo.trim().length < 3) throw new Error('Escribe un título')
      const contenido =
        modo === 'cnb' ? { area, competencia, contenidos, actividades, evaluacion } : { texto: libre }
      const { error } = await supabase.from('plan_clase').insert({
        colegio_id: perfil!.colegio_id,
        docente_id: perfil!.id,
        titulo: titulo.trim(),
        modo,
        contenido,
        compartido,
      })
      if (error) throw new Error('No se pudo crear el plan')
    },
    onSuccess: () => {
      setModal(false)
      setTitulo('')
      setCompetencia('')
      setContenidos('')
      setActividades('')
      setEvaluacion('')
      setLibre('')
      setCompartido(false)
      qc.invalidateQueries({ queryKey: ['planes'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const alternarCompartir = useMutation({
    mutationFn: async (p: Plan) => {
      const { error } = await supabase.from('plan_clase').update({ compartido: !p.compartido }).eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planes'] }),
  })

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_clase').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planes'] }),
  })

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Planificador</>}
        sub="Planifica en modo CNB o libre. Comparte con tus colegas o guárdalo privado."
      />

      <div className="mb-5">
        <Boton onClick={() => { setModal(true); setModo('cnb'); setError(null) }}>
          <Plus className="h-4 w-4" /> Nuevo plan
        </Boton>
      </div>

      {(data ?? []).length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="Sin planes todavía"
            texto="Crea tu primer plan de clase. Puedes partir de las áreas del CNB o armar tu propia estructura."
          />
        </Tarjeta>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((p) => {
            const mio = p.docente_id === perfil?.id
            return (
              <Tarjeta key={p.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/10">
                    <BookText className="h-5 w-5 text-amber-d" />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Chip tono={p.modo === 'cnb' ? 'info' : 'neutro'}>{p.modo.toUpperCase()}</Chip>
                    {p.compartido && <Chip tono="exito">COMPARTIDO</Chip>}
                    {!mio && <Chip tono="neutro">DE COLEGA</Chip>}
                  </div>
                </div>
                <div className="truncate text-[15px] font-semibold" title={p.titulo}>{p.titulo}</div>
                <div className="mt-1 truncate text-sm text-muted">
                  {p.modo === 'cnb' ? String((p.contenido as { area?: string }).area ?? 'Plan CNB') : 'Plan libre'}
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => setVerPlan(p)}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Boton>
                  {mio && (
                    <>
                      <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => alternarCompartir.mutate(p)}>
                        {p.compartido ? <><Lock className="h-3.5 w-3.5" /> Privar</> : <><Users className="h-3.5 w-3.5" /> Compartir</>}
                      </Boton>
                      <button aria-label="Eliminar plan" onClick={() => borrar.mutate(p.id)} className="ml-auto text-muted-2 hover:text-alerta">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      <Modal abierto={modal} titulo="Nuevo plan de clase" onCerrar={() => setModal(false)}>
        {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}
        <div className="mb-4 flex gap-2">
          {(['cnb', 'libre'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`h-11 flex-1 rounded-xl text-sm font-bold transition-colors ${modo === m ? 'bg-ink text-cream' : 'bg-cream-2 text-muted'}`}
            >
              {m === 'cnb' ? 'Modo CNB' : 'Modo libre'}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div>
            <Etiqueta>Título del plan</Etiqueta>
            <input className={claseInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Unidad 1 — Números naturales" />
          </div>
          {modo === 'cnb' ? (
            <>
              <div>
                <Etiqueta>Área curricular (CNB)</Etiqueta>
                <select className={claseInput} value={area} onChange={(e) => setArea(e.target.value)}>
                  {AREAS_CNB.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <Etiqueta>Competencia</Etiqueta>
                <textarea className={`${claseInput} min-h-16 resize-y py-2.5`} value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="Qué se espera que logre el estudiante" />
              </div>
              <div>
                <Etiqueta>Contenidos</Etiqueta>
                <textarea className={`${claseInput} min-h-16 resize-y py-2.5`} value={contenidos} onChange={(e) => setContenidos(e.target.value)} />
              </div>
              <div>
                <Etiqueta>Actividades</Etiqueta>
                <textarea className={`${claseInput} min-h-16 resize-y py-2.5`} value={actividades} onChange={(e) => setActividades(e.target.value)} />
              </div>
              <div>
                <Etiqueta>Evaluación</Etiqueta>
                <textarea className={`${claseInput} min-h-16 resize-y py-2.5`} value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <Etiqueta>Contenido del plan (tu estructura)</Etiqueta>
              <textarea className={`${claseInput} min-h-40 resize-y py-2.5`} value={libre} onChange={(e) => setLibre(e.target.value)} placeholder="Organiza tu plan como prefieras…" />
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={compartido} onChange={(e) => setCompartido(e.target.checked)} />
            <Globe className="h-4 w-4 text-muted" /> Compartir con el director y otros docentes
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModal(false)}>Cancelar</Boton>
          <Boton onClick={() => crear.mutate()} disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Guardar plan'}
          </Boton>
        </div>
      </Modal>

      <Modal abierto={verPlan !== null} titulo={verPlan?.titulo ?? ''} onCerrar={() => setVerPlan(null)}>
        {verPlan && (
          <div className="space-y-3 text-sm">
            {verPlan.modo === 'cnb' ? (
              (['area', 'competencia', 'contenidos', 'actividades', 'evaluacion'] as const).map((k) => {
                const v = (verPlan.contenido as Record<string, string>)[k]
                if (!v) return null
                return (
                  <div key={k}>
                    <div className="font-mono text-[10px] tracking-widest text-muted-2 uppercase">{k}</div>
                    <p className="whitespace-pre-wrap text-ink/90">{v}</p>
                  </div>
                )
              })
            ) : (
              <p className="whitespace-pre-wrap text-ink/90">{String((verPlan.contenido as { texto?: string }).texto ?? '')}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
