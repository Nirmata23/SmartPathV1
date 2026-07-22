import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, Tarjeta } from '../AppLayout'
import { Boton, Etiqueta, Modal, claseInput } from '../../components/ui'

interface Evento {
  id: string
  titulo: string
  fecha_ini: string
  color: string
  categoria: string | null
  alcance: string
  creado_por: string | null
}

const CATEGORIAS = [
  { id: 'examen', nombre: 'Examen', color: '#dc2626' },
  { id: 'entrega', nombre: 'Entrega', color: '#e07b00' },
  { id: 'reunion', nombre: 'Reunión', color: '#2563eb' },
  { id: 'feriado', nombre: 'Feriado', color: '#16a34a' },
  { id: 'actividad', nombre: 'Actividad', color: '#8a5cf6' },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

// Calendario editable con colores por categoría (§24). El alcance depende del
// rol: director publica al colegio; docente a sus secciones; todos, personales.
export function CalendarioPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [modal, setModal] = useState<string | null>(null) // fecha YYYY-MM-DD
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('actividad')
  const [alcance, setAlcance] = useState('personal')
  const [seccionSel, setSeccionSel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const ini = new Date(anio, mes, 1)
  const fin = new Date(anio, mes + 1, 0)

  const { data: eventos } = useQuery({
    queryKey: ['calendario', anio, mes],
    queryFn: async () => {
      const { data } = await supabase
        .from('evento_calendario')
        .select('id, titulo, fecha_ini, color, categoria, alcance, creado_por')
        .gte('fecha_ini', ini.toISOString())
        .lte('fecha_ini', new Date(anio, mes + 1, 0, 23, 59).toISOString())
        .order('fecha_ini')
      return (data ?? []) as Evento[]
    },
  })

  const { data: secciones } = useQuery({
    queryKey: ['cal-secciones', perfil?.rol],
    enabled: perfil?.rol === 'director' || perfil?.rol === 'docente',
    queryFn: async () => {
      if (perfil!.rol === 'director') {
        const { data } = await supabase.from('seccion').select('id, nombre, grado:grado_id(nombre)')
        return ((data ?? []) as unknown as { id: string; nombre: string; grado: { nombre: string } | null }[]).map(
          (s) => ({ id: s.id, etiqueta: `${s.grado?.nombre ?? ''} ${s.nombre}`.trim() }),
        )
      }
      const { data } = await supabase
        .from('asignacion_docente')
        .select('seccion_id, seccion:seccion_id(nombre, grado:grado_id(nombre))')
        .eq('docente_id', perfil!.id)
      const vistos = new Set<string>()
      const out: { id: string; etiqueta: string }[] = []
      for (const a of (data ?? []) as unknown as { seccion_id: string; seccion: { nombre: string; grado: { nombre: string } | null } | null }[]) {
        if (vistos.has(a.seccion_id)) continue
        vistos.add(a.seccion_id)
        out.push({ id: a.seccion_id, etiqueta: `${a.seccion?.grado?.nombre ?? ''} ${a.seccion?.nombre ?? ''}`.trim() })
      }
      return out
    },
  })

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>()
    for (const e of eventos ?? []) {
      const k = e.fecha_ini.slice(0, 10)
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return m
  }, [eventos])

  const crear = useMutation({
    mutationFn: async () => {
      setError(null)
      if (titulo.trim().length < 2) throw new Error('Escribe un título')
      if (alcance === 'seccion' && !seccionSel) throw new Error('Elige la sección')
      const cat = CATEGORIAS.find((c) => c.id === categoria)!
      const { error } = await supabase.from('evento_calendario').insert({
        colegio_id: perfil!.colegio_id,
        titulo: titulo.trim(),
        fecha_ini: `${modal}T08:00:00`,
        color: cat.color,
        categoria,
        alcance,
        alcance_ref: alcance === 'seccion' ? seccionSel : null,
        creado_por: perfil!.id,
      })
      if (error) throw new Error('No tienes permiso para crear este tipo de evento')
    },
    onSuccess: () => {
      setModal(null)
      setTitulo('')
      qc.invalidateQueries({ queryKey: ['calendario'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('evento_calendario').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendario'] }),
  })

  // celdas del mes (lunes primero)
  const celdas: (string | null)[] = []
  const offset = (ini.getDay() + 6) % 7
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= fin.getDate(); d++)
    celdas.push(`${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  const hoyStr = new Date().toISOString().slice(0, 10)
  const puedeAlcanceColegio = perfil?.rol === 'director'
  const puedeAlcanceSeccion = perfil?.rol === 'director' || perfil?.rol === 'docente'

  return (
    <>
      <EncabezadoPagina
        titulo={<>Calendario</>}
        sub="Exámenes, entregas, reuniones y actividades — con color por categoría."
      />
      <Tarjeta>
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-xl">{MESES[mes]} {anio}</div>
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Mes anterior"
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-cream-2"
              onClick={() => { const d = new Date(anio, mes - 1); setAnio(d.getFullYear()); setMes(d.getMonth()) }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Mes siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-cream-2"
              onClick={() => { const d = new Date(anio, mes + 1); setAnio(d.getFullYear()); setMes(d.getMonth()) }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DIAS.map((d) => (
            <div key={d} className="pb-1 text-center font-mono text-[10px] tracking-widest text-muted-2 uppercase">{d}</div>
          ))}
          {celdas.map((fecha, i) =>
            fecha === null ? (
              <div key={`v${i}`} />
            ) : (
              <button
                key={fecha}
                onClick={() => { setModal(fecha); setTitulo(''); setAlcance(puedeAlcanceColegio ? 'colegio' : 'personal'); setSeccionSel(secciones?.[0]?.id ?? ''); setError(null) }}
                className={`group min-h-[76px] rounded-xl border p-1.5 text-left align-top transition-colors hover:border-amber ${
                  fecha === hoyStr ? 'border-amber bg-amber/5' : 'border-borde bg-white'
                }`}
              >
                <div className={`mb-1 text-xs font-bold ${fecha === hoyStr ? 'text-amber-d' : 'text-muted'}`}>
                  {Number(fecha.slice(8))}
                </div>
                <div className="space-y-1">
                  {(porDia.get(fecha) ?? []).slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-white"
                      style={{ background: e.color }}
                      title={e.titulo}
                    >
                      {e.titulo}
                    </div>
                  ))}
                  {(porDia.get(fecha) ?? []).length > 3 && (
                    <div className="text-[10px] text-muted-2">+{(porDia.get(fecha) ?? []).length - 3} más</div>
                  )}
                </div>
              </button>
            ),
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {CATEGORIAS.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} /> {c.nombre}
            </span>
          ))}
        </div>
      </Tarjeta>

      <Modal
        abierto={modal !== null}
        titulo={`Evento — ${modal ? new Date(modal + 'T00:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long' }) : ''}`}
        onCerrar={() => setModal(null)}
      >
        {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}

        {(porDia.get(modal ?? '') ?? []).length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {(porDia.get(modal ?? '') ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream-2 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: e.color }} />
                  <span className="truncate">{e.titulo}</span>
                </span>
                {(perfil?.rol === 'director' || e.creado_por === perfil?.id) && (
                  <button aria-label="Eliminar evento" onClick={() => borrar.mutate(e.id)} className="text-muted-2 hover:text-alerta">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          <div>
            <Etiqueta>Título</Etiqueta>
            <input className={claseInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Examen de Matemática" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Etiqueta>Categoría</Etiqueta>
              <select className={claseInput} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <Etiqueta>Visible para</Etiqueta>
              <select className={claseInput} value={alcance} onChange={(e) => setAlcance(e.target.value)}>
                {puedeAlcanceColegio && <option value="colegio">Todo el colegio</option>}
                {puedeAlcanceSeccion && (secciones ?? []).length > 0 && <option value="seccion">Una sección</option>}
                <option value="personal">Solo yo</option>
              </select>
            </div>
          </div>
          {alcance === 'seccion' && (
            <div>
              <Etiqueta>Sección</Etiqueta>
              <select className={claseInput} value={seccionSel} onChange={(e) => setSeccionSel(e.target.value)}>
                {(secciones ?? []).map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModal(null)}>Cerrar</Boton>
          <Boton onClick={() => crear.mutate()} disabled={crear.isPending}>
            <Plus className="h-4 w-4" /> {crear.isPending ? 'Creando…' : 'Agregar evento'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
