import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarCheck2, GraduationCap, LayoutGrid, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'

async function contar(tabla: string) {
  const { count } = await supabase.from(tabla).select('id', { count: 'exact', head: true })
  return count ?? 0
}

// Dashboard del director: composición bento con datos REALES (§42, §43).
// Sin datos aún → estados vacíos con acciones, nunca cifras inventadas.
export function DirectorHome() {
  const { perfil } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['director-resumen'],
    queryFn: async () => {
      const hoy = new Date().toISOString().slice(0, 10)
      const [estudiantes, docentes, secciones, asistenciaHoy] = await Promise.all([
        contar('estudiante'),
        supabase
          .from('perfil')
          .select('id', { count: 'exact', head: true })
          .eq('rol', 'docente')
          .then((r) => r.count ?? 0),
        contar('seccion'),
        supabase
          .from('v_asistencia_diaria')
          .select('pct_presente, presentes, total')
          .eq('fecha', hoy)
          .maybeSingle()
          .then((r) => r.data),
      ])
      return { estudiantes, docentes, secciones, asistenciaHoy }
    },
  })

  const kpis = [
    { Icono: GraduationCap, etiqueta: 'Estudiantes', valor: data?.estudiantes },
    { Icono: Users, etiqueta: 'Docentes', valor: data?.docentes },
    { Icono: LayoutGrid, etiqueta: 'Secciones', valor: data?.secciones },
  ]

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Buen día, <em className="text-amber-d italic">{perfil?.nombre.split(' ')[0]}</em>
          </>
        }
        sub="Este es el pulso de tu colegio hoy."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pieza protagonista: asistencia de hoy */}
        <Tarjeta className="sm:col-span-2 lg:row-span-2 lg:flex lg:flex-col lg:justify-between">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
            <CalendarCheck2 className="h-4 w-4 text-amber" /> Asistencia de hoy
          </div>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-cream-2" />
          ) : data?.asistenciaHoy ? (
            <div>
              <div className="font-display text-6xl tracking-tight">
                {Math.round((data.asistenciaHoy.pct_presente ?? 0) * 100)}
                <span className="text-2xl text-muted">%</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {data.asistenciaHoy.presentes} de {data.asistenciaHoy.total} estudiantes presentes
              </p>
            </div>
          ) : (
            <EstadoVacio
              titulo="Aún no hay asistencia registrada hoy"
              texto="Cuando tus docentes pasen lista, verás aquí el porcentaje del colegio en tiempo real."
            />
          )}
        </Tarjeta>

        {kpis.map(({ Icono, etiqueta, valor }) => (
          <Tarjeta key={etiqueta}>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted uppercase">
              <Icono className="h-4 w-4 text-amber" /> {etiqueta}
            </div>
            {isLoading ? (
              <div className="h-10 w-16 animate-pulse rounded-lg bg-cream-2" />
            ) : (
              <div className="font-display text-4xl tracking-tight">{valor ?? 0}</div>
            )}
          </Tarjeta>
        ))}

        <Tarjeta className="sm:col-span-2 lg:col-span-1">
          <div className="mb-3 font-mono text-[11px] tracking-widest text-muted uppercase">
            Siguiente paso
          </div>
          <p className="text-sm text-muted">
            {data && data.estudiantes === 0
              ? 'Crea la estructura del colegio e invita a tu gente con códigos.'
              : 'Gestiona grados, secciones e invitaciones desde Colegio y Personas.'}
          </p>
          <Link
            to="/director/personas"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-amber px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Invitar personas
          </Link>
        </Tarjeta>
      </div>
    </>
  )
}
