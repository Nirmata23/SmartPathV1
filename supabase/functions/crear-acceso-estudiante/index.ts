// Edge Function: crear-acceso-estudiante
// El director genera el acceso de un estudiante SIN correo (§21): usuario + PIN.
// Internamente se crea una cuenta con correo sintético que el estudiante nunca ve.
// Solo el director del colegio del estudiante puede llamarla. El PIN se devuelve
// UNA vez (para imprimir/entregar); después solo se puede resetear.
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

const DOMINIO = 'est.smartpath.app'

function normalizar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()
}

function generarUsuario(nombre: string): string {
  const partes = normalizar(nombre).split(/\s+/)
  const base = (partes[0]?.[0] ?? 'e') + (partes[1] ?? partes[0] ?? 'est').slice(0, 8)
  const num = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
  return `${base}${num.toString().padStart(4, '0')}`
}

function generarPin(): string {
  return (crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).toString().padStart(6, '0')
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

    // El que llama debe ser DIRECTOR
    const { data: quien } = await admin
      .from('perfil')
      .select('colegio_id, rol')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!quien || quien.rol !== 'director') return json({ error: 'Solo el director puede hacer esto' }, 403)

    const body = await req.json().catch(() => null)
    const estudianteId = (body?.estudiante_id ?? '').toString()
    if (!/^[0-9a-f-]{36}$/.test(estudianteId)) return json({ error: 'Estudiante inválido' }, 400)

    // ...y del MISMO colegio que el estudiante
    const { data: est } = await admin
      .from('estudiante')
      .select('id, colegio_id, nombre, perfil_id')
      .eq('id', estudianteId)
      .eq('colegio_id', quien.colegio_id)
      .maybeSingle()
    if (!est) return json({ error: 'Estudiante no encontrado en tu colegio' }, 404)
    if (est.perfil_id) return json({ error: 'Este estudiante ya tiene acceso. Usa "Resetear PIN".' }, 409)

    const pin = generarPin()
    let usuario = ''
    let creado: { user: { id: string } } | null = null
    for (let intento = 0; intento < 5 && !creado; intento++) {
      usuario = generarUsuario(est.nombre)
      const { data, error } = await admin.auth.admin.createUser({
        email: `${usuario}@${DOMINIO}`,
        password: pin,
        email_confirm: true,
        user_metadata: { tipo: 'estudiante' },
      })
      if (!error && data?.user) creado = data as { user: { id: string } }
    }
    if (!creado) return json({ error: 'No se pudo generar un usuario único, intenta de nuevo' }, 500)

    const uid = creado.user.id
    const { error: perfilError } = await admin.from('perfil').insert({
      id: uid,
      colegio_id: est.colegio_id,
      rol: 'estudiante',
      nombre: est.nombre,
      avatar_seed: est.nombre,
    })
    if (perfilError) {
      await admin.auth.admin.deleteUser(uid)
      return json({ error: 'No se pudo crear el perfil del estudiante' }, 500)
    }
    const { error: linkError } = await admin
      .from('estudiante')
      .update({ perfil_id: uid, carne: usuario })
      .eq('id', est.id)
    if (linkError) {
      await admin.from('perfil').delete().eq('id', uid)
      await admin.auth.admin.deleteUser(uid)
      return json({ error: 'No se pudo vincular el acceso' }, 500)
    }

    await admin.from('auditoria').insert({
      colegio_id: est.colegio_id,
      actor_id: userData.user.id,
      accion: 'crear_acceso_estudiante',
      entidad: 'estudiante',
      entidad_id: est.id,
      detalle: { usuario },
    })

    return json({ usuario, pin }, 201)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
