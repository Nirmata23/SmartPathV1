// Edge Function: calcular-planilla
// Calcula la nómina del mes en el SERVIDOR (regla no negociable #3): IGSS, ISR y
// provisiones de Bono 14 / Aguinaldo (Guatemala, §32). Solo el director. Genera
// un pago_personal por empleado activo del colegio para el periodo dado.
// SmartPath NO mueve dinero: solo calcula, registra y comprueba.
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

// Parámetros GT (configurables por colegio en el futuro):
const IGSS_LABORAL = 0.0483 // 4.83% cuota laboral
// ISR — método simplificado sobre renta mensual (tramos anuales Q48,000 exento).
// Aproximación mensual: los primeros Q4,000 exentos; excedente al 5% (rango bajo).
function calcularISR(brutoMensual: number): number {
  const exentoMensual = 48000 / 12 // Q4,000
  const gravable = Math.max(0, brutoMensual - exentoMensual)
  return Math.round(gravable * 0.05 * 100) / 100
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
    if (!quien || quien.rol !== 'director') return json({ error: 'Solo el director procesa la planilla' }, 403)

    const body = await req.json().catch(() => null)
    const periodoId = (body?.periodo_id ?? '').toString()
    if (!/^[0-9a-f-]{36}$/.test(periodoId)) return json({ error: 'Periodo inválido' }, 400)

    const { data: periodo } = await admin
      .from('planilla_periodo')
      .select('id, colegio_id, estado')
      .eq('id', periodoId)
      .eq('colegio_id', quien.colegio_id)
      .maybeSingle()
    if (!periodo) return json({ error: 'Periodo no encontrado en tu colegio' }, 404)
    if (periodo.estado === 'cerrada') return json({ error: 'El periodo ya está cerrado' }, 409)

    const { data: empleados } = await admin
      .from('empleado')
      .select('id, salario_base')
      .eq('colegio_id', quien.colegio_id)
      .eq('activo', true)
    if (!empleados || empleados.length === 0) return json({ error: 'No hay empleados activos' }, 400)

    let procesados = 0
    let totalNeto = 0
    for (const e of empleados) {
      const bruto = Number(e.salario_base)
      const igss = Math.round(bruto * IGSS_LABORAL * 100) / 100
      const isr = calcularISR(bruto)
      const neto = Math.round((bruto - igss - isr) * 100) / 100
      const bono14 = Math.round((bruto / 12) * 100) / 100 // provisión mensual
      const aguinaldo = Math.round((bruto / 12) * 100) / 100

      const { error } = await admin.from('pago_personal').upsert(
        {
          colegio_id: quien.colegio_id,
          empleado_id: e.id,
          periodo_id: periodoId,
          bruto,
          descuentos: { igss, isr },
          provisiones: { bono14, aguinaldo },
          neto,
          estado: 'pendiente',
        },
        { onConflict: 'empleado_id,periodo_id' },
      )
      if (!error) {
        procesados++
        totalNeto += neto
      }
    }

    await admin.from('auditoria').insert({
      colegio_id: quien.colegio_id,
      actor_id: quien.id,
      accion: 'calcular_planilla',
      entidad: 'planilla_periodo',
      entidad_id: periodoId,
      detalle: { procesados, total_neto: Math.round(totalNeto * 100) / 100 },
    })

    return json({ procesados, total_neto: Math.round(totalNeto * 100) / 100 }, 200)
  } catch (_e) {
    return json({ error: 'Error interno' }, 500)
  }
})
