import { useEffect, useRef } from 'react'

// Fondo "pared de monitoreo" bento — portado de ui-referencias/login-mockup.html
// Tiles asimétricos con blooms de color, pixel-art, grano y etiquetas técnicas.

type Tile = [number, number, number, number, string, string, string, string]

const TILES: Tile[] = [
  [-2, 4, 26, 20, 'px-rose', 'FLT', '00.0,04.2', 'deriva'],
  [1, 26, 24, 34, 'px-rose', 'C1', '00.0,08.4', 'deriva-2'],
  [24, 34, 16, 32, 'b-cream', 'C2', '05.2,04.2', ''],
  [40, 36, 22, 38, 'b-rose bloom', 'S01', '08.9,07.1', 'deriva'],
  [62, 20, 20, 44, 'photo', 'S02', '06.9,02.0', ''],
  [68, 2, 14, 15, 'b-cream', '', '', ''],
  [82, 6, 20, 30, 'b-blue bloom', 'S03', '18.9,00.7', 'deriva-2'],
  [82, 40, 18, 24, 'b-amber bloom', 'C3', '16.0,04.8', 'deriva'],
  [70, 70, 30, 14, 'b-violet bloom', 'C4', '16.0,08.4', 'deriva-2'],
  [44, 76, 20, 12, 'b-cream', '', '', ''],
  [2, 66, 20, 30, 'px-amber', 'C4', '00.0,08.4', 'deriva'],
  [82, 86, 18, 12, 'b-rose bloom', '', '', 'deriva'],
]

const BLOOMS: Record<string, string> = {
  'b-amber': 'radial-gradient(circle at 40% 55%,#ffd9a0,#f7a927 25%,#c96e00 55%,#2a1c0c 90%)',
  'b-blue': 'radial-gradient(circle at 55% 40%,#cfe0ff,#7aa2ff 30%,#3f5fd0 60%,#121a33 92%)',
  'b-violet': 'radial-gradient(circle at 45% 60%,#f3d9ff,#c79cff 30%,#7c3aed 62%,#1a1230 92%)',
  'b-rose': 'radial-gradient(circle at 50% 45%,#ffe0ef,#ff9ec4 32%,#d94f8f 62%,#2a1220 92%)',
  'b-cream': 'linear-gradient(135deg,#f3ede2,#d9cdb8)',
}

const GRANO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

function dibujarPixeles(c: HTMLCanvasElement, colores: string[]) {
  const ctx = c.getContext('2d')
  if (!ctx) return
  const N = 20
  const s = c.width / N
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - 6, y - 10) / 16
      if (Math.random() > d * 1.3) continue
      ctx.fillStyle = colores[Math.floor(Math.random() * colores.length)]
      ctx.globalAlpha = 0.5 + Math.random() * 0.5
      ctx.fillRect(x * s, y * s, s, s)
    }
}

function CanvasPixeles({ colores }: { colores: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) dibujarPixeles(ref.current, colores)
  }, [colores])
  return (
    <canvas ref={ref} width={40} height={40} className="block h-full w-full" style={{ imageRendering: 'pixelated' }} />
  )
}

export function MosaicBackground() {
  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: '#0a0907' }} aria-hidden>
        {TILES.map(([x, y, w, h, tipo, etiqueta, coord, extra], i) => (
          <div
            key={i}
            className={`absolute overflow-hidden rounded-[2px] border ${extra}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${w}%`,
              height: `${h}%`,
              borderColor: 'rgba(245,237,224,.07)',
            }}
          >
            {tipo.startsWith('px-') ? (
              <CanvasPixeles
                colores={
                  tipo === 'px-rose' ? ['#ff5da2', '#d94f8f', '#7c3aed'] : ['#f7a927', '#e07b00', '#c96e00']
                }
              />
            ) : tipo === 'photo' ? (
              <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(circle at 60% 45%,#3aa564,#1f7a44 40%,#0c2f1c 85%)' }}
              />
            ) : (
              <div
                className={`absolute ${tipo.includes('bloom') ? 'blur-[2px]' : ''}`}
                style={{ inset: '-10%', background: BLOOMS[tipo.split(' ')[0]] }}
              />
            )}
            <div
              className="absolute inset-0 opacity-50 mix-blend-overlay"
              style={{ backgroundImage: GRANO }}
            />
            {etiqueta && (
              <div
                className="absolute top-1.5 left-1.5 rounded-[3px] px-[5px] py-px font-mono text-[9px] font-semibold tracking-wider"
                style={{ color: 'rgba(245,237,224,.55)', background: 'rgba(11,10,8,.6)' }}
              >
                {etiqueta}
              </div>
            )}
            {coord && (
              <div
                className="absolute right-1.5 bottom-1.5 rounded-[3px] px-[5px] py-px font-mono text-[9px]"
                style={{ color: 'rgba(245,237,224,.4)', background: 'rgba(11,10,8,.55)' }}
              >
                {coord}
              </div>
            )}
          </div>
        ))}
        <div
          className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay"
          style={{
            background:
              'linear-gradient(rgba(245,237,224,.05) 1px,transparent 1px) 0 0/100% 88px, linear-gradient(90deg,rgba(245,237,224,.05) 1px,transparent 1px) 0 0/128px 100%',
          }}
        />
      </div>
      {/* scrim: oscurece el centro para que la tarjeta siempre sea legible (AA) */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 46% 62% at 50% 50%,rgba(8,7,5,.82) 0%,rgba(8,7,5,.5) 45%,rgba(8,7,5,.35) 100%)',
        }}
      />
    </>
  )
}
