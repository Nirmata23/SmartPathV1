// Edge Function: resetear-pin
// El director (o un padre vinculado) reinicia el PIN de un estudiante (§21).
// Devuelve el PIN nuevo una sola vez.
import { createClient } from 'jsr:@supabase/supabase-js@2'
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

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: userData, error: userError } = await admin.auth.getUser(
      auth.replace('Bearer ', ''),
    )
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401)

    const { data: quien } = await admin
      .from('perfil')
      .select('id, colegio_id, rol')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!quien) return json({ error: 'Sin perfil' }, 403)

    const body = await req.json().catch(() => null)
    const estudianteId = (body?.estudiante_id ?? '').toString()
    if (!/^[0-9a-f-]{36}$/.test(estudianteId)) return json({ error: 'Estudiante inválido' }, 400)

    const { data: est } = await admin
      .from('estudiante')
      .select('id, colegio_id, perfil_id')
      .eq('id', estudianteId)
      .eq('colegio_id', quien.colegio_id)
      .maybeSingle()
    if (!est?.perfil_id) return json({ error: 'Ese estudiante no tiene acceso creado' }, 404)

    // Autorización: director del colegio, o padre vinculado al estudiante
    let autorizado = quien.rol === 'director'
    if (!autorizado && quien.rol === 'padre') {
      const { data: p } = await admin
        .from('parentesco')
        .select('id')
        .eq('padre_id', quien.id)
        .eq('estudiante_id', est.id)
        .maybeSingle()
      autorizado = !!p
    }
    if (!autorizado) return json({ error: 'No autorizado' }, 403)

    const pin = (crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).toString().padStart(6, '0')
    const { error } = await admin.auth.admin.updateUserById(est.perfil_id, { password: pin })
    if (error) return json({ error: 'No se pudo resetear el PIN' }, 500)

    await admin.from('auditoria').insert({
      colegio_id: est.colegio_id,
      actor_id: quien.id,
      accion: 'resetear_pin',
      entidad: 'estudiante',
      entidad_id: est.id,
    })

    return json({ pin }, 200)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
