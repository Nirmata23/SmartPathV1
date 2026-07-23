import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Mail, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip } from '../../components/ui'

interface Solicitud {
  id: string
  nombre_estudiante: string
  grado_deseado: string | null
  nombre_contacto: string
  telefono: string | null
  correo: string | null
  mensaje: string | null
  estado: string
  creado_en: string
}

const ETAPAS: { id: string; nombre: string; tono: 'info' | 'aviso' | 'exito' | 'neutro' | 'alerta' }[] = [
  { id: 'nuevo', nombre: 'Nuevo', tono: 'info' },
  { id: 'contactado', nombre: 'Contactado', tono: 'aviso' },
  { id: 'aceptado', nombre: 'Aceptado', tono: 'exito' },
  { id: 'inscrito', nombre: 'Inscrito', tono: 'exito' },
  { id: 'rechazado', nombre: 'Rechazado', tono: 'alerta' },
]

// Embudo de admisiones (§35.2): el director gestiona las solicitudes del portal.
export function AdmisionesPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [copiado, setCopiado] = useState(false)
  const enlacePortal = `${window.location.origin}/admision?c=${perfil!.colegio_id}`

  const { data, isLoading } = useQuery({
    queryKey: ['admisiones'],
    queryFn: async () => {
      const { data } = await supabase
        .from('solicitud_admision')
        .select('id, nombre_estudiante, grado_deseado, nombre_contacto, telefono, correo, mensaje, estado, creado_en')
        .order('creado_en', { ascending: false })
        .limit(200)
      return (data ?? []) as Solicitud[]
    },
  })

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await supabase.from('solicitud_admision').update({ estado }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admisiones'] }),
  })

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  const porEstado = (e: string) => (data ?? []).filter((s) => s.estado === e)

  return (
    <>
      <EncabezadoPagina
        titulo={<>Admisiones</>}
        sub="Comparte tu enlace público y gestiona las solicitudes de familias nuevas."
      />

      <Tarjeta className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Enlace del portal de admisiones</div>
            <code className="block truncate rounded-lg bg-cream-2 px-3 py-2 font-mono text-xs">{enlacePortal}</code>
          </div>
          <Boton variante="fantasma" onClick={() => { navigator.clipboard.writeText(enlacePortal); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}>
            <Copy className="h-4 w-4" /> {copiado ? 'Copiado' : 'Copiar'}
          </Boton>
          <Boton variante="fantasma" onClick={() => window.open(enlacePortal, '_blank')}>
            <ExternalLink className="h-4 w-4" /> Abrir
          </Boton>
        </div>
      </Tarjeta>

      {(data ?? []).length === 0 ? (
        <Tarjeta>
          <EstadoVacio titulo="Sin solicitudes todavía" texto="Comparte el enlace de arriba en tus redes o sitio web. Las solicitudes llegarán aquí." />
        </Tarjeta>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ETAPAS.filter((e) => e.id !== 'rechazado' || porEstado('rechazado').length > 0).map((etapa) => {
            const items = porEstado(etapa.id)
            return (
              <Tarjeta key={etapa.id}>
                <div className="mb-3 flex items-center gap-2">
                  <Chip tono={etapa.tono}>{etapa.nombre.toUpperCase()}</Chip>
                  <span className="font-mono text-[11px] text-muted-2">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-2">—</p>
                ) : (
                  <ul className="space-y-2.5">
                    {items.map((s) => (
                      <li key={s.id} className="rounded-xl border border-borde/60 p-3">
                        <div className="truncate text-sm font-semibold">{s.nombre_estudiante}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {s.grado_deseado || 'Grado no indicado'} · contacto: {s.nombre_contacto}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted">
                          {s.telefono && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{s.telefono}</span>}
                          {s.correo && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{s.correo}</span>}
                        </div>
                        {s.mensaje && <p className="mt-1.5 line-clamp-2 text-xs text-muted-2">{s.mensaje}</p>}
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {ETAPAS.filter((e) => e.id !== s.estado).map((e) => (
                            <button
                              key={e.id}
                              onClick={() => cambiarEstado.mutate({ id: s.id, estado: e.id })}
                              className="rounded-lg bg-cream-2 px-2 py-1 text-[11px] font-semibold text-muted hover:bg-cream-3 hover:text-ink"
                            >
                              → {e.nombre}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            )
          })}
        </div>
      )}
    </>
  )
}
