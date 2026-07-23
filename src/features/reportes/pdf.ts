import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'

// Paleta de marca para el PDF (§40)
const AMBER = '#e07b00'
const INK = '#0b0a08'
const MUTED = '#6b6156'

function codigoDoc(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(8))
  return 'SP-DOC-' + Array.from(r, (b) => abc[b % abc.length]).join('')
}

interface DatosBase {
  colegioId: string
  colegioNombre: string
  estudianteNombre: string
  emitidoPor: string
}

// Registra el documento para verificación pública y devuelve su código + QR.
async function registrar(
  tipo: string,
  base: DatosBase,
  resumen: Record<string, unknown>,
): Promise<{ codigo: string; qr: string }> {
  const codigo = codigoDoc()
  const { error } = await supabase.from('documento_verificable').insert({
    colegio_id: base.colegioId,
    codigo,
    tipo,
    estudiante_nombre: base.estudianteNombre,
    colegio_nombre: base.colegioNombre,
    resumen,
    emitido_por: base.emitidoPor,
  })
  if (error) throw new Error('No se pudo registrar el documento para verificación')
  const url = `${window.location.origin}/verificar?c=${codigo}`
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: INK, light: '#ffffff' } })
  return { codigo, qr }
}

function encabezado(doc: jsPDF, colegioNombre: string, titulo: string) {
  doc.setFillColor(AMBER)
  doc.rect(0, 0, 210, 6, 'F')
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(colegioNombre, 20, 24)
  doc.setFontSize(13)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text(titulo, 20, 32)
  doc.setDrawColor(226, 219, 208)
  doc.line(20, 38, 190, 38)
}

function pieVerificacion(doc: jsPDF, qr: string, codigo: string, y: number) {
  doc.addImage(qr, 'PNG', 20, y, 32, 32)
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text('Documento verificable. Escanea el código o visita', 58, y + 8)
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.text(`${window.location.origin}/verificar`, 58, y + 14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.text(`Código: ${codigo}`, 58, y + 20)
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-GT')}`, 58, y + 26)
}

export interface NotaMateria {
  materia: string
  promedio: number
  evaluaciones: number
}

export async function generarBoleta(
  base: DatosBase,
  notas: NotaMateria[],
  periodo: string,
): Promise<string> {
  const promedioGeneral =
    notas.length > 0 ? notas.reduce((s, n) => s + Number(n.promedio), 0) / notas.length : 0
  const { codigo, qr } = await registrar('boleta', base, {
    periodo,
    promedio_general: Number(promedioGeneral.toFixed(2)),
    materias: notas.map((n) => ({ materia: n.materia, promedio: Number(n.promedio) })),
  })

  const doc = new jsPDF()
  encabezado(doc, base.colegioNombre, 'Boleta de calificaciones')

  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(base.estudianteNombre, 20, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  doc.text(`Periodo: ${periodo}`, 20, 56)

  // tabla
  let y = 70
  doc.setFillColor(242, 237, 229)
  doc.rect(20, y - 6, 170, 9, 'F')
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('MATERIA', 24, y)
  doc.text('EVALUACIONES', 130, y)
  doc.text('PROMEDIO', 168, y)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const n of notas) {
    doc.setTextColor(INK)
    doc.text(n.materia.slice(0, 55), 24, y)
    doc.text(String(n.evaluaciones), 138, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(Number(n.promedio) >= 60 ? '#16a34a' : '#dc2626')
    doc.text(Number(n.promedio).toFixed(1), 170, y)
    doc.setFont('helvetica', 'normal')
    y += 8
  }
  if (notas.length === 0) {
    doc.setTextColor(MUTED)
    doc.text('Sin calificaciones registradas en este periodo.', 24, y)
    y += 8
  }

  y += 4
  doc.setDrawColor(226, 219, 208)
  doc.line(20, y, 190, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text('Promedio general', 24, y)
  doc.setTextColor(promedioGeneral >= 60 ? '#16a34a' : '#dc2626')
  doc.text(promedioGeneral.toFixed(1), 170, y)

  pieVerificacion(doc, qr, codigo, 240)
  doc.save(`boleta-${base.estudianteNombre.replace(/\s+/g, '_')}.pdf`)
  return codigo
}

export async function generarSolvencia(
  base: DatosBase,
  saldoPendiente: number,
  moneda: string,
): Promise<string> {
  const solvente = saldoPendiente <= 0
  const { codigo, qr } = await registrar('solvencia', base, {
    solvente,
    saldo_pendiente: saldoPendiente,
    moneda,
  })

  const doc = new jsPDF()
  encabezado(doc, base.colegioNombre, 'Constancia de solvencia')

  doc.setTextColor(INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const y = 60
  doc.text('Por este medio se hace constar que el estudiante', 20, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(base.estudianteNombre, 20, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  if (solvente) {
    doc.text('se encuentra SOLVENTE con los pagos del establecimiento a la', 20, y + 22)
    doc.text('fecha de emisión de esta constancia.', 20, y + 28)
  } else {
    doc.text(`presenta un saldo pendiente de ${moneda}${saldoPendiente.toFixed(2)} a la fecha`, 20, y + 22)
    doc.text('de emisión de esta constancia.', 20, y + 28)
  }

  // sello de estado
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(solvente ? '#16a34a' : '#dc2626')
  doc.text(solvente ? 'SOLVENTE' : 'CON SALDO PENDIENTE', 20, y + 48)

  pieVerificacion(doc, qr, codigo, 240)
  doc.save(`solvencia-${base.estudianteNombre.replace(/\s+/g, '_')}.pdf`)
  return codigo
}
