import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// QR como imagen (data URL). Se genera en el cliente, sin servicios externos.
export function QR({ valor, tamano = 180 }: { valor: string; tamano?: number }) {
  const [src, setSrc] = useState<string>('')
  useEffect(() => {
    QRCode.toDataURL(valor, { margin: 1, width: tamano, color: { dark: '#0b0a08', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [valor, tamano])
  if (!src) return <div className="rounded-xl bg-cream-2" style={{ width: tamano, height: tamano }} />
  return <img src={src} width={tamano} height={tamano} alt="Código QR" className="rounded-xl" />
}
