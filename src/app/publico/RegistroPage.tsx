import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
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
  nombreDirector: z.string().trim().min(3, 'Tu nombre debe tener al menos 3 caracteres').max(120),
  correo: z.string().email('Correo inválido'),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  nombreColegio: z.string().trim().min(3, 'El nombre del colegio debe tener al menos 3 caracteres').max(120),
  pais: z.string().length(2),
  moneda: z.string().length(3),
})

// Registro self-service del director (§4): cuenta + colegio en una sola pantalla.
// La creación real ocurre en la Edge Function crear-colegio (validación en servidor).
export function RegistroPage() {
  const nav = useNavigate()
  const { session, refrescarPerfil } = useAuth()
  const [f, setF] = useState({
    nombreDirector: '',
    correo: '',
    clave: '',
    nombreColegio: '',
    pais: 'GT',
    moneda: 'GTQ',
  })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value })

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = esquema.safeParse(f)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setCargando(true)
    try {
      // 1) sesión: usa la actual o crea la cuenta
      if (!session) {
        const { data, error: e1 } = await supabase.auth.signUp({
          email: parsed.data.correo,
          password: parsed.data.clave,
        })
        if (e1) throw new Error(
          e1.message.includes('already registered')
            ? 'Ese correo ya tiene cuenta. Inicia sesión y vuelve aquí para registrar tu colegio.'
            : 'No se pudo crear la cuenta.',
        )
        if (!data.session) {
          // el proyecto exige confirmación de correo
          setAviso(
            'Te enviamos un correo de confirmación. Confírmalo, inicia sesión y el sistema te traerá de vuelta para terminar de registrar tu colegio.',
          )
          setCargando(false)
          return
        }
      }
      // 2) crear colegio + perfil director (servidor)
      await invocarFuncion('crear-colegio', {
        nombre: parsed.data.nombreColegio,
        nombreDirector: parsed.data.nombreDirector,
        pais: parsed.data.pais,
        moneda: parsed.data.moneda,
      })
      await refrescarPerfil()
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthShell ancho={440}>
      <LogoSmartPath />
      <h1 className="font-display mb-1.5 text-[28px] leading-tight tracking-tight">
        Registra tu <em className="text-amber-l italic">colegio</em>
      </h1>
      <p className="mb-6 text-[13.5px]" style={{ color: 'rgba(245,237,224,.5)' }}>
        Crea la cuenta del director y el colegio queda operativo en minutos.
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

      <form onSubmit={registrar}>
        <CampoOscuro etiqueta="Tu nombre completo">
          <input className={claseInputOscuro} required value={f.nombreDirector} onChange={set('nombreDirector')} placeholder="Nombre del director o directora" />
        </CampoOscuro>
        {!session && (
          <>
            <CampoOscuro etiqueta="Correo electrónico">
              <input className={claseInputOscuro} type="email" required autoComplete="email" value={f.correo} onChange={set('correo')} placeholder="tucorreo@colegio.edu.gt" />
            </CampoOscuro>
            <CampoOscuro etiqueta="Contraseña (mínimo 8 caracteres)">
              <input className={claseInputOscuro} type="password" required autoComplete="new-password" value={f.clave} onChange={set('clave')} placeholder="••••••••••" />
            </CampoOscuro>
          </>
        )}
        <CampoOscuro etiqueta="Nombre del colegio">
          <input className={claseInputOscuro} required value={f.nombreColegio} onChange={set('nombreColegio')} placeholder="Colegio Ejemplo" />
        </CampoOscuro>

        <div className="grid grid-cols-2 gap-3">
          <CampoOscuro etiqueta="País">
            <select className={claseInputOscuro} value={f.pais} onChange={set('pais')}>
              <option value="GT">Guatemala</option>
              <option value="SV">El Salvador</option>
              <option value="HN">Honduras</option>
              <option value="MX">México</option>
              <option value="US">Estados Unidos</option>
            </select>
          </CampoOscuro>
          <CampoOscuro etiqueta="Moneda">
            <select className={claseInputOscuro} value={f.moneda} onChange={set('moneda')}>
              <option value="GTQ">Quetzal (GTQ)</option>
              <option value="USD">Dólar (USD)</option>
              <option value="MXN">Peso (MXN)</option>
            </select>
          </CampoOscuro>
        </div>

        <BotonPrimario cargando={cargando}>
          <Building2 className="h-[17px] w-[17px]" /> Registrar colegio
        </BotonPrimario>
      </form>

      <p className="mt-5 text-center text-[12.5px]" style={{ color: 'rgba(245,237,224,.45)' }}>
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-amber-l font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  )
}
