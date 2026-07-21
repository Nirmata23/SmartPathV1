// Motor de avatares de píxeles — portado de ui-referencias/avatar-generator.html
// Determinista (misma semilla → mismo avatar), SVG al vuelo, cero almacenamiento.
// Los estudiantes NUNCA suben fotos (regla no negociable #2).

export type TemaAvatar = 'aleatorio' | 'criatura' | 'flor' | 'abeja' | 'mariposa'

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function renderGrid(grid: string[], pal: Record<string, string>, px = 14): string {
  const H = grid.length
  const W = grid[0].length
  let r = ''
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = grid[y][x]
      if (ch === '.' || ch === ' ') continue
      r += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${pal[ch]}"/>`
    }
  return `<svg viewBox="0 0 ${W * px} ${H * px}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${r}</svg>`
}

function creatureAvatar(seed: string, px = 14): string {
  const G = 9
  const c = (G - 1) / 2
  const rnd = mulberry32(hashSeed('c' + seed))
  const fill: boolean[][] = Array.from({ length: G }, () => Array(G).fill(false))
  const half = Math.ceil(G / 2)
  for (let y = 0; y < G; y++)
    for (let x = 0; x < half; x++) {
      const dist = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c)) / c
      const on = rnd() < Math.pow(Math.max(0, 1 - dist), 1.15) * 1.18
      fill[y][x] = on
      fill[y][G - 1 - x] = on
    }
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++)
      if (Math.sqrt((x - c) * (x - c) + (y - c) * (y - c)) <= 2.2) fill[y][x] = true
  for (let p = 0; p < 2; p++)
    for (let y = 0; y < G; y++)
      for (let x = 0; x < half; x++) {
        if (!fill[y][x]) continue
        let nb = 0
        for (const [dy, dx] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ny = y + dy
          const nx = x + dx
          if (ny >= 0 && nx >= 0 && ny < G && nx < G && fill[ny][nx]) nb++
        }
        if (nb === 0) {
          fill[y][x] = false
          fill[y][G - 1 - x] = false
        }
      }
  const bodies: [number, number, number][][] = [
    [
      [255, 150, 70],
      [240, 70, 35],
    ],
    [
      [255, 190, 90],
      [240, 120, 40],
    ],
    [
      [255, 120, 120],
      [210, 50, 60],
    ],
    [
      [255, 170, 60],
      [225, 90, 30],
    ],
  ]
  const bp = bodies[hashSeed('b' + seed) % bodies.length]
  const top = bp[0]
  const bot = bp[1]
  const body = (y: number) => {
    const t = y / (G - 1)
    const s = y % 2 === 0 ? 0 : -14
    const ch = (i: number) => Math.max(0, Math.round(top[i] + (bot[i] - top[i]) * t) + s)
    return `rgb(${ch(0)},${ch(1)},${ch(2)})`
  }
  const OUT = '#d61f26'
  const EYE = '#1b6fd6'
  const eyeRow = 3
  const ec = [2, G - 3]
  fill[eyeRow][ec[0]] = true
  fill[eyeRow][ec[1]] = true
  const edge = (y: number, x: number) => {
    if (!fill[y][x]) return false
    for (const [dy, dx] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ny = y + dy
      const nx = x + dx
      if (ny < 0 || nx < 0 || ny >= G || nx >= G || !fill[ny][nx]) return true
    }
    return false
  }
  let r = ''
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      if (!fill[y][x]) continue
      let col: string
      if (y === eyeRow && (x === ec[0] || x === ec[1])) col = EYE
      else if (edge(y, x)) col = OUT
      else col = body(y)
      r += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${col}"/>`
    }
  return `<svg viewBox="0 0 ${G * px} ${G * px}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${r}</svg>`
}

const T: Record<string, string[]> = {
  flor: [
    '...........',
    '...G...G...',
    '..GYG.GYG..',
    '..GYYYYYG..',
    '...YYYYY...',
    '..YYYCYYY..',
    '...YYYYY...',
    '..GYYYYYG..',
    '..GYG.GYG..',
    '...G...G...',
    '...........',
  ],
  abeja: [
    '...........',
    '...WW.WW...',
    '..W..W..W..',
    '..W.WWW.W..',
    '...WWWWW...',
    '..KYKYKYK..',
    '..YKYKYKY..',
    '..KYKYKYK..',
    '...YKYKY...',
    '....KKK....',
    '...........',
  ],
  mariposa: [
    '...........',
    '..PP...PP..',
    '.PPPP.PPPP.',
    'PPPPPBPPPPP',
    'PPPOPBPOPPP',
    'PPPPPBPPPPP',
    '.PPPPBPPPP.',
    '..PPPBPPP..',
    '...P.B.P...',
    '.....B.....',
    '...........',
  ],
}

const PAL: Record<string, Record<string, string>[]> = {
  flor: [
    { G: '#ff5da2', Y: '#ff8fc0', C: '#ffd23f' },
    { G: '#e0432a', Y: '#ff7a5c', C: '#ffd23f' },
    { G: '#8a5cf6', Y: '#b79cff', C: '#ffd23f' },
    { G: '#f59e0b', Y: '#ffc65c', C: '#e0432a' },
    { G: '#2563eb', Y: '#6fa0ff', C: '#ffd23f' },
    { G: '#16a34a', Y: '#5cd08a', C: '#ffd23f' },
  ],
  abeja: [
    { K: '#2b2b2b', Y: '#ffc107', W: '#cfe8ff' },
    { K: '#2b2b2b', Y: '#ffb300', W: '#e6dcff' },
    { K: '#3a2a10', Y: '#ffcf40', W: '#d7f0e0' },
  ],
  mariposa: [
    { P: '#8a5cf6', O: '#ffd23f', B: '#3b2a1a' },
    { P: '#e0432a', O: '#ffd23f', B: '#3b2a1a' },
    { P: '#2563eb', O: '#ffe08a', B: '#2a2118' },
    { P: '#16a34a', O: '#ffd23f', B: '#2a2118' },
    { P: '#ff5da2', O: '#fff1a8', B: '#3b2a1a' },
  ],
}

function themedAvatar(seed: string, theme: string, px = 14): string {
  const variants = PAL[theme]
  const pal = variants[hashSeed(theme + seed) % variants.length]
  return renderGrid(T[theme], pal, px)
}

export function pixelAvatar(seed: string, theme: TemaAvatar = 'aleatorio', px = 14): string {
  let t: string = theme
  if (t === 'aleatorio') {
    const opts = ['criatura', 'flor', 'abeja', 'mariposa']
    t = opts[hashSeed('t' + seed) % opts.length]
  }
  if (t === 'criatura') return creatureAvatar(seed, px)
  return themedAvatar(seed, t, px)
}

// Reconstruye el SVG de un avatar dibujado en el editor de pixel art
// (código de texto: '.' = vacío, letras mapeadas en la leyenda "a=#rrggbb ...")
export function pixelArtDesdeCodigo(codigo: string, leyenda: string, n = 12, px = 12): string {
  const inv: Record<string, string> = {}
  for (const par of leyenda.split(' ')) {
    const [ch, col] = par.split('=')
    if (ch && col) inv[ch] = col
  }
  let r = ''
  for (let i = 0; i < codigo.length; i++) {
    const ch = codigo[i]
    if (ch === '.') continue
    const x = i % n
    const y = (i / n) | 0
    r += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${inv[ch] ?? '#000'}"/>`
  }
  return `<svg viewBox="0 0 ${n * px} ${n * px}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${r}</svg>`
}
