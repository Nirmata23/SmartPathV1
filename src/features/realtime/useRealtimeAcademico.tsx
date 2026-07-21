import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// Suscripción Realtime a notas y asistencia (§37.1). Postgres Changes respeta
// la RLS: cada usuario solo recibe eventos de filas que puede ver. Al llegar
// un cambio, se invalidan las queries indicadas y la vista se refresca sola.
export function useRealtimeAcademico(queryKeys: string[]) {
  const qc = useQueryClient()
  useEffect(() => {
    const canal = supabase
      .channel('academico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calificacion' }, () => {
        for (const k of queryKeys) qc.invalidateQueries({ queryKey: [k] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => {
        for (const k of queryKeys) qc.invalidateQueries({ queryKey: [k] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
