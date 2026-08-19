import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Si falta la configuración NO lanzamos al importar: eso dejaría la pantalla en
// blanco. Marcamos la bandera y la app muestra instrucciones claras (main.tsx).
export const hayConfiguracion = Boolean(url && key)

export const supabase = createClient(
  url || 'https://sin-configurar.supabase.co',
  key || 'sin-configurar',
)

export async function invocarFuncion<T>(
  nombre: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nombre, { body })
  if (error) {
    // FunctionsHttpError trae la respuesta con el mensaje del servidor
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      const parsed = await ctx.json().catch(() => null)
      if (parsed?.error) throw new Error(parsed.error)
    }
    throw new Error('No se pudo completar la operación')
  }
  return data as T
}
