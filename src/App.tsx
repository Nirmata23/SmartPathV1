import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'
import type { Rol } from './types/db'
import { LoginPage } from './app/publico/LoginPage'
import { RegistroPage } from './app/publico/RegistroPage'
import { CodigoPage } from './app/publico/CodigoPage'
import { AppLayout } from './app/AppLayout'
import { DirectorHome } from './app/director/DirectorHome'
import { ColegioPage } from './app/director/ColegioPage'
import { PersonasPage } from './app/director/PersonasPage'
import { AcademicoPage } from './app/director/AcademicoPage'
import { DocenteHome } from './app/docente/DocenteHome'
import { AsistenciaPage } from './app/docente/AsistenciaPage'
import { CalificacionesPage } from './app/docente/CalificacionesPage'
import { PadreHome } from './app/padre/PadreHome'
import { NotasPage } from './app/padre/NotasPage'
import { AsistenciaHijosPage } from './app/padre/AsistenciaHijosPage'
import { EstudianteHome } from './app/estudiante/EstudianteHome'
import { TareasPage } from './app/estudiante/TareasPage'
import { AvatarPage } from './app/estudiante/AvatarPage'
import { CalendarioPage } from './app/compartido/CalendarioPage'
import { ComunicadosPage } from './app/compartido/ComunicadosPage'

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InicioSegunRol />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/codigo" element={<CodigoPage />} />

      <Route path="/director" element={<RequiereRol rol="director"><DirectorHome /></RequiereRol>} />
      <Route path="/director/colegio" element={<RequiereRol rol="director"><ColegioPage /></RequiereRol>} />
      <Route path="/director/personas" element={<RequiereRol rol="director"><PersonasPage /></RequiereRol>} />
      <Route path="/director/academico" element={<RequiereRol rol="director"><AcademicoPage /></RequiereRol>} />

      <Route path="/docente" element={<RequiereRol rol="docente"><DocenteHome /></RequiereRol>} />
      <Route path="/docente/asistencia" element={<RequiereRol rol="docente"><AsistenciaPage /></RequiereRol>} />
      <Route path="/docente/calificaciones" element={<RequiereRol rol="docente"><CalificacionesPage /></RequiereRol>} />

      <Route path="/padre" element={<RequiereRol rol="padre"><PadreHome /></RequiereRol>} />
      <Route path="/padre/notas" element={<RequiereRol rol="padre"><NotasPage /></RequiereRol>} />
      <Route path="/padre/asistencia" element={<RequiereRol rol="padre"><AsistenciaHijosPage /></RequiereRol>} />

      <Route path="/estudiante" element={<RequiereRol rol="estudiante"><EstudianteHome /></RequiereRol>} />
      <Route path="/estudiante/tareas" element={<RequiereRol rol="estudiante"><TareasPage /></RequiereRol>} />
      <Route path="/estudiante/avatar" element={<RequiereRol rol="estudiante"><AvatarPage /></RequiereRol>} />

      {(['director', 'docente', 'padre', 'estudiante'] as Rol[]).map((rol) => (
        <Route key={`cal-${rol}`} path={`/${rol}/calendario`} element={<RequiereRol rol={rol}><CalendarioPage /></RequiereRol>} />
      ))}
      {(['director', 'docente', 'padre', 'estudiante'] as Rol[]).map((rol) => (
        <Route key={`com-${rol}`} path={`/${rol}/comunicados`} element={<RequiereRol rol={rol}><ComunicadosPage /></RequiereRol>} />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
