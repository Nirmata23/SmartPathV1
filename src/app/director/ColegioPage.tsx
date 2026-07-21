import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Plus, Trash2, UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'

interface Grado { id: string; nombre: string }
interface Seccion { id: string; nombre: string; grado_id: string }
interface Materia { id: string; nombre: string }
interface Asignacion {
  id: string
  docente: { id: string; nombre: string } | null
  seccion: { id: string; nombre: string; grado: { nombre: string } | null } | null
  materia: { id: string; nombre: string } | null
}

const PLANTILLA_GT = {
  grados: ['1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria'],
  secciones: ['A'],
  materias: ['Matemática', 'Comunicación y Lenguaje', 'Medio Social y Natural', 'Expresión Artística', 'Educación Física', 'Formación Ciudadana'],
}

// Estructura del colegio (§4 paso 2): grados → secciones → materias → asignaciones.
export function ColegioPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const colegioId = perfil!.colegio_id

  const { data, isLoading } = useQuery({
    queryKey: ['estructura'],
    queryFn: async () => {
      const [g, s, m, a, d] = await Promise.all([
        supabase.from('grado').select('id, nombre').order('nombre'),
        supabase.from('seccion').select('id, nombre, grado_id').order('nombre'),
        supabase.from('materia').select('id, nombre').order('nombre'),
        supabase
          .from('asignacion_docente')
          .select('id, docente:docente_id(id, nombre), seccion:seccion_id(id, nombre, grado:grado_id(nombre)), materia:materia_id(id, nombre)'),
        supabase.from('perfil').select('id, nombre').eq('rol', 'docente').order('nombre'),
      ])
      return {
        grados: (g.data ?? []) as Grado[],
        secciones: (s.data ?? []) as Seccion[],
        materias: (m.data ?? []) as Materia[],
        asignaciones: (a.data ?? []) as unknown as Asignacion[],
        docentes: (d.data ?? []) as { id: string; nombre: string }[],
      }
    },
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['estructura'] })

  const aplicarPlantilla = useMutation({
    mutationFn: async () => {
      const { data: gradosNuevos, error: e1 } = await supabase
        .from('grado')
        .insert(PLANTILLA_GT.grados.map((nombre) => ({ colegio_id: colegioId, nombre })))
        .select('id, nombre')
      if (e1) throw e1
      const secciones = (gradosNuevos ?? []).flatMap((g) =>
        PLANTILLA_GT.secciones.map((nombre) => ({ colegio_id: colegioId, grado_id: g.id, nombre })),
      )
      const { error: e2 } = await supabase.from('seccion').insert(secciones)
      if (e2) throw e2
      const { error: e3 } = await supabase
        .from('materia')
        .insert(PLANTILLA_GT.materias.map((nombre) => ({ colegio_id: colegioId, nombre })))
      if (e3) throw e3
    },
    onSuccess: invalidar,
  })

  const [modal, setModal] = useState<null | 'grado' | 'seccion' | 'materia' | 'asignacion'>(null)
  const [nombre, setNombre] = useState('')
  const [gradoSel, setGradoSel] = useState('')
  const [docenteSel, setDocenteSel] = useState('')
  const [seccionSel, setSeccionSel] = useState('')
  const [materiaSel, setMateriaSel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const crear = useMutation({
    mutationFn: async () => {
      setError(null)
      if (modal === 'grado') {
        const { error } = await supabase.from('grado').insert({ colegio_id: colegioId, nombre: nombre.trim() })
        if (error) throw error
      } else if (modal === 'seccion') {
        if (!gradoSel) throw new Error('Elige un grado')
        const { error } = await supabase
          .from('seccion')
          .insert({ colegio_id: colegioId, grado_id: gradoSel, nombre: nombre.trim() })
        if (error) throw error
      } else if (modal === 'materia') {
        const { error } = await supabase.from('materia').insert({ colegio_id: colegioId, nombre: nombre.trim() })
        if (error) throw error
      } else if (modal === 'asignacion') {
        if (!docenteSel || !seccionSel || !materiaSel) throw new Error('Completa los tres campos')
        const { error } = await supabase.from('asignacion_docente').insert({
          colegio_id: colegioId,
          docente_id: docenteSel,
          seccion_id: seccionSel,
          materia_id: materiaSel,
        })
        if (error) throw new Error(error.code === '23505' ? 'Esa asignación ya existe' : error.message)
      }
    },
    onSuccess: () => {
      setModal(null)
      setNombre('')
      invalidar()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'),
  })

  const borrar = useMutation({
    mutationFn: async ({ tabla, id }: { tabla: string; id: string }) => {
      const { error } = await supabase.from(tabla).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })

  if (isLoading || !data) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  const vacio = data.grados.length === 0 && data.materias.length === 0

  return (
    <>
      <EncabezadoPagina
        titulo={<>Estructura del <em className="text-amber-d italic">colegio</em></>}
        sub="Grados, secciones, materias y qué docente da qué clase."
      />

      {vacio && (
        <Tarjeta className="mb-6">
          <EstadoVacio
            titulo="Empecemos con la estructura"
            texto="Puedes partir de la plantilla de Primaria (Guatemala, CNB) y ajustarla, o crear todo desde cero."
            accion={
              <Boton onClick={() => aplicarPlantilla.mutate()} disabled={aplicarPlantilla.isPending}>
                <Layers className="h-4 w-4" />
                {aplicarPlantilla.isPending ? 'Creando…' : 'Usar plantilla Primaria GT'}
              </Boton>
            }
          />
        </Tarjeta>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta>
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">Grados y secciones</span>
            <div className="flex gap-1.5">
              <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => { setModal('grado'); setNombre('') }}>
                <Plus className="h-3.5 w-3.5" /> Grado
              </Boton>
              <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => { setModal('seccion'); setNombre(''); setGradoSel(data.grados[0]?.id ?? '') }}>
                <Plus className="h-3.5 w-3.5" /> Sección
              </Boton>
            </div>
          </div>
          {data.grados.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay grados.</p>
          ) : (
            <ul className="space-y-3">
              {data.grados.map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{g.nombre}</span>
                    <button
                      aria-label={`Eliminar ${g.nombre}`}
                      onClick={() => borrar.mutate({ tabla: 'grado', id: g.id })}
                      className="text-muted-2 hover:text-alerta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {data.secciones.filter((s) => s.grado_id === g.id).map((s) => (
                      <Chip key={s.id}>Sección {s.nombre}</Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">Materias</span>
            <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => { setModal('materia'); setNombre('') }}>
              <Plus className="h-3.5 w-3.5" /> Materia
            </Boton>
          </div>
          {data.materias.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay materias.</p>
          ) : (
            <ul className="space-y-2">
              {data.materias.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{m.nombre}</span>
                  <button
                    aria-label={`Eliminar ${m.nombre}`}
                    onClick={() => borrar.mutate({ tabla: 'materia', id: m.id })}
                    className="text-muted-2 hover:text-alerta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">Asignaciones</span>
            <Boton
              variante="fantasma"
              className="!h-8 !px-2.5 !text-xs"
              onClick={() => {
                setModal('asignacion')
                setDocenteSel(data.docentes[0]?.id ?? '')
                setSeccionSel(data.secciones[0]?.id ?? '')
                setMateriaSel(data.materias[0]?.id ?? '')
              }}
            >
              <UserCheck className="h-3.5 w-3.5" /> Asignar
            </Boton>
          </div>
          {data.asignaciones.length === 0 ? (
            <p className="text-sm text-muted">
              {data.docentes.length === 0
                ? 'Primero invita docentes (en Personas) y luego asígnales clases.'
                : 'Asigna a cada docente su sección y materia.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {data.asignaciones.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <span className="font-semibold">{a.docente?.nombre}</span>
                    <span className="text-muted"> · {a.materia?.nombre} · {a.seccion?.grado?.nombre} {a.seccion?.nombre}</span>
                  </div>
                  <button
                    aria-label="Eliminar asignación"
                    onClick={() => borrar.mutate({ tabla: 'asignacion_docente', id: a.id })}
                    className="text-muted-2 hover:text-alerta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Modal
        abierto={modal !== null}
        titulo={
          modal === 'grado' ? 'Nuevo grado'
          : modal === 'seccion' ? 'Nueva sección'
          : modal === 'materia' ? 'Nueva materia'
          : 'Asignar clase a docente'
        }
        onCerrar={() => setModal(null)}
      >
        {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}
        {modal === 'asignacion' ? (
          <div className="space-y-3">
            <div>
              <Etiqueta>Docente</Etiqueta>
              <select className={claseInput} value={docenteSel} onChange={(e) => setDocenteSel(e.target.value)}>
                {data.docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div>
              <Etiqueta>Sección</Etiqueta>
              <select className={claseInput} value={seccionSel} onChange={(e) => setSeccionSel(e.target.value)}>
                {data.secciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {data.grados.find((g) => g.id === s.grado_id)?.nombre} — {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Etiqueta>Materia</Etiqueta>
              <select className={claseInput} value={materiaSel} onChange={(e) => setMateriaSel(e.target.value)}>
                {data.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {modal === 'seccion' && (
              <div>
                <Etiqueta>Grado</Etiqueta>
                <select className={claseInput} value={gradoSel} onChange={(e) => setGradoSel(e.target.value)}>
                  {data.grados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
            )}
            <div>
              <Etiqueta>Nombre</Etiqueta>
              <input
                className={claseInput}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={modal === 'seccion' ? 'A' : modal === 'grado' ? '1ro Primaria' : 'Matemática'}
              />
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModal(null)}>Cancelar</Boton>
          <Boton onClick={() => crear.mutate()} disabled={crear.isPending || (modal !== 'asignacion' && nombre.trim().length === 0)}>
            {crear.isPending ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
