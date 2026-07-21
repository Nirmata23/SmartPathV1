// Edge Function: canjear-invitacion
// Canje de códigos de un solo uso (§4). El reclamo es atómico: UPDATE ... WHERE
// usado = false AND expira_en > now() — dos canjes simultáneos no pueden ganar
// los dos. Crea el perfil con el rol del código y los vínculos que traiga
// (parentesco para padres, registro estudiante para alumnos).
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
    const user = userData.user

    const body = await req.json().catch(() => null)
    const codigo = (body?.codigo ?? '').toString().trim().toUpperCase()
    const nombre = (body?.nombre ?? '').toString().trim()
    if (!/^[A-Z0-9-]{6,40}$/.test(codigo)) return json({ error: 'Código inválido' }, 400)
    if (nombre.length < 3 || nombre.length > 120)
      return json({ error: 'Nombre inválido (3–120 caracteres)' }, 400)

    const { data: existente } = await admin
      .from('perfil').select('id').eq('id', user.id).maybeSingle()
    if (existente) return json({ error: 'Este usuario ya tiene un perfil' }, 409)

    // Reclamo atómico del código (un solo uso, sin carreras)
    const { data: inv, error: invError } = await admin
      .from('invitacion')
      .update({ usado: true })
      .eq('codigo', codigo)
      .eq('usado', false)
      .gt('expira_en', new Date().toISOString())
      .select('id, colegio_id, rol, datos')
      .maybeSingle()
    if (invError || !inv) return json({ error: 'Código inválido, usado o vencido' }, 400)

    const rollback = async () => {
      await admin.from('invitacion').update({ usado: false, usado_por: null }).eq('id', inv.id)
    }

    const { error: perfilError } = await admin.from('perfil').insert({
      id: user.id,
      colegio_id: inv.colegio_id,
      rol: inv.rol,
      nombre,
      correo: user.email,
    })
    if (perfilError) {
      await rollback()
      return json({ error: 'No se pudo crear el perfil' }, 500)
    }
    await admin.from('invitacion').update({ usado_por: user.id }).eq('id', inv.id)

    // Vínculos según el rol del código
    if (inv.rol === 'padre' && Array.isArray(inv.datos?.estudiante_ids)) {
      const filas = inv.datos.estudiante_ids.map((eid: string) => ({
        colegio_id: inv.colegio_id,
        padre_id: user.id,
        estudiante_id: eid,
      }))
      const { error } = await admin.from('parentesco').insert(filas)
      if (error) {
        await admin.from('perfil').delete().eq('id', user.id)
        await rollback()
        return json({ error: 'No se pudo vincular con el/los estudiante(s)' }, 500)
      }
    }
    if (inv.rol === 'estudiante' && inv.datos?.estudiante_id) {
      const { error } = await admin
        .from('estudiante')
        .update({ perfil_id: user.id })
        .eq('id', inv.datos.estudiante_id)
        .eq('colegio_id', inv.colegio_id)
        .is('perfil_id', null)
      if (error) {
        await admin.from('perfil').delete().eq('id', user.id)
        await rollback()
        return json({ error: 'No se pudo vincular el registro de estudiante' }, 500)
      }
    }

    await admin.from('auditoria').insert({
      colegio_id: inv.colegio_id,
      actor_id: user.id,
      accion: 'canjear_invitacion',
      entidad: 'invitacion',
      entidad_id: inv.id,
      detalle: { rol: inv.rol },
    })

    return json({ colegio_id: inv.colegio_id, rol: inv.rol }, 200)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
