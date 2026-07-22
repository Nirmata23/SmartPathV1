import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Check, Plus, Receipt, X } from 'lucide-react'
import { supabase, invocarFuncion } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'

interface PagoRevision {
  id: string
  referencia: string | null
  monto: number
  creado_en: string
  cuota: { concepto: string; estudiante: { nombre: string } | null } | null
}
interface Estudiante { id: string; nombre: string }

// Cobros del director (§8, §33): bandeja de aprobación de pagos por referencia
// (verificados contra el banco) y creación de cuotas. Aprobar/rechazar pasa por
// la Edge Function aprobar-pago (nunca escritura directa de 'pagado').
export function CobrosPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const moneda = 'Q'
  const [pestana, setPestana] = useState<'aprobaciones' | 'cuotas'>('aprobaciones')
  const [modalCuota, setModalCuota] = useState(false)
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // nueva cuota
  const [estSel, setEstSel] = useState('')
  const [concepto, setConcepto] = useState('Colegiatura')
  const [monto, setMonto] = useState('')
  const [vence, setVence] = useState('')

  useEffect(() => {
    const canal = supabase
      .channel('cobros-dir')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pago' }, () => qc.invalidateQueries({ queryKey: ['cobros'] }))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['cobros'],
    queryFn: async () => {
      const [revision, cuotas, estudiantes] = await Promise.all([
        supabase
          .from('pago')
          .select('id, referencia, monto, creado_en, cuota:cuota_id(concepto, estudiante:estudiante_id(nombre))')
          .eq('estado', 'en_revision')
          .order('creado_en', { ascending: true }),
        supabase
          .from('cuota')
          .select('id, concepto, monto, vence, estado, estudiante:estudiante_id(nombre)')
          .order('creado_en', { ascending: false })
          .limit(100),
        supabase.from('estudiante').select('id, nombre').order('nombre').limit(500),
      ])
      return {
        revision: (revision.data ?? []) as unknown as PagoRevision[],
        cuotas: (cuotas.data ?? []) as unknown as {
          id: string; concepto: string; monto: number; vence: string | null; estado: string; estudiante: { nombre: string } | null
        }[],
        estudiantes: (estudiantes.data ?? []) as Estudiante[],
      }
    },
  })

  const decidir = useMutation({
    mutationFn: async ({ pagoId, decision, motivo }: { pagoId: string; decision: 'aprobar' | 'rechazar'; motivo?: string }) => {
      return invocarFuncion<{ estado: string; correlativo?: string }>('aprobar-pago', { pago_id: pagoId, decision, motivo })
    },
    onSuccess: (r) => {
      setAviso(r.estado === 'pagado' ? `Pago aprobado · recibo ${r.correlativo}` : 'Pago rechazado')
      setRechazando(null)
      setMotivo('')
      qc.invalidateQueries({ queryKey: ['cobros'] })
      setTimeout(() => setAviso(null), 4000)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo procesar'),
  })

  const crearCuota = useMutation({
    mutationFn: async () => {
      setError(null)
      const m = Number(monto)
      if (!estSel) throw new Error('Elige el estudiante')
      if (!Number.isFinite(m) || m <= 0) throw new Error('Monto inválido')
      const { error } = await supabase.from('cuota').insert({
        colegio_id: perfil!.colegio_id,
        estudiante_id: estSel,
        concepto: concepto.trim(),
        monto: m,
        vence: vence || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setModalCuota(false)
      setMonto('')
      qc.invalidateQueries({ queryKey: ['cobros'] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  if (isLoading || !data) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Cobros</>}
        sub="Aprueba pagos contra tu banco y administra las cuotas del colegio."
      />

      {aviso && <p className="mb-4 rounded-xl bg-exito/10 px-4 py-2.5 text-sm font-bold text-exito">{aviso}</p>}
      {error && <p className="mb-4 rounded-xl bg-alerta/10 px-4 py-2.5 text-sm text-alerta">{error}</p>}

      <div className="mb-5 flex gap-2">
        {([['aprobaciones', `Por aprobar (${data.revision.length})`], ['cuotas', 'Cuotas']] as [typeof pestana, string][]).map(([id, txt]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`h-10 rounded-xl px-4 text-sm font-bold transition-colors ${pestana === id ? 'bg-ink text-cream' : 'bg-cream-2 text-muted hover:text-ink'}`}
          >
            {txt}
          </button>
        ))}
      </div>

      {pestana === 'aprobaciones' && (
        <Tarjeta>
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
            <BadgeCheck className="h-4 w-4 text-amber" /> Pagos por referencia — verifica en tu banca antes de aprobar
          </div>
          {data.revision.length === 0 ? (
            <EstadoVacio titulo="Nada por revisar" texto="Cuando un padre registre un pago por referencia, aparecerá aquí para que lo confirmes contra tu estado de cuenta." />
          ) : (
            <ul className="divide-y divide-borde/60">
              {data.revision.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {p.cuota?.estudiante?.nombre} · {p.cuota?.concepto}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>Ref: <span className="font-mono">{p.referencia || 'sin referencia'}</span></span>
                        <span>·</span>
                        <span>{new Date(p.creado_en).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{moneda}{Number(p.monto).toFixed(2)}</span>
                      <Boton variante="fantasma" className="!h-9 !px-3 !text-xs" onClick={() => setRechazando(p.id)} disabled={decidir.isPending}>
                        <X className="h-3.5 w-3.5" /> Rechazar
                      </Boton>
                      <Boton className="!h-9 !px-3 !text-xs" onClick={() => decidir.mutate({ pagoId: p.id, decision: 'aprobar' })} disabled={decidir.isPending}>
                        <Check className="h-3.5 w-3.5" /> Aprobar
                      </Boton>
                    </div>
                  </div>
                  {rechazando === p.id && (
                    <div className="mt-3 flex gap-2">
                      <input className={claseInput} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del rechazo (ej. no aparece en el banco)" />
                      <Boton variante="peligro" onClick={() => decidir.mutate({ pagoId: p.id, decision: 'rechazar', motivo })} disabled={decidir.isPending}>
                        Confirmar rechazo
                      </Boton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      {pestana === 'cuotas' && (
        <Tarjeta>
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">Cuotas del colegio</span>
            <Boton onClick={() => { setModalCuota(true); setEstSel(data.estudiantes[0]?.id ?? '') }}>
              <Plus className="h-4 w-4" /> Nueva cuota
            </Boton>
          </div>
          {data.cuotas.length === 0 ? (
            <EstadoVacio titulo="Sin cuotas creadas" texto="Crea las colegiaturas u otros conceptos de cobro para las familias." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left font-mono text-[10px] tracking-widest text-muted-2 uppercase">
                    <th className="pb-2 pl-1">Estudiante</th>
                    <th className="pb-2">Concepto</th>
                    <th className="pb-2">Vence</th>
                    <th className="pb-2 text-right">Monto</th>
                    <th className="pb-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cuotas.map((c) => {
                    const vencida = c.estado !== 'pagado' && c.vence && c.vence < new Date().toISOString().slice(0, 10)
                    return (
                      <tr key={c.id} className="border-b border-borde/60">
                        <td className="max-w-[180px] truncate py-2.5 pl-1 font-semibold" title={c.estudiante?.nombre}>{c.estudiante?.nombre}</td>
                        <td className="py-2.5 text-muted">{c.concepto}</td>
                        <td className={`py-2.5 ${vencida ? 'font-semibold text-alerta' : 'text-muted'}`}>
                          {c.vence ? new Date(c.vence + 'T00:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td className="py-2.5 text-right font-mono">{moneda}{Number(c.monto).toFixed(2)}</td>
                        <td className="py-2.5 text-right">
                          <Chip tono={c.estado === 'pagado' ? 'exito' : c.estado === 'en_revision' ? 'aviso' : c.estado === 'rechazado' ? 'alerta' : 'neutro'}>
                            {c.estado.replace('_', ' ').toUpperCase()}
                          </Chip>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      <Modal abierto={modalCuota} titulo="Nueva cuota" onCerrar={() => setModalCuota(false)}>
        <div className="space-y-3">
          <div>
            <Etiqueta>Estudiante</Etiqueta>
            <select className={claseInput} value={estSel} onChange={(e) => setEstSel(e.target.value)}>
              {data.estudiantes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Etiqueta>Concepto</Etiqueta>
              <input className={claseInput} value={concepto} onChange={(e) => setConcepto(e.target.value)} />
            </div>
            <div>
              <Etiqueta>Monto ({moneda})</Etiqueta>
              <input className={claseInput} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="350.00" />
            </div>
          </div>
          <div>
            <Etiqueta>Vence (opcional)</Etiqueta>
            <input type="date" className={claseInput} value={vence} onChange={(e) => setVence(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModalCuota(false)}>Cancelar</Boton>
          <Boton onClick={() => crearCuota.mutate()} disabled={crearCuota.isPending}>
            <Receipt className="h-4 w-4" /> {crearCuota.isPending ? 'Creando…' : 'Crear cuota'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
