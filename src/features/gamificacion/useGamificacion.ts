import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export interface EstadoJuego {
  estudianteId: string | null
  xpTotal: number
  nivel: number
  xpNivelActual: number
  xpParaSiguiente: number
  racha: number
  mejorRacha: number
  logros: { clave: string; obtenido_en: string }[]
}

// nivel = floor(sqrt(xp/100)) + 1  → XP para nivel n = 100*(n-1)^2
export function xpParaNivel(nivel: number): number {
  return 100 * (nivel - 1) * (nivel - 1)
}
export function nivelDesdeXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(xp, 0) / 100)) + 1)
}

export function useGamificacion() {
  const { perfil } = useAuth()
  return useQuery<EstadoJuego>({
    queryKey: ['gamificacion'],
    queryFn: async () => {
      const { data: yo } = await supabase
        .from('estudiante')
        .select('id')
        .eq('perfil_id', perfil!.id)
        .maybeSingle()
      if (!yo) {
        return { estudianteId: null, xpTotal: 0, nivel: 1, xpNivelActual: 0, xpParaSiguiente: 100, racha: 0, mejorRacha: 0, logros: [] }
      }
      const [xp, r, logros] = await Promise.all([
        supabase.from('xp_evento').select('puntos').eq('estudiante_id', yo.id),
        supabase.from('racha').select('dias, mejor_racha').eq('estudiante_id', yo.id).maybeSingle(),
        supabase.from('logro').select('clave, obtenido_en').eq('estudiante_id', yo.id),
      ])
      const xpTotal = (xp.data ?? []).reduce((s, x) => s + x.puntos, 0)
      const nivel = nivelDesdeXp(xpTotal)
      const base = xpParaNivel(nivel)
      const siguiente = xpParaNivel(nivel + 1)
      return {
        estudianteId: yo.id,
        xpTotal,
        nivel,
        xpNivelActual: xpTotal - base,
        xpParaSiguiente: siguiente - base,
        racha: r.data?.dias ?? 0,
        mejorRacha: r.data?.mejor_racha ?? 0,
        logros: (logros.data ?? []) as { clave: string; obtenido_en: string }[],
      }
    },
  })
}
