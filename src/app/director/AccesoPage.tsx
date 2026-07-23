import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogIn, LogOut, ScanLine } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, claseInput } from '../../components/ui'

interface Registro {
  id: string
  tipo: string
  creado_en: string
  estudiante: { nombre: string } | null
}

// Control de acceso (§10): en recepción se ingresa el código de carné del
// estudiante (o se escanea su QR, que contiene ese código) y se registra
// entrada/salida. El padre lo ve en tiempo real.
export function AccesoPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [carne, setCarne] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada')
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canal = supabase
      .channel('acceso')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acceso_registro' }, () =>
        qc.invalidateQueries({ queryKey: ['acceso-hoy'] }),
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data } = useQuery({
    queryKey: ['acceso-hoy'],
    queryFn: async () => {
      const desde = new Date(); desde.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('acceso_registro')
        .select('id, tipo, creado_en, estudiante:estudiante_id(nombre)')
        .gte('creado_en', desde.toISOString())
        .order('creado_en', { ascending: false })
        .limit(50)
      return (data ?? []) as unknown as Registro[]
    },
  })

  const registrar = useMutation({
    mutationFn: async () => {
      setError(null); setAviso(null)
      const codigo = carne.trim()
      if (codigo.length < 3) throw new Error('Ingresa el código del carné')
      const { data: est, error: e1 } = await supabase.rpc('buscar_estudiante_por_carne', { p_carne: codigo })
      if (e1) throw new Error('Error al buscar el carné')
      const encontrado = (est as { id: string; nombre: string }[])?.[0]
      if (!encontrado) throw new Error('No se encontró un estudiante con ese carné')
      const { error: e2 } = await supabase.from('acceso_registro').insert({
        colegio_id: perfil!.colegio_id,
        estudiante_id: encontrado.id,
        tipo,
        metodo: 'codigo',
        registrado_por: perfil!.id,
      })
      if (e2) throw new Error('No se pudo registrar el acceso')
      return encontrado.nombre
    },
    onSuccess: (nombre) => {
      setAviso(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada: ${nombre}`)
      setCarne('')
      qc.invalidateQueries({ queryKey: ['acceso-hoy'] })
      setTimeout(() => setAviso(null), 3500)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Error'),
  })

  function enviar(e: FormEvent) { e.preventDefault(); registrar.mutate() }

  return (
    <>
      <EncabezadoPagina
        titulo={<>Control de <em className="text-amber-d italic">acceso</em></>}
        sub="Registra la entrada y salida escaneando el QR del carné o escribiendo su código."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta>
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
            <ScanLine className="h-4 w-4 text-amber" /> Registrar acceso
          </div>
          <div className="mb-4 flex gap-2">
            {(['entrada', 'salida'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${
                  tipo === t ? (t === 'entrada' ? 'bg-exito text-white' : 'bg-info text-white') : 'bg-cream-2 text-muted'
                }`}
              >
                {t === 'entrada' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                {t === 'entrada' ? 'Entrada' : 'Salida'}
              </button>
            ))}
          </div>
          {aviso && <p className="mb-3 rounded-xl bg-exito/10 px-3 py-2 text-sm font-bold text-exito">{aviso}</p>}
          {error && <p className="mb-3 rounded-xl bg-alerta/10 px-3 py-2 text-sm text-alerta">{error}</p>}
          <form onSubmit={enviar} className="flex gap-2">
            <input
              className={`${claseInput} font-mono`}
              value={carne}
              onChange={(e) => setCarne(e.target.value)}
              placeholder="Código del carné (ej. dbarrios0421)"
              autoFocus
            />
            <Boton type="submit" disabled={registrar.isPending}>{registrar.isPending ? '…' : 'Registrar'}</Boton>
          </form>
          <p className="mt-3 text-xs text-muted-2">
            El código del carné es el usuario del estudiante. Un lector de QR de recepción puede rellenar este campo automáticamente.
          </p>
        </Tarjeta>

        <Tarjeta>
          <div className="mb-4 font-mono text-[11px] tracking-widest text-muted uppercase">Movimientos de hoy</div>
          {(data ?? []).length === 0 ? (
            <EstadoVacio titulo="Sin movimientos hoy" texto="Los ingresos y salidas del día aparecerán aquí en tiempo real." />
          ) : (
            <ul className="divide-y divide-borde/60">
              {(data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-sm font-semibold">{r.estudiante?.nombre}</span>
                  <div className="flex items-center gap-2">
                    <Chip tono={r.tipo === 'entrada' ? 'exito' : 'info'}>{r.tipo.toUpperCase()}</Chip>
                    <span className="font-mono text-xs text-muted-2">
                      {new Date(r.creado_en).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
