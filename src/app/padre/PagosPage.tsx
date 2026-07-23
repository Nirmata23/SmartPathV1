import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Clock, FileCheck, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'
import { generarSolvencia } from '../../features/reportes/pdf'

interface Cuota {
  id: string
  concepto: string
  monto: number
  vence: string | null
  estado: string
  estudiante: { nombre: string } | null
}

// Pagos del padre (§8, §33 método 2): ve sus cuotas, registra el pago por
// referencia (No. de boleta + monto). Queda 'en_revision' hasta que el director
// lo confirme contra el banco. El padre NUNCA marca pagado por su cuenta.
export function PagosPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const moneda = 'Q'
  const [cuotaSel, setCuotaSel] = useState<Cuota | null>(null)
  const [referencia, setReferencia] = useState('')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const canal = supabase
      .channel('cobros-padre')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuota' }, () => qc.invalidateQueries({ queryKey: ['pagos-padre'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pago' }, () => qc.invalidateQueries({ queryKey: ['pagos-padre'] }))
      .subscribe()
    return () => { supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['pagos-padre'],
    queryFn: async () => {
      const [cuotas, estado, colegio, hijos] = await Promise.all([
        supabase
          .from('cuota')
          .select('id, concepto, monto, vence, estado, estudiante:estudiante_id(nombre)')
          .order('vence', { ascending: true, nullsFirst: false }),
        supabase.from('v_estado_cuenta').select('saldo_pendiente, pagado, cuotas_vencidas'),
        supabase.from('colegio').select('nombre').eq('id', perfil!.colegio_id).maybeSingle(),
        supabase.from('estudiante').select('id, nombre'),
      ])
      const agg = (estado.data ?? []) as { saldo_pendiente: number | null; pagado: number | null; cuotas_vencidas: number | null }[]
      return {
        cuotas: (cuotas.data ?? []) as unknown as Cuota[],
        saldo: agg.reduce((s, r) => s + Number(r.saldo_pendiente ?? 0), 0),
        pagado: agg.reduce((s, r) => s + Number(r.pagado ?? 0), 0),
        vencidas: agg.reduce((s, r) => s + Number(r.cuotas_vencidas ?? 0), 0),
        colegioNombre: colegio.data?.nombre ?? 'Colegio',
        hijos: (hijos.data ?? []) as { id: string; nombre: string }[],
      }
    },
  })

  const [generando, setGenerando] = useState(false)
  async function descargarSolvencia(nombre: string) {
    setError(null)
    setGenerando(true)
    try {
      await generarSolvencia(
        { colegioId: perfil!.colegio_id, colegioNombre: data!.colegioNombre, estudianteNombre: nombre, emitidoPor: perfil!.id },
        data!.saldo,
        moneda,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la constancia')
    } finally {
      setGenerando(false)
    }
  }

  const registrar = useMutation({
    mutationFn: async () => {
      setError(null)
      if (!cuotaSel) return
      const m = Number(monto)
      if (referencia.trim().length < 3) throw new Error('Escribe el número de boleta o referencia')
      if (!Number.isFinite(m) || m <= 0) throw new Error('Monto inválido')
      const { error } = await supabase.from('pago').insert({
        colegio_id: perfil!.colegio_id,
        cuota_id: cuotaSel.id,
        metodo: 'referencia',
        referencia: referencia.trim(),
        monto: m,
        estado: 'en_revision',
        registrado_por: perfil!.id,
      })
      if (error) throw new Error('No se pudo registrar el pago')
      // marca la cuota como en revisión para reflejarlo de inmediato
      await supabase.from('cuota').update({ estado: 'en_revision' }).eq('id', cuotaSel.id)
    },
    onSuccess: () => {
      setAviso('Pago registrado. El colegio lo confirmará contra su banco.')
      setCuotaSel(null)
      setReferencia('')
      setMonto('')
      qc.invalidateQueries({ queryKey: ['pagos-padre'] })
      setTimeout(() => setAviso(null), 5000)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  if (isLoading || !data) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Pagos y <em className="text-amber-d italic">cuotas</em></>}
        sub="Registra tu pago con el número de boleta. Sin subir fotos."
      />

      {aviso && <p className="mb-4 rounded-xl bg-exito/10 px-4 py-2.5 text-sm font-bold text-exito">{aviso}</p>}
      {error && !cuotaSel && <p className="mb-4 rounded-xl bg-alerta/10 px-4 py-2.5 text-sm text-alerta">{error}</p>}

      {data.saldo <= 0 && (data.hijos ?? []).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {(data.hijos ?? []).map((h) => (
            <Boton key={h.id} variante="fantasma" onClick={() => descargarSolvencia(h.nombre)} disabled={generando}>
              <FileCheck className="h-4 w-4" /> Constancia de solvencia de {h.nombre.split(' ')[0]}
            </Boton>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tarjeta>
          <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Saldo pendiente</div>
          <div className="font-display text-3xl">{moneda}{data.saldo.toFixed(2)}</div>
        </Tarjeta>
        <Tarjeta>
          <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Pagado</div>
          <div className="font-display text-3xl text-exito">{moneda}{data.pagado.toFixed(2)}</div>
        </Tarjeta>
        <Tarjeta>
          <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-2 uppercase">Cuotas vencidas</div>
          <div className={`font-display text-3xl ${data.vencidas > 0 ? 'text-alerta' : ''}`}>{data.vencidas}</div>
        </Tarjeta>
      </div>

      <Tarjeta>
        <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">Mis cuotas</div>
        {data.cuotas.length === 0 ? (
          <EstadoVacio titulo="Sin cuotas por ahora" texto="Cuando el colegio genere una colegiatura o cobro, aparecerá aquí." />
        ) : (
          <ul className="divide-y divide-borde/60">
            {data.cuotas.map((c) => {
              const vencida = c.estado !== 'pagado' && c.vence && c.vence < new Date().toISOString().slice(0, 10)
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.concepto}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{c.estudiante?.nombre}</span>
                      {c.vence && (
                        <>
                          <span>·</span>
                          <span className={vencida ? 'font-semibold text-alerta' : ''}>
                            Vence {new Date(c.vence + 'T00:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold">{moneda}{Number(c.monto).toFixed(2)}</span>
                    {c.estado === 'pagado' ? (
                      <Chip tono="exito">PAGADO</Chip>
                    ) : c.estado === 'en_revision' ? (
                      <Chip tono="aviso"><Clock className="mr-1 h-3 w-3" /> EN REVISIÓN</Chip>
                    ) : (
                      <Boton className="!h-9 !px-3 !text-xs" onClick={() => { setCuotaSel(c); setMonto(String(c.monto)); setReferencia(''); setError(null) }}>
                        <Banknote className="h-3.5 w-3.5" /> Registrar pago
                      </Boton>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Tarjeta>

      <Modal abierto={cuotaSel !== null} titulo="Registrar pago por referencia" onCerrar={() => setCuotaSel(null)}>
        {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}
        <div className="mb-4 rounded-xl bg-cream-2 px-4 py-3 text-sm">
          <div className="font-semibold">{cuotaSel?.concepto}</div>
          <div className="text-muted">{cuotaSel?.estudiante?.nombre} · {moneda}{Number(cuotaSel?.monto ?? 0).toFixed(2)}</div>
        </div>
        <p className="mb-4 text-xs text-muted-2">
          Deposita o transfiere en el banco como siempre, y escribe aquí el número de boleta. El colegio lo confirma contra su estado de cuenta. Sin fotos.
        </p>
        <div className="space-y-3">
          <div>
            <Etiqueta>Número de boleta / referencia</Etiqueta>
            <input className={`${claseInput} font-mono`} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="0123456789" />
          </div>
          <div>
            <Etiqueta>Monto depositado ({moneda})</Etiqueta>
            <input className={claseInput} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setCuotaSel(null)}>Cancelar</Boton>
          <Boton onClick={() => registrar.mutate()} disabled={registrar.isPending}>
            <Receipt className="h-4 w-4" /> {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
          </Boton>
        </div>
      </Modal>
    </>
  )
}
