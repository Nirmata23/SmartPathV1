import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'
import type { Rol } from './types/db'
import { LoginPage } from './app/publico/LoginPage'
import { RegistroPage } from './app/publico/RegistroPage'
import { CodigoPage } from './app/publico/CodigoPage'
import { AppLayout } from './app/AppLayout'
import { DirectorHome } from './app/director/DirectorHome'
import { DocenteHome } from './app/docente/DocenteHome'
import { PadreHome } from './app/padre/PadreHome'
import { EstudianteHome } from './app/estudiante/EstudianteHome'

function PantallaCarga() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="font-mono text-xs tracking-widest text-muted uppercase">Cargando…</div>
    </div>
  )
}

// Redirección por rol tras autenticar (§21): un solo login → panel del rol.
function InicioSegunRol() {
  const { cargando, session, perfil } = useAuth()
  if (cargando) return <PantallaCarga />
  if (!session) return <Navigate to="/login" replace />
  // autenticado pero sin perfil: le falta registrar colegio o canjear código
  if (!perfil) return <Navigate to="/codigo" replace />
  return <Navigate to={`/${perfil.rol}`} replace />
}

// Guard de ruta por rol. La UI solo decide qué pintar: los DATOS los protege
// la RLS en el servidor — forzar la URL de otro rol no muestra nada ajeno.
function RequiereRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { cargando, session, perfil } = useAuth()
  const loc = useLocation()
  if (cargando) return <PantallaCarga />
  if (!session) return <Navigate to="/login" replace state={{ de: loc.pathname }} />
  if (!perfil) return <Navigate to="/codigo" replace />
  if (perfil.rol !== rol) return <Navigate to={`/${perfil.rol}`} replace />
  return <AppLayout>{children}</AppLayout>
}

function EnConstruccion({ nombre }: { nombre: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-white p-10 text-center shadow-[0_2px_8px_rgba(12,11,9,.05)]">
      <div className="font-display text-2xl">{nombre}</div>
      <p className="mt-2 text-sm text-muted">
        Esta sección llega en la siguiente fase del MVP.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioSegunRol />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/codigo" element={<CodigoPage />} />

      <Route path="/director" element={<RequiereRol rol="director"><DirectorHome /></RequiereRol>} />
      <Route path="/director/colegio" element={<RequiereRol rol="director"><EnConstruccion nombre="Colegio" /></RequiereRol>} />
      <Route path="/director/personas" element={<RequiereRol rol="director"><EnConstruccion nombre="Personas" /></RequiereRol>} />
      <Route path="/director/academico" element={<RequiereRol rol="director"><EnConstruccion nombre="Académico" /></RequiereRol>} />

      <Route path="/docente" element={<RequiereRol rol="docente"><DocenteHome /></RequiereRol>} />
      <Route path="/docente/asistencia" element={<RequiereRol rol="docente"><EnConstruccion nombre="Asistencia" /></RequiereRol>} />
      <Route path="/docente/calificaciones" element={<RequiereRol rol="docente"><EnConstruccion nombre="Calificaciones" /></RequiereRol>} />

      <Route path="/padre" element={<RequiereRol rol="padre"><PadreHome /></RequiereRol>} />
      <Route path="/padre/notas" element={<RequiereRol rol="padre"><EnConstruccion nombre="Notas" /></RequiereRol>} />
      <Route path="/padre/asistencia" element={<RequiereRol rol="padre"><EnConstruccion nombre="Asistencia" /></RequiereRol>} />

      <Route path="/estudiante" element={<RequiereRol rol="estudiante"><EstudianteHome /></RequiereRol>} />
      <Route path="/estudiante/tareas" element={<RequiereRol rol="estudiante"><EnConstruccion nombre="Tareas" /></RequiereRol>} />
      <Route path="/estudiante/avatar" element={<RequiereRol rol="estudiante"><EnConstruccion nombre="Mi avatar" /></RequiereRol>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
