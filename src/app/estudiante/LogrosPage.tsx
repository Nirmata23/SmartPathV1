import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Award, Check, Flame, Plus, Sparkles, Target, Trash2, Trophy } from 'lucide-react'
import { supabase, invocarFuncion } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Etiqueta, Modal, claseInput } from '../../components/ui'
import { useGamificacion } from '../../features/gamificacion/useGamificacion'
import { useRealtimeAcademico } from '../../features/realtime/useRealtimeAcademico'

const LOGROS_CAT: Record<string, { nombre: string; desc: string }> = {
  primer_paso: { nombre: 'Primer paso', desc: 'Ganaste tu primer XP' },
  aprendiz: { nombre: 'Aprendiz', desc: 'Alcanzaste 100 XP' },
  constante: { nombre: 'Constante', desc: 'Alcanzaste 300 XP' },
  imparable: { nombre: 'Imparable', desc: 'Alcanzaste 600 XP' },
}

interface Meta {
  id: string
  titulo: string
  completada: boolean
}

// Panel lúdico del estudiante (§9, §46): XP, nivel, racha, logros y metas.
// El XP se reclama vía Edge Function (validado en servidor).
export function LogrosPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const { data: juego } = useGamificacion()
  useRealtimeAcademico(['gamificacion'])
  const [modal, setModal] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  const { data: metas } = useQuery({
    queryKey: ['mis-metas'],
    queryFn: async () => {
      const { data: yo } = await supabase.from('estudiante').select('id').eq('perfil_id', perfil!.id).maybeSingle()
      if (!yo) return []
      const { data } = await supabase
        .from('meta')
        .select('id, titulo, completada')
        .eq('estudiante_id', yo.id)
        .order('creado_en', { ascending: false })
      return (data ?? []) as Meta[]
    },
  })

  const crearMeta = useMutation({
    mutationFn: async () => {
      const { data: yo } = await supabase.from('estudiante').select('id, colegio_id').eq('perfil_id', perfil!.id).maybeSingle()
      if (!yo) throw new Error('Sin estudiante')
      const { error } = await supabase.from('meta').insert({
        colegio_id: yo.colegio_id,
        estudiante_id: yo.id,
        titulo: titulo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setModal(false)
      setTitulo('')
      qc.invalidateQueries({ queryKey: ['mis-metas'] })
    },
  })

  const completarMeta = useMutation({
    mutationFn: async (meta: Meta) => {
      const { error } = await supabase.from('meta').update({ completada: true, completada_en: new Date().toISOString() }).eq('id', meta.id)
      if (error) throw error
      // reclama el XP en el servidor (valida que la meta esté completada)
      const r = await invocarFuncion<{ otorgado: number; logros_nuevos: string[] }>('otorgar-xp', {
        tipo: 'meta',
        referencia: meta.id,
      })
      return r
    },
    onSuccess: (r) => {
      setAviso(`+${r.otorgado} XP` + (r.logros_nuevos.length ? ` · Logro: ${r.logros_nuevos.join(', ')}` : ''))
      qc.invalidateQueries({ queryKey: ['mis-metas'] })
      qc.invalidateQueries({ queryKey: ['gamificacion'] })
      setTimeout(() => setAviso(null), 4000)
    },
  })

  const borrarMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meta').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-metas'] }),
  })

  const reclamarAsistencia = useMutation({
    mutationFn: async () => {
      const r = await invocarFuncion<{ otorgado?: number; error?: string; logros_nuevos?: string[] }>('otorgar-xp', {
        tipo: 'asistencia',
      })
      return r
    },
    onSuccess: (r) => {
      setAviso(r.otorgado ? `+${r.otorgado} XP por venir hoy` : (r.error ?? 'Sin XP disponible'))
      qc.invalidateQueries({ queryKey: ['gamificacion'] })
      setTimeout(() => setAviso(null), 4000)
    },
    onError: (e) => {
      setAviso(e instanceof Error ? e.message : 'Aún no disponible')
      setTimeout(() => setAviso(null), 4000)
    },
  })

  const pct = juego && juego.xpParaSiguiente > 0 ? Math.min(100, (juego.xpNivelActual / juego.xpParaSiguiente) * 100) : 0

  return (
    <>
      <EncabezadoPagina
        titulo={<>Mis <em className="text-amber-d italic">logros</em></>}
        sub="Gana XP cumpliendo tus metas y viniendo a clase. Tu esfuerzo se ve aquí."
      />

      {aviso && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl bg-exito/10 px-4 py-2.5 text-sm font-bold text-exito"
        >
          {aviso}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Pieza protagonista: nivel + XP */}
        <Tarjeta className="lg:col-span-2">
          <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#f2ede5" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="44" fill="none" stroke="#e07b00" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={276.5}
                  initial={{ strokeDashoffset: 276.5 }}
                  animate={{ strokeDashoffset: 276.5 - (276.5 * pct) / 100 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-display text-2xl leading-none">{juego?.nivel ?? 1}</span>
                <span className="font-mono text-[9px] tracking-widest text-muted uppercase">Nivel</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
                <Sparkles className="h-4 w-4 text-amber" /> {juego?.xpTotal ?? 0} XP total
              </div>
              <p className="mt-1 text-sm text-muted">
                {juego ? `${juego.xpNivelActual} / ${juego.xpParaSiguiente} XP para el nivel ${juego.nivel + 1}` : ''}
              </p>
              <div className="mt-3">
                <Boton variante="fantasma" onClick={() => reclamarAsistencia.mutate()} disabled={reclamarAsistencia.isPending}>
                  <Check className="h-4 w-4" /> Reclamar XP de hoy
                </Boton>
              </div>
            </div>
          </div>
        </Tarjeta>

        {/* Racha */}
        <Tarjeta className="flex flex-col items-center justify-center text-center">
          <motion.div
            animate={{ scale: (juego?.racha ?? 0) > 0 ? [1, 1.12, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Flame className={`h-12 w-12 ${(juego?.racha ?? 0) > 0 ? 'text-amber' : 'text-muted-2'}`} />
          </motion.div>
          <div className="mt-2 font-display text-3xl">{juego?.racha ?? 0}</div>
          <div className="font-mono text-[10px] tracking-widest text-muted uppercase">
            {(juego?.racha ?? 0) === 1 ? 'día de racha' : 'días de racha'}
          </div>
          {(juego?.mejorRacha ?? 0) > 0 && (
            <div className="mt-1 text-xs text-muted-2">Mejor: {juego?.mejorRacha}</div>
          )}
        </Tarjeta>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Metas */}
        <Tarjeta>
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
              <Target className="h-4 w-4 text-amber" /> Mis metas
            </span>
            <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => { setModal(true); setTitulo('') }}>
              <Plus className="h-3.5 w-3.5" /> Meta
            </Boton>
          </div>
          {(metas ?? []).length === 0 ? (
            <p className="text-sm text-muted">Ponte una meta y gana XP al cumplirla.</p>
          ) : (
            <ul className="space-y-2">
              {(metas ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className={`flex min-w-0 items-center gap-2 text-sm ${m.completada ? 'text-muted line-through' : ''}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${m.completada ? 'bg-exito' : 'bg-amber'}`} />
                    <span className="truncate">{m.titulo}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!m.completada && (
                      <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => completarMeta.mutate(m)} disabled={completarMeta.isPending}>
                        <Check className="h-3.5 w-3.5" /> Cumplí
                      </Boton>
                    )}
                    <button aria-label="Eliminar meta" onClick={() => borrarMeta.mutate(m.id)} className="text-muted-2 hover:text-alerta">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {/* Logros */}
        <Tarjeta>
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
            <Trophy className="h-4 w-4 text-amber" /> Insignias
          </div>
          {(juego?.logros ?? []).length === 0 ? (
            <EstadoVacio titulo="Aún sin insignias" texto="Gana XP para desbloquear tus primeras insignias." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(juego?.logros ?? []).map((l) => {
                const cat = LOGROS_CAT[l.clave] ?? { nombre: l.clave, desc: '' }
                return (
                  <div key={l.clave} className="flex items-center gap-2.5 rounded-xl bg-cream-2 p-3">
                    <Award className="h-8 w-8 shrink-0 text-amber" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{cat.nombre}</div>
                      <div className="truncate text-[11px] text-muted">{cat.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Tarjeta>
      </div>

      <Modal abierto={modal} titulo="Nueva meta" onCerrar={() => setModal(false)}>
        <Etiqueta>¿Qué quieres lograr?</Etiqueta>
        <input className={claseInput} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Entregar todas mis tareas esta semana" />
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModal(false)}>Cancelar</Boton>
          <Boton onClick={() => crearMeta.mutate()} disabled={crearMeta.isPending || titulo.trim().length < 3}>
            {crearMeta.isPending ? 'Guardando…' : 'Crear meta'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
