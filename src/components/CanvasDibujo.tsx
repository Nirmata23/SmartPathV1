import { useEffect, useRef, useState } from 'react'
import { Eraser, RotateCcw } from 'lucide-react'

export interface Trazo {
  color: string
  grosor: number
  puntos: [number, number][]
}

const COLORES = ['#0b0a08', '#e07b00', '#dc2626', '#16a34a', '#2563eb', '#8a5cf6']
const ANCHO = 640
const ALTO = 360

// Lienzo de dibujo que guarda TRAZOS VECTORIALES (no imagen). Cada trazo es una
// lista de puntos normalizados 0..1, así se redibuja a cualquier tamaño (§25).
export function CanvasDibujo({
  valor,
  onChange,
  soloLectura = false,
}: {
  valor: Trazo[]
  onChange?: (t: Trazo[]) => void
  soloLectura?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState(COLORES[0])
  const [grosor, setGrosor] = useState(3)
  const dibujando = useRef(false)
  const trazoActual = useRef<Trazo | null>(null)

  function redibujar(trazos: Trazo[]) {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const t of trazos) {
      ctx.strokeStyle = t.color
      ctx.lineWidth = t.grosor
      ctx.beginPath()
      t.puntos.forEach(([x, y], i) => {
        const px = x * c.width
        const py = y * c.height
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
  }

  useEffect(() => {
    redibujar(valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  function punto(e: React.PointerEvent): [number, number] {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  function inicio(e: React.PointerEvent) {
    if (soloLectura) return
    dibujando.current = true
    trazoActual.current = { color, grosor, puntos: [punto(e)] }
  }
  function mover(e: React.PointerEvent) {
    if (!dibujando.current || !trazoActual.current) return
    trazoActual.current.puntos.push(punto(e))
    redibujar([...valor, trazoActual.current])
  }
  function fin() {
    if (!dibujando.current || !trazoActual.current) return
    dibujando.current = false
    if (trazoActual.current.puntos.length > 1) onChange?.([...valor, trazoActual.current])
    trazoActual.current = null
  }

  return (
    <div>
      <canvas
        ref={ref}
        width={ANCHO}
        height={ALTO}
        onPointerDown={inicio}
        onPointerMove={mover}
        onPointerUp={fin}
        onPointerLeave={fin}
        className="w-full touch-none rounded-xl border border-borde bg-white"
        style={{ aspectRatio: `${ANCHO}/${ALTO}`, cursor: soloLectura ? 'default' : 'crosshair' }}
      />
      {!soloLectura && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {COLORES.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-lg border-2 ${color === c ? 'border-ink' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-borde" />
          {[2, 4, 8].map((g) => (
            <button
              key={g}
              aria-label={`Grosor ${g}`}
              onClick={() => setGrosor(g)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${grosor === g ? 'bg-ink' : 'bg-cream-2'}`}
            >
              <span className="rounded-full" style={{ width: g + 2, height: g + 2, background: grosor === g ? '#fff' : '#6b6156' }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-borde" />
          <button
            aria-label="Deshacer"
            onClick={() => onChange?.(valor.slice(0, -1))}
            className="flex h-7 items-center gap-1 rounded-lg bg-cream-2 px-2.5 text-xs font-semibold text-muted hover:bg-cream-3"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Deshacer
          </button>
          <button
            aria-label="Borrar todo"
            onClick={() => onChange?.([])}
            className="flex h-7 items-center gap-1 rounded-lg bg-cream-2 px-2.5 text-xs font-semibold text-muted hover:bg-cream-3"
          >
            <Eraser className="h-3.5 w-3.5" /> Limpiar
          </button>
        </div>
      )}
    </div>
  )
}
