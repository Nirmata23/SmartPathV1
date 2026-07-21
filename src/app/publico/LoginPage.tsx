import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  AuthShell,
  BotonPrimario,
  CampoOscuro,
  LogoSmartPath,
  MensajeError,
  claseInputOscuro,
} from './AuthShell'

// Los estudiantes entran con usuario + PIN (§21); internamente se traduce a un
// correo sintético que ellos nunca ven.
const DOMINIO_ESTUDIANTE = 'est.smartpath.app'

export function LoginPage() {
  const nav = useNavigate()
  const [modo, setModo] = useState<'correo' | 'estudiante'>('correo')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const credenciales =
      modo === 'estudiante'
        ? { email: `${usuario.trim().toLowerCase()}@${DOMINIO_ESTUDIANTE}`, password: pin.trim() }
        : { email: correo, password: clave }
    const { error } = await supabase.auth.signInWithPassword(credenciales)
    setCargando(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? modo === 'estudiante'
            ? 'Usuario o PIN incorrectos. Pide a tu colegio que reinicie tu PIN si lo olvidaste.'
            : 'Correo o contraseña incorrectos.'
          : 'No se pudo iniciar sesión. Intenta de nuevo.',
      )
      return
    }
    nav('/', { replace: true })
  }

  return (
    <AuthShell>
      <LogoSmartPath />
      <h1 className="font-display mb-1.5 text-3xl leading-tight tracking-tight">
        Bienvenido <em className="text-amber-l italic">de nuevo</em>
      </h1>
      <p className="mb-6 text-[13.5px]" style={{ color: 'rgba(245,237,224,.5)' }}>
        Ingresa a la plataforma de tu colegio.
      </p>

      <MensajeError texto={error} />

      <div className="mb-4 flex gap-1.5 rounded-[13px] p-1" style={{ background: 'rgba(245,237,224,.06)' }}>
        {(
          [
            ['correo', 'Con correo'],
            ['estudiante', 'Soy estudiante'],
          ] as const
        ).map(([id, txt]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setModo(id); setError(null) }}
            className="h-10 flex-1 rounded-[10px] text-[13px] font-bold transition-colors"
            style={
              modo === id
                ? { background: 'rgba(245,237,224,.14)', color: '#faf8f4' }
                : { color: 'rgba(245,237,224,.45)' }
            }
          >
            {txt}
          </button>
        ))}
      </div>

      <form onSubmit={entrar}>
        {modo === 'estudiante' ? (
          <>
            <CampoOscuro etiqueta="Usuario (te lo dio tu colegio)">
              <input
                required
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="dbarrios0421"
                className={`${claseInputOscuro} font-mono`}
              />
            </CampoOscuro>
            <CampoOscuro etiqueta="PIN">
              <input
                type="password"
                required
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className={`${claseInputOscuro} font-mono tracking-widest`}
              />
            </CampoOscuro>
            <BotonPrimario cargando={cargando}>
              Entrar <ArrowRight className="h-[17px] w-[17px]" />
            </BotonPrimario>
          </>
        ) : (
          <>
        <CampoOscuro etiqueta="Correo electrónico">
          <div className="relative">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 h-[17px] w-[17px] -translate-y-1/2"
              style={{ color: 'rgba(245,237,224,.4)' }}
            />
            <input
              type="email"
              required
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tucorreo@colegio.edu.gt"
              className={`${claseInputOscuro} pl-[42px]`}
            />
          </div>
        </CampoOscuro>

        <CampoOscuro etiqueta="Contraseña">
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 h-[17px] w-[17px] -translate-y-1/2"
              style={{ color: 'rgba(245,237,224,.4)' }}
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="••••••••••"
              className={`${claseInputOscuro} pl-[42px]`}
            />
          </div>
        </CampoOscuro>

        <div className="mt-1 mb-5 text-right">
          <button
            type="button"
            className="text-amber-l text-[12.5px] font-semibold hover:underline"
            onClick={async () => {
              if (!correo) {
                setError('Escribe tu correo y vuelve a tocar "¿Olvidaste tu contraseña?"')
                return
              }
              await supabase.auth.resetPasswordForEmail(correo)
              setError(null)
              alert('Si el correo existe, recibirás un enlace para restablecer tu contraseña.')
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <BotonPrimario cargando={cargando}>
          Iniciar sesión <ArrowRight className="h-[17px] w-[17px]" />
        </BotonPrimario>
          </>
        )}
      </form>

      <div
        className="my-5 flex items-center gap-3 text-[11px] tracking-widest uppercase"
        style={{ color: 'rgba(245,237,224,.35)' }}
      >
        <span className="h-px flex-1" style={{ background: 'rgba(245,237,224,.12)' }} />
        o
        <span className="h-px flex-1" style={{ background: 'rgba(245,237,224,.12)' }} />
      </div>

      <Link
        to="/codigo"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[13px] border text-[13.5px] font-bold transition-colors hover:bg-[rgba(245,237,224,.09)]"
        style={{ borderColor: 'rgba(245,237,224,.16)', background: 'rgba(245,237,224,.04)' }}
      >
        <QrCode className="h-4 w-4" /> Entrar con código de invitación
      </Link>

      <div className="mt-4 flex justify-center gap-1.5">
        {(['DIRECTOR', 'DOCENTE', 'PADRE', 'ESTUDIANTE'] as const).map((r) => (
          <span
            key={r}
            className="rounded-[5px] border px-[7px] py-[3px] font-mono text-[9.5px]"
            style={{ color: 'rgba(245,237,224,.4)', borderColor: 'rgba(245,237,224,.12)' }}
          >
            {r}
          </span>
        ))}
      </div>

      <p className="mt-5 text-center text-[12.5px]" style={{ color: 'rgba(245,237,224,.45)' }}>
        ¿Tu colegio aún no usa SmartPath?{' '}
        <Link to="/registro" className="text-amber-l font-semibold hover:underline">
          Regístralo
        </Link>
      </p>
    </AuthShell>
  )
}
