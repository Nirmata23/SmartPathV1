import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookMarked, Check, PenLine, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'
import { CanvasDibujo, type Trazo } from '../../components/CanvasDibujo'

interface Pagina {
  id: string
  fecha: string
  titulo: string
  tipo: string
  contenido: string | null
  dibujo: Trazo[] | null
  estudiante_id: string | null
  autor_id: string
  seccion_id: string
}
interface Respuesta {
  id: string
  pagina_id: string
  autor_id: string
  contenido: string | null
  firmado: boolean
}

const TIPO_TONO: Record<string, 'info' | 'aviso' | 'alerta' | 'neutro'> = {
  material: 'info', tarea: 'aviso', queja: 'alerta', nota: 'neutro',
}

// Agenda Escolar (§6, §25): libreta del docente hacia padres/estudiantes.
// Docente crea páginas (con dibujo vectorial); padre/estudiante leen y firman.
export function AgendaPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const esDocente = perfil?.rol === 'docente'
  const [seccionSel, setSeccionSel] = useState('')
  const [modal, setModal] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)

  // formulario de nueva página
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('nota')
  const [contenido, setContenido] = useState('')
  const [dibujo, setDibujo] = useState<Trazo[]>([])
  const [estPrivado, setEstPrivado] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: secciones } = useQuery({
    queryKey: ['agenda-secciones', perfil?.rol],
    queryFn: async () => {
      if (esDocente) {
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
      }
      // padre/estudiante: sus secciones se infieren; dejamos vacío y leemos todas las páginas visibles
      return [] as { id: string; etiqueta: string }[]
    },
  })

  useEffect(() => {
    if (esDocente && secciones && secciones.length > 0 && !seccionSel) setSeccionSel(secciones[0].id)
  }, [esDocente, secciones, seccionSel])

  useEffect(() => {
    const canal = supabase
      .channel('agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_pagina' }, () => qc.invalidateQueries({ queryKey: ['agenda'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_respuesta' }, () => qc.invalidateQueries({ queryKey: ['agenda'] }))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['agenda', seccionSel],
    queryFn: async () => {
      let q = supabase
        .from('agenda_pagina')
        .select('id, fecha, titulo, tipo, contenido, dibujo, estudiante_id, autor_id, seccion_id')
        .order('fecha', { ascending: false })
        .limit(60)
      if (esDocente && seccionSel) q = q.eq('seccion_id', seccionSel)
      const [paginas, respuestas, estudiantes] = await Promise.all([
        q,
        supabase.from('agenda_respuesta').select('id, pagina_id, autor_id, contenido, firmado'),
        esDocente && seccionSel
          ? supabase.from('estudiante').select('id, nombre').eq('seccion_id', seccionSel).order('nombre')
          : Promise.resolve({ data: [] }),
      ])
      return {
        paginas: (paginas.data ?? []) as unknown as Pagina[],
        respuestas: (respuestas.data ?? []) as Respuesta[],
        estudiantes: (estudiantes.data ?? []) as { id: string; nombre: string }[],
      }
    },
  })

  const firmasPorPagina = useMemo(() => {
    const m = new Map<string, Respuesta[]>()
    for (const r of data?.respuestas ?? []) m.set(r.pagina_id, [...(m.get(r.pagina_id) ?? []), r])
    return m
  }, [data])

  const crear = useMutation({
    mutationFn: async () => {
      setError(null)
      if (titulo.trim().length < 2) throw new Error('Escribe un título')
      const { error } = await supabase.from('agenda_pagina').insert({
        colegio_id: perfil!.colegio_id,
        seccion_id: seccionSel,
        autor_id: perfil!.id,
        titulo: titulo.trim(),
        tipo,
        contenido: contenido.trim() || null,
        dibujo: dibujo.length > 0 ? dibujo : null,
        estudiante_id: tipo === 'queja' && estPrivado ? estPrivado : null,
      })
      if (error) throw new Error('No se pudo crear la página')
    },
    onSuccess: () => {
      setModal(false)
      setTitulo(''); setContenido(''); setDibujo([]); setTipo('nota'); setEstPrivado('')
      qc.invalidateQueries({ queryKey: ['agenda'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const firmar = useMutation({
    mutationFn: async ({ paginaId, texto }: { paginaId: string; texto: string }) => {
      const { error } = await supabase.from('agenda_respuesta').insert({
        colegio_id: perfil!.colegio_id,
        pagina_id: paginaId,
        autor_id: perfil!.id,
        contenido: texto.trim() || null,
        firmado: true,
      })
      if (error && error.code !== '23505') throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda'] }),
  })

  return (
    <>
      <EncabezadoPagina
        titulo={<>Agenda <em className="text-amber-d italic">escolar</em></>}
        sub={esDocente ? 'Deja notas, material y dibujos para tus secciones.' : 'Material, tareas y notas de tus docentes. Firma de enterado.'}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {esDocente && (secciones ?? []).length > 0 && (
          <select className={`${claseInput} max-w-56`} value={seccionSel} onChange={(e) => setSeccionSel(e.target.value)}>
            {(secciones ?? []).map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
          </select>
        )}
        {esDocente && seccionSel && (
          <Boton onClick={() => { setModal(true); setError(null) }}>
            <Plus className="h-4 w-4" /> Nueva página
          </Boton>
        )}
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />
      ) : (data?.paginas ?? []).length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="La libreta está en blanco"
            texto={esDocente ? 'Crea la primera página con una nota, material o un dibujo a mano.' : 'Cuando tu docente escriba en la agenda, lo verás aquí.'}
          />
        </Tarjeta>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(data?.paginas ?? []).map((p) => {
            const firmas = firmasPorPagina.get(p.id) ?? []
            const yaFirme = firmas.some((f) => f.autor_id === perfil?.id && f.firmado)
            const expandida = abierta === p.id
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Tarjeta className="bg-[linear-gradient(180deg,#fffdf9,#faf8f4)]">
                  <button className="w-full text-left" onClick={() => setAbierta(expandida ? null : p.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <BookMarked className="mt-0.5 h-5 w-5 shrink-0 text-amber-d" />
                        <div className="min-w-0">
                          <div className="truncate font-display text-lg">{p.titulo}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                            <span>{new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long' })}</span>
                            <Chip tono={TIPO_TONO[p.tipo] ?? 'neutro'}>{p.tipo.toUpperCase()}</Chip>
                            {p.estudiante_id && <Chip tono="alerta">PRIVADA</Chip>}
                          </div>
                        </div>
                      </div>
                      {esDocente && <span className="shrink-0 font-mono text-[11px] text-muted-2">{firmas.filter((f) => f.firmado).length} firma(s)</span>}
                    </div>
                  </button>

                  {expandida && (
                    <div className="mt-3 border-t border-borde/60 pt-3">
                      {p.contenido && <p className="mb-3 text-sm whitespace-pre-wrap text-ink/90">{p.contenido}</p>}
                      {p.dibujo && p.dibujo.length > 0 && (
                        <div className="mb-3">
                          <CanvasDibujo valor={p.dibujo} soloLectura />
                        </div>
                      )}
                      {!esDocente && (
                        yaFirme ? (
                          <span className="flex items-center gap-1.5 text-sm font-bold text-exito">
                            <Check className="h-4 w-4" /> Firmaste de enterado
                          </span>
                        ) : (
                          <FirmarBloque onFirmar={(texto) => firmar.mutate({ paginaId: p.id, texto })} pendiente={firmar.isPending} />
                        )
                      )}
                      {esDocente && firmas.filter((f) => f.contenido).length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {firmas.filter((f) => f.contenido).map((f) => (
                            <div key={f.id} className="rounded-lg bg-cream-2 px-3 py-1.5 text-xs text-muted">{f.contenido}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Tarjeta>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal abierto={modal} titulo="Nueva página de agenda" onCerrar={() => setModal(false)}>
        {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Etiqueta>Título</Etiqueta>
              <input className={claseInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nota del día" />
            </div>
            <div>
              <Etiqueta>Tipo</Etiqueta>
              <select className={claseInput} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="nota">Nota</option>
                <option value="material">Material</option>
                <option value="tarea">Tarea</option>
                <option value="queja">Observación privada</option>
              </select>
            </div>
          </div>
          {tipo === 'queja' && (
            <div>
              <Etiqueta>Para el estudiante (privado a su familia)</Etiqueta>
              <select className={claseInput} value={estPrivado} onChange={(e) => setEstPrivado(e.target.value)}>
                <option value="">Elige…</option>
                {(data?.estudiantes ?? []).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <Etiqueta>Contenido</Etiqueta>
            <textarea className={`${claseInput} min-h-20 resize-y py-2.5`} value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Escribe la nota…" />
          </div>
          <div>
            <Etiqueta>Dibujo a mano (opcional)</Etiqueta>
            <CanvasDibujo valor={dibujo} onChange={setDibujo} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModal(false)}>Cancelar</Boton>
          <Boton onClick={() => crear.mutate()} disabled={crear.isPending}>
            <PenLine className="h-4 w-4" /> {crear.isPending ? 'Guardando…' : 'Publicar página'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}

function FirmarBloque({ onFirmar, pendiente }: { onFirmar: (texto: string) => void; pendiente: boolean }) {
  const [texto, setTexto] = useState('')
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className={claseInput} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder (opcional)…" />
      <Boton onClick={() => onFirmar(texto)} disabled={pendiente}>
        <Check className="h-4 w-4" /> Firmar de enterado
      </Boton>
    </div>
  )
}
