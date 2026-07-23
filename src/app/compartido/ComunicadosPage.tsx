import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Megaphone, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'

interface Noticia {
  id: string
  titulo: string
  resumen: string | null
  cuerpo: string | null
  fuente: string
  alcance: string
  prioridad: number
  publicado_en: string
}

// Comunicados con acuse de lectura (§5, §10). Estilo tarjetas apiladas con
// color por fuente. El director ve cuántos han firmado de enterado.
export function ComunicadosPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const esDirector = perfil?.rol === 'director'
  const esDocente = perfil?.rol === 'docente'
  const [abierta, setAbierta] = useState<string | null>(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [alcance, setAlcance] = useState('colegio')
  const [seccionSel, setSeccionSel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['comunicados'],
    queryFn: async () => {
      const [noticias, misAcuses, conteos] = await Promise.all([
        supabase
          .from('noticia')
          .select('id, titulo, resumen, cuerpo, fuente, alcance, prioridad, publicado_en')
          .order('prioridad', { ascending: false })
          .order('publicado_en', { ascending: false })
          .limit(50),
        supabase.from('acuse_lectura').select('noticia_id').eq('perfil_id', perfil!.id),
        esDirector ? supabase.from('acuse_lectura').select('noticia_id') : Promise.resolve({ data: [] }),
      ])
      const conteo = new Map<string, number>()
      for (const a of (conteos.data ?? []) as { noticia_id: string }[])
        conteo.set(a.noticia_id, (conteo.get(a.noticia_id) ?? 0) + 1)
      return {
        noticias: (noticias.data ?? []) as Noticia[],
        leidas: new Set(((misAcuses.data ?? []) as { noticia_id: string }[]).map((a) => a.noticia_id)),
        conteo,
      }
    },
  })

  // realtime: nuevo comunicado → la lista se refresca sola
  useEffect(() => {
    const canal = supabase
      .channel('comunicados')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'noticia' }, () =>
        qc.invalidateQueries({ queryKey: ['comunicados'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: secciones } = useQuery({
    queryKey: ['com-secciones', perfil?.rol],
    enabled: esDirector || esDocente,
    queryFn: async () => {
      if (esDirector) {
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

  const publicar = useMutation({
    mutationFn: async () => {
      setError(null)
      if (titulo.trim().length < 3) throw new Error('Escribe un título')
      const alc = esDocente ? 'seccion' : alcance
      if (alc === 'seccion' && !seccionSel) throw new Error('Elige la sección')
      const { error } = await supabase.from('noticia').insert({
        colegio_id: perfil!.colegio_id,
        titulo: titulo.trim(),
        resumen: cuerpo.trim().slice(0, 140),
        cuerpo: cuerpo.trim(),
        fuente: 'colegio',
        alcance: alc,
        alcance_ref: alc === 'seccion' ? seccionSel : null,
        prioridad: urgente ? 1 : 0,
        publicado_por: perfil!.id,
      })
      if (error) throw new Error('No tienes permiso para publicar con ese alcance')
      // Comunicado urgente → intenta enviar Web Push (best-effort, no bloquea).
      if (urgente) {
        supabase.functions
          .invoke('enviar-push', {
            body: { titulo: `Urgente: ${titulo.trim()}`, cuerpo: cuerpo.trim().slice(0, 120), url: `/${perfil!.rol}/comunicados` },
          })
          .catch(() => {})
      }
    },
    onSuccess: () => {
      setModalNuevo(false)
      setTitulo('')
      setCuerpo('')
      setUrgente(false)
      qc.invalidateQueries({ queryKey: ['comunicados'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const firmar = useMutation({
    mutationFn: async (noticiaId: string) => {
      const { error } = await supabase.from('acuse_lectura').insert({
        colegio_id: perfil!.colegio_id,
        noticia_id: noticiaId,
        perfil_id: perfil!.id,
      })
      if (error && error.code !== '23505') throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comunicados'] }),
  })

  if (isLoading || !data) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Comunicados</>}
        sub="Avisos del colegio con acuse de lectura — sin perseguir a nadie."
      />

      {(esDirector || esDocente) && (
        <div className="mb-5">
          <Boton onClick={() => { setModalNuevo(true); setAlcance(esDocente ? 'seccion' : 'colegio'); setSeccionSel(secciones?.[0]?.id ?? ''); setError(null) }}>
            <Plus className="h-4 w-4" /> Publicar comunicado
          </Boton>
        </div>
      )}

      {data.noticias.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="Sin comunicados por ahora"
            texto="Cuando el colegio publique un aviso, aparecerá aquí y podrás firmar de enterado."
          />
        </Tarjeta>
      ) : (
        <div className="space-y-3">
          {data.noticias.map((n) => {
            const leida = data.leidas.has(n.id)
            const expandida = abierta === n.id
            return (
              <Tarjeta key={n.id} className={n.prioridad > 0 ? '!border-alerta/40' : ''}>
                <button className="w-full text-left" onClick={() => setAbierta(expandida ? null : n.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.prioridad > 0 ? 'bg-alerta/10' : 'bg-amber/10'}`}>
                        <Megaphone className={`h-4.5 w-4.5 ${n.prioridad > 0 ? 'text-alerta' : 'text-amber-d'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold">{n.titulo}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-mono uppercase">{n.fuente}</span>
                          <span>·</span>
                          <span>
                            {new Date(n.publicado_en).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' })}
                          </span>
                          {n.prioridad > 0 && <Chip tono="alerta">URGENTE</Chip>}
                          {n.alcance === 'seccion' && <Chip tono="info">SECCIÓN</Chip>}
                        </div>
                      </div>
                    </div>
                    {esDirector && (
                      <span className="shrink-0 rounded-lg bg-cream-2 px-2.5 py-1 font-mono text-[11px] text-muted">
                        {data.conteo.get(n.id) ?? 0} enterados
                      </span>
                    )}
                  </div>
                </button>
                {expandida && (
                  <div className="mt-3 border-t border-borde/60 pt-3">
                    <p className="text-sm whitespace-pre-wrap text-ink/90">{n.cuerpo || n.resumen || 'Sin contenido.'}</p>
                    <div className="mt-4">
                      {leida ? (
                        <span className="flex items-center gap-1.5 text-sm font-bold text-exito">
                          <CheckCheck className="h-4 w-4" /> Firmaste de enterado
                        </span>
                      ) : (
                        <Boton onClick={() => firmar.mutate(n.id)} disabled={firmar.isPending}>
                          <CheckCheck className="h-4 w-4" /> Firmar de enterado
                        </Boton>
                      )}
                    </div>
                  </div>
                )}
              </Tarjeta>
            )
          })}
        </div>
      )}

      <Modal abierto={modalNuevo} titulo="Publicar comunicado" onCerrar={() => setModalNuevo(false)}>
        {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}
        <div className="space-y-3">
          <div>
            <Etiqueta>Título</Etiqueta>
            <input className={claseInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Reunión de padres este viernes" />
          </div>
          <div>
            <Etiqueta>Contenido</Etiqueta>
            <textarea
              className={`${claseInput} min-h-28 resize-y py-2.5`}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder="Detalles del aviso…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Etiqueta>Alcance</Etiqueta>
              <select className={claseInput} value={esDocente ? 'seccion' : alcance} onChange={(e) => setAlcance(e.target.value)} disabled={esDocente}>
                {esDirector && <option value="colegio">Todo el colegio</option>}
                <option value="seccion">Una sección</option>
              </select>
            </div>
            {(alcance === 'seccion' || esDocente) && (
              <div>
                <Etiqueta>Sección</Etiqueta>
                <select className={claseInput} value={seccionSel} onChange={(e) => setSeccionSel(e.target.value)}>
                  {(secciones ?? []).map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
                </select>
              </div>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
            Marcar como urgente
          </label>
          <p className="text-xs text-muted-2">Los comunicados expiran solos a los 45 días (limpieza automática).</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModalNuevo(false)}>Cancelar</Boton>
          <Boton onClick={() => publicar.mutate()} disabled={publicar.isPending}>
            {publicar.isPending ? 'Publicando…' : 'Publicar'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
