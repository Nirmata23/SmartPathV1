// Edge Function: enviar-push
// Envía una notificación Web Push a los miembros del colegio (§37.2). Solo el
// director (o docente para su sección) la invoca. Las llaves VAPID viven en
// variables de entorno del servidor (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY),
// nunca en el cliente ni en el repo.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'Web Push no configurado (faltan llaves VAPID)' }, 503)

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: userData, error: userError } = await admin.auth.getUser(auth.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401)

    const { data: quien } = await admin
      .from('perfil')
      .select('id, colegio_id, rol')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!quien || (quien.rol !== 'director' && quien.rol !== 'docente'))
      return json({ error: 'No autorizado' }, 403)

    const body = await req.json().catch(() => null)
    const titulo = (body?.titulo ?? '').toString().slice(0, 100)
    const cuerpo = (body?.cuerpo ?? '').toString().slice(0, 300)
    const url = (body?.url ?? '/').toString().slice(0, 200)
    if (titulo.length < 2) return json({ error: 'Título requerido' }, 400)

    webpush.setVapidDetails('mailto:notificaciones@smartpath.app', VAPID_PUBLIC, VAPID_PRIVATE)

    // suscripciones del colegio (todas; una segmentación fina puede añadirse luego)
    const { data: subs } = await admin
      .from('push_sub')
      .select('id, sub')
      .eq('colegio_id', quien.colegio_id)

    const payload = JSON.stringify({ title: titulo, body: cuerpo, url })
    let enviados = 0
    const muertas: string[] = []
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.sub, payload)
        enviados++
      } catch (e) {
        // 404/410 = suscripción caducada: limpiar
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) muertas.push(s.id)
      }
    }
    if (muertas.length > 0) await admin.from('push_sub').delete().in('id', muertas)

    return json({ enviados, limpiadas: muertas.length }, 200)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
