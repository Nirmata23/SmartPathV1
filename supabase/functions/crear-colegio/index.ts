// Edge Function: crear-colegio
// Registro self-service del director (§4 Onboarding). Crea el colegio y el
// perfil director de forma atómica. Toda la validación ocurre aquí (servidor);
// el cliente no tiene política de INSERT sobre colegio ni perfil.
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

const PAISES = /^[A-Z]{2}$/
const MONEDAS = /^[A-Z]{3}$/

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
    const nombre = (body?.nombre ?? '').toString().trim()
    const nombreDirector = (body?.nombreDirector ?? '').toString().trim()
    const pais = (body?.pais ?? 'GT').toString().toUpperCase()
    const moneda = (body?.moneda ?? 'GTQ').toString().toUpperCase()
    const idioma = (body?.idioma ?? 'es').toString()
    const curriculo = (body?.curriculo ?? 'CNB').toString()

    if (nombre.length < 3 || nombre.length > 120)
      return json({ error: 'Nombre de colegio inválido (3–120 caracteres)' }, 400)
    if (nombreDirector.length < 3 || nombreDirector.length > 120)
      return json({ error: 'Nombre de director inválido (3–120 caracteres)' }, 400)
    if (!PAISES.test(pais)) return json({ error: 'País inválido (código ISO de 2 letras)' }, 400)
    if (!MONEDAS.test(moneda)) return json({ error: 'Moneda inválida (código ISO de 3 letras)' }, 400)
    if (!['es', 'en'].includes(idioma)) return json({ error: 'Idioma inválido' }, 400)
    if (!['CNB', 'internacional'].includes(curriculo)) return json({ error: 'Currículo inválido' }, 400)

    // Un usuario solo puede pertenecer a un colegio (un perfil)
    const { data: existente } = await admin
      .from('perfil').select('id').eq('id', user.id).maybeSingle()
    if (existente) return json({ error: 'Este usuario ya tiene un perfil' }, 409)

    const { data: colegio, error: colegioError } = await admin
      .from('colegio')
      .insert({ nombre, pais, moneda, idioma, curriculo })
      .select('id, nombre')
      .single()
    if (colegioError) return json({ error: 'No se pudo crear el colegio' }, 500)

    const { error: perfilError } = await admin.from('perfil').insert({
      id: user.id,
      colegio_id: colegio.id,
      rol: 'director',
      nombre: nombreDirector,
      correo: user.email,
    })
    if (perfilError) {
      // rollback manual: sin perfil no debe quedar colegio huérfano
      await admin.from('colegio').delete().eq('id', colegio.id)
      return json({ error: 'No se pudo crear el perfil del director' }, 500)
    }

    await admin.from('auditoria').insert({
      colegio_id: colegio.id,
      actor_id: user.id,
      accion: 'crear_colegio',
      entidad: 'colegio',
      entidad_id: colegio.id,
      detalle: { nombre },
    })

    return json({ colegio_id: colegio.id, rol: 'director' }, 201)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
