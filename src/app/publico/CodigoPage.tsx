import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { z } from 'zod'
import { supabase, invocarFuncion } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  AuthShell,
  BotonPrimario,
  CampoOscuro,
  LogoSmartPath,
  MensajeError,
  claseInputOscuro,
} from './AuthShell'

const esquema = z.object({
  nombre: z.string().trim().min(3, 'Tu nombre debe tener al menos 3 caracteres').max(120),
  correo: z.string().email('Correo inválido'),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  codigo: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{6,40}$/, 'El código no tiene el formato correcto'),
})

// Primer ingreso de docentes, padres y estudiantes con código de un solo uso (§4, §21).
// El canje ocurre SIEMPRE en el servidor (Edge Function canjear-invitacion).
export function CodigoPage() {
  const nav = useNavigate()
  const { session, refrescarPerfil } = useAuth()
  const [f, setF] = useState({ nombre: '', correo: '', clave: '', codigo: '' })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value })

  async function canjear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = esquema.safeParse(session ? { ...f, correo: 'x@x.com', clave: 'xxxxxxxx' } : f)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setCargando(true)
    try {
      if (!session) {
        const { data, error: e1 } = await supabase.auth.signUp({
          email: f.correo,
          password: f.clave,
        })
        if (e1) throw new Error(
          e1.message.includes('already registered')
            ? 'Ese correo ya tiene cuenta. Inicia sesión y vuelve aquí para canjear tu código.'
            : 'No se pudo crear la cuenta.',
        )
        if (!data.session) {
          setAviso(
            'Te enviamos un correo de confirmación. Confírmalo, inicia sesión y vuelve a esta pantalla para canjear tu código.',
          )
          setCargando(false)
          return
        }
      }
      await invocarFuncion('canjear-invitacion', { codigo: f.codigo, nombre: f.nombre })
      await refrescarPerfil()
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo canjear el código.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthShell ancho={420}>
      <LogoSmartPath />
      <h1 className="font-display mb-1.5 text-[28px] leading-tight tracking-tight">
        Entrar con <em className="text-amber-l italic">código</em>
      </h1>
      <p className="mb-6 text-[13.5px]" style={{ color: 'rgba(245,237,224,.5)' }}>
        Tu colegio te entregó un código de invitación de un solo uso. Es tu llave de entrada.
      </p>

      <MensajeError texto={error} />
      {aviso && (
        <div
          role="status"
          className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
          style={{ borderColor: 'rgba(22,163,74,.4)', background: 'rgba(22,163,74,.12)', color: '#b7f0c6' }}
        >
          {aviso}
        </div>
      )}

      <form onSubmit={canjear}>
        <CampoOscuro etiqueta="Código de invitación">
          <input
            className={`${claseInputOscuro} font-mono tracking-widest uppercase`}
            required
            value={f.codigo}
            onChange={set('codigo')}
            placeholder="XXXX-XXXX-XXXX"
          />
        </CampoOscuro>
        <CampoOscuro etiqueta="Tu nombre completo">
          <input className={claseInputOscuro} required value={f.nombre} onChange={set('nombre')} placeholder="Como aparecerá en el colegio" />
        </CampoOscuro>
        {!session && (
          <>
            <CampoOscuro etiqueta="Correo electrónico">
              <input className={claseInputOscuro} type="email" required autoComplete="email" value={f.correo} onChange={set('correo')} placeholder="tucorreo@ejemplo.com" />
            </CampoOscuro>
            <CampoOscuro etiqueta="Contraseña (mínimo 8 caracteres)">
              <input className={claseInputOscuro} type="password" required autoComplete="new-password" value={f.clave} onChange={set('clave')} placeholder="••••••••••" />
            </CampoOscuro>
          </>
        )}
        <BotonPrimario cargando={cargando}>
          <KeyRound className="h-[17px] w-[17px]" /> Canjear código y entrar
        </BotonPrimario>
      </form>

      <p className="mt-5 text-center text-[12.5px]" style={{ color: 'rgba(245,237,224,.45)' }}>
        <Link to="/login" className="text-amber-l font-semibold hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </AuthShell>
  )
}
