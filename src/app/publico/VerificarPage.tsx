import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck, ShieldX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { AuthShell, LogoSmartPath } from './AuthShell'

interface DocVerificado {
  tipo: string
  estudiante_nombre: string
  colegio_nombre: string
  resumen: Record<string, unknown>
  emitido_en: string
}

const TITULO: Record<string, string> = {
  boleta: 'Boleta de calificaciones',
  solvencia: 'Constancia de solvencia',
  constancia: 'Constancia',
}

// Verificación PÚBLICA de documentos por QR (§35). No requiere login: usa la
// función verificar_documento(codigo) que devuelve solo lo certificado.
export function VerificarPage() {
  const [params] = useSearchParams()
  const [codigo, setCodigo] = useState(params.get('c') ?? '')
  const [doc, setDoc] = useState<DocVerificado | null>(null)
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'valido' | 'invalido'>('idle')

  async function verificar(c: string) {
    if (!c) return
    setEstado('cargando')
    const { data, error } = await supabase.rpc('verificar_documento', { p_codigo: c.trim() })
    if (error || !data || (data as DocVerificado[]).length === 0) {
      setDoc(null)
      setEstado('invalido')
      return
    }
    setDoc((data as DocVerificado[])[0])
    setEstado('valido')
  }

  useEffect(() => {
    if (params.get('c')) verificar(params.get('c')!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthShell ancho={440}>
      <LogoSmartPath />
      <h1 className="font-display mb-1.5 text-[28px] leading-tight tracking-tight">
        Verificar <em className="text-amber-l italic">documento</em>
      </h1>
      <p className="mb-6 text-[13.5px]" style={{ color: 'rgba(245,237,224,.5)' }}>
        Confirma que una boleta o constancia de SmartPath es legítima.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="SP-DOC-XXXXXXXX"
          className="h-[50px] flex-1 rounded-[13px] border px-4 font-mono text-sm text-cream"
          style={{ borderColor: 'rgba(245,237,224,.14)', background: 'rgba(245,237,224,.05)' }}
        />
        <button
          onClick={() => verificar(codigo)}
          className="h-[50px] rounded-[13px] px-5 text-sm font-bold"
          style={{ background: 'linear-gradient(135deg,#e07b00,#f7a927)', color: '#241403' }}
        >
          Verificar
        </button>
      </div>

      {estado === 'cargando' && (
        <p className="text-center text-sm" style={{ color: 'rgba(245,237,224,.5)' }}>Verificando…</p>
      )}

      {estado === 'invalido' && (
        <div className="flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: 'rgba(220,38,38,.4)', background: 'rgba(220,38,38,.12)' }}>
          <ShieldX className="h-8 w-8 shrink-0 text-alerta" />
          <div>
            <div className="font-bold text-cream">Documento no encontrado</div>
            <div className="text-sm" style={{ color: 'rgba(245,237,224,.55)' }}>
              Ese código no corresponde a ningún documento emitido. Podría ser falso o estar mal escrito.
            </div>
          </div>
        </div>
      )}

      {estado === 'valido' && doc && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(22,163,74,.4)', background: 'rgba(22,163,74,.1)' }}>
          <div className="mb-3 flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-exito" />
            <span className="font-bold text-cream">Documento legítimo</span>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt style={{ color: 'rgba(245,237,224,.5)' }}>Tipo</dt>
              <dd className="font-semibold text-cream">{TITULO[doc.tipo] ?? doc.tipo}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: 'rgba(245,237,224,.5)' }}>Estudiante</dt>
              <dd className="truncate font-semibold text-cream">{doc.estudiante_nombre}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: 'rgba(245,237,224,.5)' }}>Colegio</dt>
              <dd className="truncate font-semibold text-cream">{doc.colegio_nombre}</dd>
            </div>
            {doc.tipo === 'solvencia' && (
              <div className="flex justify-between gap-3">
                <dt style={{ color: 'rgba(245,237,224,.5)' }}>Estado</dt>
                <dd className="font-bold" style={{ color: doc.resumen.solvente ? '#7ee2a0' : '#ffb4b4' }}>
                  {doc.resumen.solvente ? 'Solvente' : 'Con saldo pendiente'}
                </dd>
              </div>
            )}
            {doc.tipo === 'boleta' && doc.resumen.promedio_general != null && (
              <div className="flex justify-between gap-3">
                <dt style={{ color: 'rgba(245,237,224,.5)' }}>Promedio general</dt>
                <dd className="font-bold text-cream">{String(doc.resumen.promedio_general)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt style={{ color: 'rgba(245,237,224,.5)' }}>Emitido</dt>
              <dd className="text-cream">{new Date(doc.emitido_en).toLocaleDateString('es-GT')}</dd>
            </div>
          </dl>
        </div>
      )}
    </AuthShell>
  )
}
