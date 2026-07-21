import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

export const claseInput =
  'h-11 w-full rounded-xl border-[1.5px] border-borde bg-cream px-3.5 text-sm text-ink ' +
  'placeholder-muted-2 transition-colors focus:border-amber focus:outline-none'

export function Boton({
  children,
  variante = 'primario',
  type = 'button',
  disabled,
  onClick,
  className = '',
}: {
  children: ReactNode
  variante?: 'primario' | 'fantasma' | 'peligro'
  type?: 'button' | 'submit'
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  const base =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50'
  const v =
    variante === 'primario'
      ? 'bg-amber text-white hover:-translate-y-px hover:bg-amber-d'
      : variante === 'peligro'
        ? 'bg-alerta/10 text-alerta hover:bg-alerta/20'
        : 'bg-cream-2 text-ink hover:bg-cream-3'
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${v} ${className}`}>
      {children}
    </button>
  )
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 ml-0.5 block text-xs font-bold text-muted">{children}</label>
}

export function Chip({
  children,
  tono = 'neutro',
}: {
  children: ReactNode
  tono?: 'neutro' | 'exito' | 'alerta' | 'aviso' | 'info'
}) {
  const t: Record<string, string> = {
    neutro: 'bg-cream-2 text-muted',
    exito: 'bg-exito/10 text-exito',
    alerta: 'bg-alerta/10 text-alerta',
    aviso: 'bg-aviso/10 text-aviso',
    info: 'bg-info/10 text-info',
  }
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${t[tono]}`}>
      {children}
    </span>
  )
}

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
}: {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!abierto) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [abierto, onCerrar])

  if (!abierto) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-borde bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal
        aria-label={titulo}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display truncate text-xl">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-cream-2"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body,
  )
}
