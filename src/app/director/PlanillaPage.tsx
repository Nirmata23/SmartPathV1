import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calculator, FileDown, Plus, UserCog, Users } from 'lucide-react'
import { supabase, invocarFuncion } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'
import { generarReciboNomina } from '../../features/reportes/pdf'

interface Empleado { id: string; nombre: string; puesto: string | null; salario_base: number; activo: boolean }
interface Periodo { id: string; mes: string; estado: string }
interface PagoP {
  id: string
  empleado_id: string
  bruto: number
  descuentos: { igss?: number; isr?: number }
  neto: number
  estado: string
  empleado: { nombre: string; puesto: string | null } | null
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Planilla del personal (§32): registrar empleados, procesar el mes (cálculo de
// IGSS/ISR en servidor) y ver el desglose. SmartPath no mueve dinero.
export function PlanillaPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const moneda = 'Q'
  const [pestana, setPestana] = useState<'planilla' | 'empleados'>('planilla')
  const [periodoSel, setPeriodoSel] = useState('')
  const [modalEmp, setModalEmp] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // form empleado
  const [nombre, setNombre] = useState('')
  const [puesto, setPuesto] = useState('')
  const [salario, setSalario] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['planilla', periodoSel],
    queryFn: async () => {
      const [empleados, periodos] = await Promise.all([
        supabase.from('empleado').select('id, nombre, puesto, salario_base, activo').order('nombre'),
        supabase.from('planilla_periodo').select('id, mes, estado').order('mes', { ascending: false }),
      ])
      const per = (periodos.data ?? []) as Periodo[]
      const pid = periodoSel || per[0]?.id || ''
      if (!periodoSel && pid) setPeriodoSel(pid)
      let pagos: PagoP[] = []
      if (pid) {
        const { data: pp } = await supabase
          .from('pago_personal')
          .select('id, empleado_id, bruto, descuentos, neto, estado, empleado:empleado_id(nombre, puesto)')
          .eq('periodo_id', pid)
        pagos = (pp ?? []) as unknown as PagoP[]
      }
      return { empleados: (empleados.data ?? []) as Empleado[], periodos: per, pagos }
    },
  })

  const periodoActual = data?.periodos.find((p) => p.id === periodoSel)

  const crearEmpleado = useMutation({
    mutationFn: async () => {
      setError(null)
      const s = Number(salario)
      if (nombre.trim().length < 3) throw new Error('Nombre inválido')
      if (!Number.isFinite(s) || s < 0) throw new Error('Salario inválido')
      const { error } = await supabase.from('empleado').insert({
        colegio_id: perfil!.colegio_id, nombre: nombre.trim(), puesto: puesto.trim() || null, salario_base: s,
      })
      if (error) throw error
    },
    onSuccess: () => { setModalEmp(false); setNombre(''); setPuesto(''); setSalario(''); qc.invalidateQueries({ queryKey: ['planilla'] }) },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const crearPeriodo = useMutation({
    mutationFn: async () => {
      const hoy = new Date()
      const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
      const { data, error } = await supabase
        .from('planilla_periodo')
        .insert({ colegio_id: perfil!.colegio_id, mes })
        .select('id')
        .single()
      if (error) throw new Error(error.code === '23505' ? 'El periodo de este mes ya existe' : error.message)
      return data.id as string
    },
    onSuccess: (id) => { setPeriodoSel(id); qc.invalidateQueries({ queryKey: ['planilla'] }) },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  const procesar = useMutation({
    mutationFn: async () => {
      if (!periodoSel) throw new Error('Crea un periodo primero')
      return invocarFuncion<{ procesados: number; total_neto: number }>('calcular-planilla', { periodo_id: periodoSel })
    },
    onSuccess: (r) => {
      setAviso(`Planilla calculada: ${r.procesados} empleado(s), neto total ${moneda}${r.total_neto.toFixed(2)}`)
      qc.invalidateQueries({ queryKey: ['planilla'] })
      setTimeout(() => setAviso(null), 5000)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo procesar'),
  })

  const mesLabel = (m: string) => {
    const d = new Date(m + 'T00:00:00')
    return `${MESES[d.getMonth()]} ${d.getFullYear()}`
  }

  function descargarRecibo(p: PagoP) {
    generarReciboNomina({
      colegioNombre: 'Colegio',
      empleadoNombre: p.empleado?.nombre ?? 'Empleado',
      puesto: p.empleado?.puesto ?? '',
      mes: periodoActual ? mesLabel(periodoActual.mes) : '',
      bruto: Number(p.bruto),
      igss: Number(p.descuentos?.igss ?? 0),
      isr: Number(p.descuentos?.isr ?? 0),
      neto: Number(p.neto),
      moneda,
    })
  }

  if (isLoading || !data) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Planilla del <em className="text-amber-d italic">personal</em></>}
        sub="Calcula IGSS, ISR y provisiones. El pago lo haces por tu banco; aquí queda el desglose."
      />

      {aviso && <p className="mb-4 rounded-xl bg-exito/10 px-4 py-2.5 text-sm font-bold text-exito">{aviso}</p>}
      {error && <p className="mb-4 rounded-xl bg-alerta/10 px-4 py-2.5 text-sm text-alerta">{error}</p>}

      <div className="mb-5 flex gap-2">
        {([['planilla', 'Planilla del mes'], ['empleados', `Empleados (${data.empleados.length})`]] as [typeof pestana, string][]).map(([id, txt]) => (
          <button key={id} onClick={() => setPestana(id)} className={`h-10 rounded-xl px-4 text-sm font-bold transition-colors ${pestana === id ? 'bg-ink text-cream' : 'bg-cream-2 text-muted hover:text-ink'}`}>{txt}</button>
        ))}
      </div>

      {pestana === 'planilla' && (
        <Tarjeta>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {data.periodos.length > 0 ? (
              <select className={`${claseInput} max-w-52`} value={periodoSel} onChange={(e) => setPeriodoSel(e.target.value)}>
                {data.periodos.map((p) => <option key={p.id} value={p.id}>{mesLabel(p.mes)}{p.estado === 'cerrada' ? ' (cerrada)' : ''}</option>)}
              </select>
            ) : (
              <span className="text-sm text-muted">Aún no hay periodos.</span>
            )}
            <Boton variante="fantasma" onClick={() => crearPeriodo.mutate()} disabled={crearPeriodo.isPending}>
              <Plus className="h-4 w-4" /> Periodo del mes actual
            </Boton>
            <Boton onClick={() => procesar.mutate()} disabled={procesar.isPending || !periodoSel || data.empleados.length === 0}>
              <Calculator className="h-4 w-4" /> {procesar.isPending ? 'Calculando…' : 'Calcular planilla'}
            </Boton>
          </div>

          {data.pagos.length === 0 ? (
            <EstadoVacio
              titulo="Sin cálculo para este periodo"
              texto={data.empleados.length === 0 ? 'Primero registra a tus empleados en la pestaña Empleados.' : 'Crea un periodo y pulsa "Calcular planilla" para generar el desglose.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left font-mono text-[10px] tracking-widest text-muted-2 uppercase">
                    <th className="pb-2 pl-1">Empleado</th>
                    <th className="pb-2 text-right">Bruto</th>
                    <th className="pb-2 text-right">IGSS</th>
                    <th className="pb-2 text-right">ISR</th>
                    <th className="pb-2 text-right">Neto</th>
                    <th className="pb-2 text-right">Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pagos.map((p) => (
                    <tr key={p.id} className="border-b border-borde/60">
                      <td className="max-w-[200px] truncate py-2.5 pl-1 font-semibold" title={p.empleado?.nombre}>{p.empleado?.nombre}</td>
                      <td className="py-2.5 text-right font-mono">{moneda}{Number(p.bruto).toFixed(2)}</td>
                      <td className="py-2.5 text-right font-mono text-alerta">−{moneda}{Number(p.descuentos?.igss ?? 0).toFixed(2)}</td>
                      <td className="py-2.5 text-right font-mono text-alerta">−{moneda}{Number(p.descuentos?.isr ?? 0).toFixed(2)}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{moneda}{Number(p.neto).toFixed(2)}</td>
                      <td className="py-2.5 text-right">
                        <Boton variante="fantasma" className="!h-8 !px-2.5 !text-xs" onClick={() => descargarRecibo(p)}>
                          <FileDown className="h-3.5 w-3.5" /> PDF
                        </Boton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      {pestana === 'empleados' && (
        <Tarjeta>
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
              <Users className="h-4 w-4 text-amber" /> Personal del colegio
            </span>
            <Boton onClick={() => { setModalEmp(true); setError(null) }}>
              <Plus className="h-4 w-4" /> Empleado
            </Boton>
          </div>
          {data.empleados.length === 0 ? (
            <EstadoVacio titulo="Sin empleados" texto="Registra a tus docentes y personal administrativo con su salario base." />
          ) : (
            <ul className="divide-y divide-borde/60">
              {data.empleados.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-2"><UserCog className="h-4.5 w-4.5 text-muted" /></div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{e.nombre}</div>
                      <div className="truncate text-xs text-muted">{e.puesto || 'Sin puesto'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{moneda}{Number(e.salario_base).toFixed(2)}</span>
                    {!e.activo && <Chip tono="neutro">INACTIVO</Chip>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      <Modal abierto={modalEmp} titulo="Nuevo empleado" onCerrar={() => setModalEmp(false)}>
        <div className="space-y-3">
          <div><Etiqueta>Nombre completo</Etiqueta><input className={claseInput} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div><Etiqueta>Puesto</Etiqueta><input className={claseInput} value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Docente, secretaría…" /></div>
          <div><Etiqueta>Salario base mensual ({moneda})</Etiqueta><input className={claseInput} inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} placeholder="4500.00" /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModalEmp(false)}>Cancelar</Boton>
          <Boton onClick={() => crearEmpleado.mutate()} disabled={crearEmpleado.isPending}>{crearEmpleado.isPending ? 'Guardando…' : 'Guardar'}</Boton>
        </div>
      </Modal>
    </>
  )
}
