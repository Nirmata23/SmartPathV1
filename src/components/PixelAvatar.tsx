import { useMemo } from 'react'
import { pixelAvatar, pixelArtDesdeCodigo, type TemaAvatar } from '../lib/avatar'

interface Props {
  seed: string
  tema?: TemaAvatar
  /** código del editor de pixel art: "<celdas>|<leyenda>" */
  codigoPixel?: string | null
  tamano?: number
  className?: string
}

// El SVG lo genera nuestro motor determinista a partir de la semilla
// (sin datos del usuario), por lo que es seguro inyectarlo.
export function PixelAvatar({ seed, tema = 'aleatorio', codigoPixel, tamano = 40, className }: Props) {
  const svg = useMemo(() => {
    if (codigoPixel) {
      const [codigo, leyenda] = codigoPixel.split('|')
      if (codigo) return pixelArtDesdeCodigo(codigo, leyenda ?? '')
    }
    return pixelAvatar(seed || 'SmartPath', tema)
  }, [seed, tema, codigoPixel])

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-xl border border-borde bg-cream-2 ${className ?? ''}`}
      style={{ width: tamano, height: tamano }}
      role="img"
      aria-label={`Avatar de ${seed}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
