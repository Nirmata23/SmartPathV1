import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GraduationCap, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  AuthShell,
  BotonPrimario,
  CampoOscuro,
  LogoSmartPath,
  MensajeError,
  claseInputOscuro,
} from './AuthShell'

// Portal público de admisiones (§35.2). La familia envía su solicitud sin login,
// vía RPC controlada. Enlace: /admision?c=<colegio_id>.
export function AdmisionPage() {
  const [params] = useSearchParams()
  const colegioId = params.get('c') ?? ''
  const [colegioNombre, setColegioNombre] = useState<string | null>(null)
  const [f, setF] = useState({ estudiante: '', grado: '', contacto: '', telefono: '', correo: '', mensaje: '' })
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!colegioId) return
    supabase.rpc('nombre_colegio', { p_colegio: colegioId }).then(({ data }) => setColegioNombre(data ?? null))
  }, [colegioId])

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!colegioId) { setError('Enlace de admisión inválido.'); return }
    if (f.estudiante.trim().length < 3 || f.contacto.trim().length < 3) {
      setError('Completa el nombre del estudiante y el de contacto.'); return
    }
    setCargando(true)
    const { error } = await supabase.rpc('enviar_solicitud_admision', {
      p_colegio: colegioId,
      p_nombre_estudiante: f.estudiante,
      p_grado: f.grado,
      p_nombre_contacto: f.contacto,
      p_telefono: f.telefono,
      p_correo: f.correo,
      p_mensaje: f.mensaje,
    })
    setCargando(false)
    if (error) { setError('No se pudo enviar la solicitud. Verifica el enlace.'); return }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <AuthShell ancho={440}>
        <LogoSmartPath />
        <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'rgba(22,163,74,.4)', background: 'rgba(22,163,74,.1)' }}>
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-exito" />
          <div className="font-display text-xl text-cream">¡Solicitud enviada!</div>
          <p className="mt-2 text-sm" style={{ color: 'rgba(245,237,224,.6)' }}>
            {colegioNombre ?? 'El colegio'} recibió tu solicitud de inscripción. Te contactarán pronto.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell ancho={460}>
      <LogoSmartPath />
      <h1 className="font-display mb-1.5 text-[28px] leading-tight tracking-tight">
        Solicitud de <em className="text-amber-l italic">inscripción</em>
      </h1>
      <p className="mb-6 text-[13.5px]" style={{ color: 'rgba(245,237,224,.5)' }}>
        {colegioNombre ? `Para ${colegioNombre}. ` : ''}Completa los datos y el colegio te contactará.
      </p>

      <MensajeError texto={error} />

      <form onSubmit={enviar}>
        <CampoOscuro etiqueta="Nombre del estudiante">
          <input className={claseInputOscuro} required value={f.estudiante} onChange={set('estudiante')} placeholder="Nombre y apellidos" />
        </CampoOscuro>
        <CampoOscuro etiqueta="Grado al que aplica">
          <input className={claseInputOscuro} value={f.grado} onChange={set('grado')} placeholder="Ej. 1ro Primaria" />
        </CampoOscuro>
        <CampoOscuro etiqueta="Nombre de contacto (padre/tutor)">
          <input className={claseInputOscuro} required value={f.contacto} onChange={set('contacto')} placeholder="Tu nombre" />
        </CampoOscuro>
        <div className="grid grid-cols-2 gap-3">
          <CampoOscuro etiqueta="Teléfono">
            <input className={claseInputOscuro} value={f.telefono} onChange={set('telefono')} placeholder="0000-0000" />
          </CampoOscuro>
          <CampoOscuro etiqueta="Correo">
            <input className={claseInputOscuro} type="email" value={f.correo} onChange={set('correo')} placeholder="correo@ejemplo.com" />
          </CampoOscuro>
        </div>
        <CampoOscuro etiqueta="Mensaje (opcional)">
          <textarea className={`${claseInputOscuro} min-h-20 resize-y py-2.5`} value={f.mensaje} onChange={set('mensaje')} placeholder="Cuéntanos algo…" />
        </CampoOscuro>
        <BotonPrimario cargando={cargando}>
          Enviar solicitud <Send className="h-[16px] w-[16px]" />
        </BotonPrimario>
      </form>
    </AuthShell>
  )
}
