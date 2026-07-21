import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Perfil } from '../../types/db'

interface AuthState {
  cargando: boolean
  session: Session | null
  perfil: Perfil | null
  refrescarPerfil: () => Promise<void>
  salir: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  async function cargarPerfil(s: Session | null) {
    if (!s) {
      setPerfil(null)
      return
    }
    const { data } = await supabase
      .from('perfil')
      .select('id, colegio_id, rol, nombre, correo, avatar_seed, avatar_pixel')
      .eq('id', s.user.id)
      .maybeSingle()
    setPerfil((data as Perfil) ?? null)
  }

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSession(data.session)
      await cargarPerfil(data.session)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, s) => {
      if (!activo) return
      setSession(s)
      await cargarPerfil(s)
      setCargando(false)
    })
    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        cargando,
        session,
        perfil,
        refrescarPerfil: async () => {
          const { data } = await supabase.auth.getSession()
          await cargarPerfil(data.session)
        },
        salir: async () => {
          await supabase.auth.signOut()
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
