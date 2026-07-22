// Edge Function: otorgar-xp
// Otorga XP SOLO desde el servidor (regla no negociable #3, §9 anti-abuso).
// El cliente pide "completé la meta X" o "reclamo mi XP de asistencia de hoy",
// y AQUÍ se verifica contra la base que la acción realmente ocurrió, antes de
// escribir xp_evento. El unique(estudiante_id,tipo,referencia) evita duplicados.
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

const PUNTOS = { meta: 20, asistencia: 10, tarea: 15 } as const
const LOGROS: { clave: string; nombre: string; xpMin: number }[] = [
  { clave: 'primer_paso', nombre: 'Primer paso', xpMin: 10 },
  { clave: 'aprendiz', nombre: 'Aprendiz', xpMin: 100 },
  { clave: 'constante', nombre: 'Constante', xpMin: 300 },
  { clave: 'imparable', nombre: 'Imparable', xpMin: 600 },
]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: userData, error: userError } = await admin.auth.getUser(auth.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401)

    // Solo un estudiante reclama SU propio XP
    const { data: est } = await admin
      .from('estudiante')
      .select('id, colegio_id, seccion_id')
      .eq('perfil_id', userData.user.id)
      .maybeSingle()
    if (!est) return json({ error: 'Solo los estudiantes ganan XP' }, 403)

    const body = await req.json().catch(() => null)
    const tipo = (body?.tipo ?? '').toString()
    const referencia = (body?.referencia ?? '').toString() || null

    let puntos = 0
    let refFinal: string | null = null

    if (tipo === 'meta') {
      // verifica que la meta exista, sea del estudiante y esté completada
      if (!referencia) return json({ error: 'Falta la meta' }, 400)
      const { data: meta } = await admin
        .from('meta')
        .select('id, completada')
        .eq('id', referencia)
        .eq('estudiante_id', est.id)
        .maybeSingle()
      if (!meta) return json({ error: 'Meta no encontrada' }, 404)
      if (!meta.completada) return json({ error: 'La meta aún no está completada' }, 400)
      puntos = PUNTOS.meta
      refFinal = meta.id
    } else if (tipo === 'asistencia') {
      // XP por estar presente HOY (verificado contra la tabla asistencia)
      const hoy = new Date().toISOString().slice(0, 10)
      const { data: asis } = await admin
        .from('asistencia')
        .select('id, estado')
        .eq('estudiante_id', est.id)
        .eq('fecha', hoy)
        .maybeSingle()
      if (!asis || (asis.estado !== 'presente' && asis.estado !== 'tardanza'))
        return json({ error: 'Aún no tienes asistencia registrada como presente hoy' }, 400)
      puntos = PUNTOS.asistencia
      refFinal = asis.id
    } else {
      return json({ error: 'Tipo de XP no válido' }, 400)
    }

    // Inserta el evento (idempotente por unique). Si ya existía, no duplica.
    const { error: xpError } = await admin.from('xp_evento').insert({
      colegio_id: est.colegio_id,
      estudiante_id: est.id,
      tipo,
      puntos,
      referencia: refFinal,
    })
    if (xpError) {
      if (xpError.code === '23505') return json({ error: 'Ya reclamaste este XP', xp_total: await total(admin, est.id) }, 200)
      return json({ error: 'No se pudo otorgar XP' }, 500)
    }

    // Actualiza racha (día consecutivo con actividad)
    await actualizarRacha(admin, est.id, est.colegio_id)

    // Otorga logros según XP acumulado
    const xpTotal = await total(admin, est.id)
    const nuevos: string[] = []
    for (const l of LOGROS) {
      if (xpTotal >= l.xpMin) {
        const { error } = await admin
          .from('logro')
          .insert({ colegio_id: est.colegio_id, estudiante_id: est.id, clave: l.clave })
        if (!error) nuevos.push(l.nombre)
      }
    }

    return json({ otorgado: puntos, xp_total: xpTotal, logros_nuevos: nuevos }, 200)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})

async function total(admin: ReturnType<typeof createClient>, estudianteId: string): Promise<number> {
  const { data } = await admin.from('xp_evento').select('puntos').eq('estudiante_id', estudianteId)
  return (data ?? []).reduce((s: number, r: { puntos: number }) => s + r.puntos, 0)
}

async function actualizarRacha(
  admin: ReturnType<typeof createClient>,
  estudianteId: string,
  colegioId: string,
) {
  const hoy = new Date().toISOString().slice(0, 10)
  const { data: r } = await admin.from('racha').select('dias, mejor_racha, ultima_fecha').eq('estudiante_id', estudianteId).maybeSingle()
  if (!r) {
    await admin.from('racha').insert({ estudiante_id: estudianteId, colegio_id: colegioId, dias: 1, mejor_racha: 1, ultima_fecha: hoy })
    return
  }
  if (r.ultima_fecha === hoy) return // ya contó hoy
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const dias = r.ultima_fecha === ayer ? r.dias + 1 : 1
  await admin
    .from('racha')
    .update({ dias, mejor_racha: Math.max(dias, r.mejor_racha), ultima_fecha: hoy })
    .eq('estudiante_id', estudianteId)
}
