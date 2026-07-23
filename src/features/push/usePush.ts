import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

type Estado = 'no-soportado' | 'sin-permiso' | 'activo' | 'ocupado'

// Hook de Web Push (§37.2): registra el service worker, pide permiso y guarda la
// suscripción del navegador en push_sub. Sin llaves VAPID configuradas, se
// reporta como no soportado (degrada con elegancia).
export function usePush() {
  const { perfil } = useAuth()
  const [estado, setEstado] = useState<Estado>('sin-permiso')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC) {
      setEstado('no-soportado')
      return
    }
    navigator.serviceWorker.register('/sw.js').catch(() => setEstado('no-soportado'))
    if (Notification.permission === 'granted') setEstado('activo')
  }, [])

  async function activar(): Promise<string | null> {
    if (estado === 'no-soportado' || !perfil) return 'Notificaciones no disponibles en este navegador'
    setEstado('ocupado')
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado('sin-permiso')
        return 'Permiso de notificaciones denegado'
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC!) as BufferSource,
      })
      const json = sub.toJSON()
      const { error } = await supabase.from('push_sub').upsert(
        {
          colegio_id: perfil.colegio_id,
          user_id: perfil.id,
          endpoint: json.endpoint!,
          sub: json,
        },
        { onConflict: 'user_id,endpoint' },
      )
      if (error) {
        setEstado('sin-permiso')
        return 'No se pudo guardar la suscripción'
      }
      setEstado('activo')
      return null
    } catch (_e) {
      setEstado('sin-permiso')
      return 'No se pudo activar las notificaciones'
    }
  }

  return { estado, activar }
}
