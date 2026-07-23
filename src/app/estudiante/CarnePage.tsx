import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { PixelAvatar } from '../../components/PixelAvatar'
import { QR } from '../../components/QR'

// Carné digital del estudiante (§35, §10). Muestra un QR con su código de carné
// para el control de entrada/salida. Sin fotos: avatar generado.
export function CarnePage() {
  const { perfil } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['mi-carne'],
    queryFn: async () => {
      const { data: yo } = await supabase
        .from('estudiante')
        .select('id, nombre, carne, avatar_seed, avatar_pixel, seccion:seccion_id(nombre, grado:grado_id(nombre))')
        .eq('perfil_id', perfil!.id)
        .maybeSingle()
      const { data: col } = await supabase.from('colegio').select('nombre').eq('id', perfil!.colegio_id).maybeSingle()
      return { yo: yo as unknown as { id: string; nombre: string; carne: string | null; avatar_seed: string | null; avatar_pixel: string | null; seccion: { nombre: string; grado: { nombre: string } | null } | null } | null, colegio: col?.nombre ?? 'Colegio' }
    },
  })

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  if (!data?.yo?.carne) {
    return (
      <>
        <EncabezadoPagina titulo={<>Mi <em className="text-amber-d italic">carné</em></>} />
        <Tarjeta>
          <EstadoVacio
            titulo="Aún no tienes carné"
            texto="Tu colegio debe generar tu acceso para activar el carné digital con QR."
          />
        </Tarjeta>
      </>
    )
  }

  const est = data.yo
  return (
    <>
      <EncabezadoPagina
        titulo={<>Mi <em className="text-amber-d italic">carné</em></>}
        sub="Muéstralo en recepción para registrar tu entrada y salida."
      />
      <motion.div
        initial={{ opacity: 0, y: 12, rotateX: -8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto max-w-sm"
        style={{ perspective: 1000 }}
      >
        <div className="overflow-hidden rounded-3xl border border-borde bg-white shadow-[0_10px_40px_rgba(12,11,9,.12)]">
          <div className="h-3" style={{ background: 'linear-gradient(90deg,#e07b00,#f7a927)' }} />
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg">{data.colegio}</span>
              <span className="font-mono text-[10px] tracking-widest text-muted-2 uppercase">Carné</span>
            </div>
            <div className="flex items-center gap-4">
              <PixelAvatar seed={est.avatar_seed ?? est.nombre} codigoPixel={est.avatar_pixel} tamano={72} />
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold">{est.nombre}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {est.seccion?.grado?.nombre} {est.seccion?.nombre}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-2">{est.carne}</div>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-cream-2 py-5">
              <QR valor={est.carne ?? ''} tamano={168} />
              <span className="font-mono text-[10px] tracking-widest text-muted-2 uppercase">Escanea para registrar acceso</span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
