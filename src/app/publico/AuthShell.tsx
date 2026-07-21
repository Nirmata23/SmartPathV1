import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { MosaicBackground } from '../../components/MosaicBackground'

// Cáscara de las pantallas públicas: mosaico bento + tarjeta de vidrio legible.
export function AuthShell({ children, ancho = 396 }: { children: ReactNode; ancho?: number }) {
  return (
    <div className="min-h-screen overflow-hidden bg-ink text-cream">
      <MosaicBackground />
      <div className="relative z-[2] flex min-h-screen items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full rounded-[22px] border p-8 sm:p-9"
          style={{
            maxWidth: ancho,
            background: 'rgba(18,15,12,.72)',
            backdropFilter: 'blur(22px)',
            borderColor: 'rgba(245,237,224,.12)',
            boxShadow: '0 30px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(245,237,224,.08)',
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}

export function LogoSmartPath() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: 'linear-gradient(135deg,#e07b00,#f7a927)',
          boxShadow: '0 6px 18px rgba(224,123,0,.4)',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-white stroke-2">
          <path d="M12 3 4 9v11h5v-6h6v6h5V9z" />
        </svg>
      </div>
      <span className="font-display text-[21px]">SmartPath</span>
    </div>
  )
}

export function CampoOscuro({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 ml-0.5 block text-xs font-bold" style={{ color: 'rgba(245,237,224,.7)' }}>
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

export const claseInputOscuro =
  'h-[50px] w-full rounded-[13px] border px-4 text-sm text-cream transition-colors ' +
  'border-[rgba(245,237,224,.14)] bg-[rgba(245,237,224,.05)] placeholder-[rgba(245,237,224,.35)] ' +
  'focus:border-amber focus:bg-[rgba(245,237,224,.08)] focus:shadow-[0_0_0_4px_rgba(224,123,0,.15)] focus:outline-none'

export function BotonPrimario({
  children,
  cargando,
  type = 'submit',
  onClick,
}: {
  children: ReactNode
  cargando?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={cargando}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] text-[15px] font-extrabold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        background: 'linear-gradient(135deg,#e07b00,#f7a927)',
        color: '#241403',
        boxShadow: '0 10px 26px rgba(224,123,0,.35)',
      }}
    >
      {cargando ? 'Un momento…' : children}
    </button>
  )
}

export function MensajeError({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border px-4 py-3 text-[13px]"
      style={{
        borderColor: 'rgba(220,38,38,.4)',
        background: 'rgba(220,38,38,.12)',
        color: '#ffb4b4',
      }}
    >
      {texto}
    </div>
  )
}
