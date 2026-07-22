import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  LogOut,
  Megaphone,
  School,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { PixelAvatar } from '../components/PixelAvatar'
import type { Rol } from '../types/db'

interface ItemNav {
  a: string
  etiqueta: string
  Icono: LucideIcon
}

// Mapa de navegación por rol (§23). Las secciones aún no construidas
// llegarán en las siguientes fases; el menú crece con ellas.
const NAV: Record<Rol, ItemNav[]> = {
  director: [
    { a: '/director', etiqueta: 'Inicio', Icono: Home },
    { a: '/director/colegio', etiqueta: 'Colegio', Icono: School },
    { a: '/director/personas', etiqueta: 'Personas', Icono: Users },
    { a: '/director/academico', etiqueta: 'Académico', Icono: BookOpenCheck },
    { a: '/director/cobros', etiqueta: 'Cobros', Icono: Wallet },
    { a: '/director/calendario', etiqueta: 'Calendario', Icono: CalendarDays },
    { a: '/director/comunicados', etiqueta: 'Comunicados', Icono: Megaphone },
  ],
  docente: [
    { a: '/docente', etiqueta: 'Inicio', Icono: Home },
    { a: '/docente/asistencia', etiqueta: 'Asistencia', Icono: CalendarCheck2 },
    { a: '/docente/calificaciones', etiqueta: 'Calificaciones', Icono: ClipboardList },
    { a: '/docente/calendario', etiqueta: 'Calendario', Icono: CalendarDays },
    { a: '/docente/comunicados', etiqueta: 'Comunicados', Icono: Megaphone },
  ],
  padre: [
    { a: '/padre', etiqueta: 'Inicio', Icono: Home },
    { a: '/padre/notas', etiqueta: 'Notas', Icono: ClipboardList },
    { a: '/padre/asistencia', etiqueta: 'Asistencia', Icono: CalendarCheck2 },
    { a: '/padre/pagos', etiqueta: 'Pagos', Icono: Wallet },
    { a: '/padre/calendario', etiqueta: 'Calendario', Icono: CalendarDays },
    { a: '/padre/comunicados', etiqueta: 'Comunicados', Icono: Megaphone },
  ],
  estudiante: [
    { a: '/estudiante', etiqueta: 'Inicio', Icono: Home },
    { a: '/estudiante/tareas', etiqueta: 'Tareas', Icono: ClipboardList },
    { a: '/estudiante/logros', etiqueta: 'Logros', Icono: Trophy },
    { a: '/estudiante/calendario', etiqueta: 'Calendario', Icono: CalendarDays },
    { a: '/estudiante/comunicados', etiqueta: 'Comunicados', Icono: Megaphone },
    { a: '/estudiante/avatar', etiqueta: 'Mi avatar', Icono: Sparkles },
  ],
}

const TITULO_ROL: Record<Rol, string> = {
  director: 'Dirección',
  docente: 'Docente',
  padre: 'Familia',
  estudiante: 'Estudiante',
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { perfil, salir } = useAuth()
  const nav = useNavigate()
  if (!perfil) return null
  const items = NAV[perfil.rol]

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Barra lateral */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-borde bg-white/60 px-4 py-6 backdrop-blur md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: 'linear-gradient(135deg,#e07b00,#f7a927)' }}
          >
            <GraduationCap className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">SmartPath</div>
            <div className="mt-1 font-mono text-[10px] tracking-widest text-muted uppercase">
              {TITULO_ROL[perfil.rol]}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ a, etiqueta, Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a.split('/').length === 2}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  isActive ? 'bg-amber/10 text-amber-d' : 'text-muted hover:bg-cream-2 hover:text-ink'
                }`
              }
            >
              <Icono className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{etiqueta}</span>
            </NavLink>
          ))}
        </nav>
        <button
          onClick={async () => {
            await salir()
            nav('/login', { replace: true })
          }}
          className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-cream-2 hover:text-ink"
        >
          <LogOut className="h-[18px] w-[18px]" /> Cerrar sesión
        </button>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-60">
        <header className="sticky top-0 z-[5] flex h-16 items-center justify-between border-b border-borde bg-cream/85 px-5 backdrop-blur md:px-8">
          <div className="font-mono text-[11px] tracking-widest text-muted-2 uppercase">
            {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div className="flex items-center gap-3">
            <div className="max-w-[180px] truncate text-right text-sm font-semibold">{perfil.nombre}</div>
            <PixelAvatar seed={perfil.avatar_seed ?? perfil.nombre} codigoPixel={perfil.avatar_pixel} tamano={36} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  )
}

export function EncabezadoPagina({ titulo, sub }: { titulo: ReactNode; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[32px] leading-tight tracking-tight">{titulo}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  )
}

export function Tarjeta({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-borde bg-white p-6 shadow-[0_2px_8px_rgba(12,11,9,.05)] ${className}`}>
      {children}
    </div>
  )
}

export function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string
  texto: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div
        className="mb-2 h-16 w-16 rounded-2xl"
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: `<svg viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${[
            [30, 20], [40, 10], [50, 20], [60, 10], [70, 20],
            [20, 30], [35, 35], [55, 35], [75, 35], [80, 30],
            [30, 50], [45, 55], [55, 50], [65, 55], [70, 50],
            [40, 70], [55, 75], [60, 70],
          ]
            .map(([x, y], i) => `<rect x="${x}" y="${y}" width="8" height="8" fill="${i % 3 === 0 ? '#e07b00' : i % 3 === 1 ? '#f7a927' : '#e8e0d4'}"/>`)
            .join('')}</svg>`,
        }}
      />
      <div className="text-[15px] font-semibold">{titulo}</div>
      <p className="max-w-sm text-sm text-muted">{texto}</p>
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  )
}
