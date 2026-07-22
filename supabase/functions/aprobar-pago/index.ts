// Edge Function: aprobar-pago
// Regla anti-fraude (§33): un pago SOLO pasa a 'pagado' cuando el DIRECTOR lo
// confirma contra su banco. Aquí se valida que quien llama es director del
// colegio del pago, se cambia el estado de la cuota y del pago de forma
// consistente, se emite un recibo con correlativo y se deja auditoría.
// El padre nunca puede marcar 'pagado' por su cuenta (RLS no se lo permite).
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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: userData, error: userError } = await admin.auth.getUser(auth.replace('Bearer ', ''))
    if (userError || !userData.user) return json({ error: 'No autenticado' }, 401)

    const { data: quien } = await admin
      .from('perfil')
      .select('id, colegio_id, rol')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!quien || quien.rol !== 'director') return json({ error: 'Solo el director aprueba pagos' }, 403)

    const body = await req.json().catch(() => null)
    const pagoId = (body?.pago_id ?? '').toString()
    const decision = (body?.decision ?? '').toString() // 'aprobar' | 'rechazar'
    const motivo = (body?.motivo ?? '').toString().slice(0, 300)
    if (!/^[0-9a-f-]{36}$/.test(pagoId)) return json({ error: 'Pago inválido' }, 400)
    if (!['aprobar', 'rechazar'].includes(decision)) return json({ error: 'Decisión inválida' }, 400)

    // El pago debe existir, estar en revisión y ser del colegio del director
    const { data: pago } = await admin
      .from('pago')
      .select('id, colegio_id, cuota_id, monto, estado')
      .eq('id', pagoId)
      .eq('colegio_id', quien.colegio_id)
      .maybeSingle()
    if (!pago) return json({ error: 'Pago no encontrado en tu colegio' }, 404)
    if (pago.estado !== 'en_revision') return json({ error: 'Ese pago ya fue resuelto' }, 409)

    if (decision === 'rechazar') {
      await admin
        .from('pago')
        .update({ estado: 'rechazado', motivo_rechazo: motivo || 'Sin coincidencia en el banco', aprobado_por: quien.id, resuelto_en: new Date().toISOString() })
        .eq('id', pago.id)
      // la cuota vuelve a pendiente para que puedan reintentar
      await admin.from('cuota').update({ estado: 'pendiente' }).eq('id', pago.cuota_id)
      await admin.from('auditoria').insert({
        colegio_id: pago.colegio_id, actor_id: quien.id, accion: 'rechazar_pago',
        entidad: 'pago', entidad_id: pago.id, detalle: { motivo },
      })
      return json({ estado: 'rechazado' }, 200)
    }

    // aprobar: marca pago y cuota como pagados, emite recibo con correlativo
    await admin
      .from('pago')
      .update({ estado: 'pagado', aprobado_por: quien.id, resuelto_en: new Date().toISOString() })
      .eq('id', pago.id)
    await admin.from('cuota').update({ estado: 'pagado' }).eq('id', pago.cuota_id)

    // correlativo secuencial por colegio: REC-000001
    const { count } = await admin
      .from('recibo')
      .select('id', { count: 'exact', head: true })
      .eq('colegio_id', pago.colegio_id)
    const correlativo = `REC-${String((count ?? 0) + 1).padStart(6, '0')}`
    await admin.from('recibo').insert({ colegio_id: pago.colegio_id, pago_id: pago.id, correlativo })

    await admin.from('auditoria').insert({
      colegio_id: pago.colegio_id, actor_id: quien.id, accion: 'aprobar_pago',
      entidad: 'pago', entidad_id: pago.id, detalle: { correlativo, monto: pago.monto },
    })

    return json({ estado: 'pagado', correlativo }, 200)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
