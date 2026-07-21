import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileUp, KeyRound, Plus, Ticket, UserPlus } from 'lucide-react'
import { supabase, invocarFuncion } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, EstadoVacio, Tarjeta } from '../AppLayout'
import { Boton, Chip, Etiqueta, Modal, claseInput } from '../../components/ui'
import { PixelAvatar } from '../../components/PixelAvatar'
import type { Estudiante, Rol } from '../../types/db'

interface Invitacion {
  id: string
  codigo: string
  rol: Rol
  usado: boolean
  expira_en: string
  datos: { estudiante_ids?: string[] } | null
}

function generarCodigo(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(8))
  const s = Array.from(r, (b) => abc[b % abc.length]).join('')
  return `SP-${s.slice(0, 4)}-${s.slice(4)}`
}

type Pestana = 'estudiantes' | 'invitaciones'

// Personas (§4 paso 3): invitaciones por código, alta de estudiantes (manual y CSV)
// y generación de acceso usuario + PIN. El canje siempre se valida en el servidor.
export function PersonasPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const colegioId = perfil!.colegio_id
  const [pestana, setPestana] = useState<Pestana>('estudiantes')

  const { data, isLoading } = useQuery({
    queryKey: ['personas'],
    queryFn: async () => {
      const [est, inv, secc, grad] = await Promise.all([
        supabase
          .from('estudiante')
          .select('id, colegio_id, perfil_id, nombre, carne, seccion_id, avatar_seed, avatar_pixel')
          .order('nombre')
          .limit(500),
        supabase
          .from('invitacion')
          .select('id, codigo, rol, usado, expira_en, datos')
          .order('creado_en', { ascending: false })
          .limit(100),
        supabase.from('seccion').select('id, nombre, grado_id'),
        supabase.from('grado').select('id, nombre'),
      ])
      return {
        estudiantes: (est.data ?? []) as Estudiante[],
        invitaciones: (inv.data ?? []) as Invitacion[],
        secciones: (secc.data ?? []) as { id: string; nombre: string; grado_id: string }[],
        grados: (grad.data ?? []) as { id: string; nombre: string }[],
      }
    },
  })
  const invalidar = () => qc.invalidateQueries({ queryKey: ['personas'] })

  const nombreSeccion = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of data?.secciones ?? []) {
      const g = data?.grados.find((g) => g.id === s.grado_id)
      m.set(s.id, `${g?.nombre ?? ''} ${s.nombre}`.trim())
    }
    return m
  }, [data])

  // ── invitaciones ──
  const [modalInv, setModalInv] = useState(false)
  const [rolInv, setRolInv] = useState<'docente' | 'padre'>('docente')
  const [hijosSel, setHijosSel] = useState<string[]>([])
  const [codigoNuevo, setCodigoNuevo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const crearInvitacion = useMutation({
    mutationFn: async () => {
      setError(null)
      if (rolInv === 'padre' && hijosSel.length === 0)
        throw new Error('Elige al menos un estudiante para el código familiar')
      const codigo = generarCodigo()
      const { error } = await supabase.from('invitacion').insert({
        colegio_id: colegioId,
        codigo,
        rol: rolInv,
        datos: rolInv === 'padre' ? { estudiante_ids: hijosSel } : null,
        creado_por: perfil!.id,
      })
      if (error) throw error
      return codigo
    },
    onSuccess: (codigo) => {
      setCodigoNuevo(codigo)
      invalidar()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear'),
  })

  // ── estudiantes ──
  const [modalEst, setModalEst] = useState(false)
  const [nombreEst, setNombreEst] = useState('')
  const [seccionEst, setSeccionEst] = useState('')

  const crearEstudiante = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error } = await supabase.from('estudiante').insert({
        colegio_id: colegioId,
        nombre: nombreEst.trim(),
        seccion_id: seccionEst || null,
        avatar_seed: nombreEst.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setModalEst(false)
      setNombreEst('')
      invalidar()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear'),
  })

  // CSV: nombre,grado,seccion  (una fila por estudiante, sin comillas)
  const archivoRef = useRef<HTMLInputElement>(null)
  const [resumenCsv, setResumenCsv] = useState<string | null>(null)
  const importarCsv = useMutation({
    mutationFn: async (archivo: File) => {
      const texto = await archivo.text()
      const filas = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(',').map((c) => c.trim()))
      const sinEncabezado = filas[0]?.[0]?.toLowerCase() === 'nombre' ? filas.slice(1) : filas
      const errores: string[] = []
      const nuevos: { colegio_id: string; nombre: string; seccion_id: string | null; avatar_seed: string }[] = []
      for (const [i, f] of sinEncabezado.entries()) {
        const [nombre, grado, seccion] = f
        if (!nombre || nombre.length < 3) {
          errores.push(`Fila ${i + 1}: nombre inválido`)
          continue
        }
        let seccionId: string | null = null
        if (grado && seccion) {
          const g = data!.grados.find((x) => x.nombre.toLowerCase() === grado.toLowerCase())
          const s = data!.secciones.find(
            (x) => x.grado_id === g?.id && x.nombre.toLowerCase() === seccion.toLowerCase(),
          )
          if (!s) {
            errores.push(`Fila ${i + 1}: no existe "${grado}" sección "${seccion}"`)
            continue
          }
          seccionId = s.id
        }
        nuevos.push({ colegio_id: colegioId, nombre, seccion_id: seccionId, avatar_seed: nombre })
      }
      if (nuevos.length > 0) {
        const { error } = await supabase.from('estudiante').insert(nuevos)
        if (error) throw error
      }
      return { insertados: nuevos.length, errores }
    },
    onSuccess: ({ insertados, errores }) => {
      setResumenCsv(
        `${insertados} estudiante(s) importado(s).` +
          (errores.length ? ` ${errores.length} fila(s) con error: ${errores.slice(0, 3).join('; ')}${errores.length > 3 ? '…' : ''}` : ''),
      )
      invalidar()
    },
    onError: (e) => setResumenCsv(`Error al importar: ${e instanceof Error ? e.message : 'desconocido'}`),
  })

  // acceso usuario + PIN (Edge Function; el PIN se muestra UNA vez)
  const [credenciales, setCredenciales] = useState<{ nombre: string; usuario: string; pin: string } | null>(null)
  const crearAcceso = useMutation({
    mutationFn: async (e: Estudiante) => {
      const r = await invocarFuncion<{ usuario: string; pin: string }>('crear-acceso-estudiante', {
        estudiante_id: e.id,
      })
      return { nombre: e.nombre, ...r }
    },
    onSuccess: (r) => {
      setCredenciales(r)
      invalidar()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo crear el acceso'),
  })
  const resetearPin = useMutation({
    mutationFn: async (e: Estudiante) => {
      const r = await invocarFuncion<{ pin: string }>('resetear-pin', { estudiante_id: e.id })
      return { nombre: e.nombre, usuario: e.carne ?? '', pin: r.pin }
    },
    onSuccess: (r) => setCredenciales(r),
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo resetear el PIN'),
  })

  if (isLoading || !data) return <div className="h-48 animate-pulse rounded-2xl bg-cream-2" />

  return (
    <>
      <EncabezadoPagina
        titulo={<>Personas del <em className="text-amber-d italic">colegio</em></>}
        sub="Estudiantes, códigos de invitación y accesos."
      />

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-alerta/10 px-4 py-2.5 text-sm text-alerta">
          {error}
        </p>
      )}

      <div className="mb-5 flex gap-2">
        {(
          [
            ['estudiantes', 'Estudiantes'],
            ['invitaciones', 'Invitaciones'],
          ] as [Pestana, string][]
        ).map(([id, txt]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`h-10 rounded-xl px-4 text-sm font-bold transition-colors ${
              pestana === id ? 'bg-ink text-cream' : 'bg-cream-2 text-muted hover:text-ink'
            }`}
          >
            {txt}
          </button>
        ))}
      </div>

      {pestana === 'estudiantes' && (
        <Tarjeta>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
              {data.estudiantes.length} estudiante(s) · sin fotos, avatares generados
            </span>
            <div className="flex gap-2">
              <input
                ref={archivoRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importarCsv.mutate(f)
                  e.target.value = ''
                }}
              />
              <Boton variante="fantasma" onClick={() => archivoRef.current?.click()} disabled={importarCsv.isPending}>
                <FileUp className="h-4 w-4" /> {importarCsv.isPending ? 'Importando…' : 'Importar CSV'}
              </Boton>
              <Boton onClick={() => { setModalEst(true); setSeccionEst(data.secciones[0]?.id ?? '') }}>
                <Plus className="h-4 w-4" /> Estudiante
              </Boton>
            </div>
          </div>

          {resumenCsv && (
            <p className="mb-4 rounded-xl bg-cream-2 px-4 py-2.5 text-sm text-muted">{resumenCsv}</p>
          )}
          <p className="mb-4 text-xs text-muted-2">
            Formato CSV: <code className="rounded bg-cream-2 px-1.5 py-0.5 font-mono">nombre,grado,seccion</code> — el grado y la sección deben existir ya en Colegio.
          </p>

          {data.estudiantes.length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay estudiantes"
              texto="Agrégalos uno por uno o importa tu listado completo en CSV."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left font-mono text-[10px] tracking-widest text-muted-2 uppercase">
                    <th className="pb-2 pl-1">Estudiante</th>
                    <th className="pb-2">Sección</th>
                    <th className="pb-2">Usuario</th>
                    <th className="pb-2 text-right">Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {data.estudiantes.map((e) => (
                    <tr key={e.id} className="border-b border-borde/60 hover:bg-cream/60">
                      <td className="max-w-[220px] py-2.5 pl-1">
                        <div className="flex items-center gap-2.5">
                          <PixelAvatar seed={e.avatar_seed ?? e.nombre} codigoPixel={e.avatar_pixel} tamano={30} />
                          <span className="truncate font-semibold" title={e.nombre}>{e.nombre}</span>
                        </div>
                      </td>
                      <td className="max-w-[140px] truncate py-2.5 text-muted">
                        {e.seccion_id ? nombreSeccion.get(e.seccion_id) : 'Sin sección'}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted">{e.carne ?? '—'}</td>
                      <td className="py-2.5 text-right">
                        {e.perfil_id ? (
                          <Boton
                            variante="fantasma"
                            className="!h-8 !px-2.5 !text-xs"
                            onClick={() => resetearPin.mutate(e)}
                            disabled={resetearPin.isPending}
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Resetear PIN
                          </Boton>
                        ) : (
                          <Boton
                            variante="fantasma"
                            className="!h-8 !px-2.5 !text-xs"
                            onClick={() => crearAcceso.mutate(e)}
                            disabled={crearAcceso.isPending}
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Crear acceso
                          </Boton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}

      {pestana === 'invitaciones' && (
        <Tarjeta>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
              Códigos de un solo uso, expiran en 30 días
            </span>
            <Boton onClick={() => { setModalInv(true); setRolInv('docente'); setHijosSel([]); setCodigoNuevo(null) }}>
              <Ticket className="h-4 w-4" /> Generar código
            </Boton>
          </div>
          {data.invitaciones.length === 0 ? (
            <EstadoVacio
              titulo="Sin invitaciones todavía"
              texto="Genera códigos para docentes y códigos familiares para padres. Cada código se canjea una sola vez."
            />
          ) : (
            <ul className="divide-y divide-borde/60">
              {data.invitaciones.map((i) => {
                const vencida = !i.usado && new Date(i.expira_en) < new Date()
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <code className="rounded-lg bg-cream-2 px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wider">
                        {i.codigo}
                      </code>
                      <Chip tono={i.rol === 'docente' ? 'info' : 'aviso'}>{i.rol.toUpperCase()}</Chip>
                      {i.rol === 'padre' && (
                        <span className="text-xs text-muted">
                          {i.datos?.estudiante_ids?.length ?? 0} hijo(s)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {i.usado ? (
                        <Chip tono="exito">CANJEADO</Chip>
                      ) : vencida ? (
                        <Chip tono="alerta">VENCIDO</Chip>
                      ) : (
                        <>
                          <Chip>ACTIVO</Chip>
                          <button
                            aria-label="Copiar código"
                            onClick={() => navigator.clipboard.writeText(i.codigo)}
                            className="text-muted-2 hover:text-ink"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>
      )}

      {/* modal: nuevo estudiante */}
      <Modal abierto={modalEst} titulo="Nuevo estudiante" onCerrar={() => setModalEst(false)}>
        <div className="space-y-3">
          <div>
            <Etiqueta>Nombre completo</Etiqueta>
            <input className={claseInput} value={nombreEst} onChange={(e) => setNombreEst(e.target.value)} placeholder="Nombre y apellidos" />
          </div>
          <div>
            <Etiqueta>Sección (opcional)</Etiqueta>
            <select className={claseInput} value={seccionEst} onChange={(e) => setSeccionEst(e.target.value)}>
              <option value="">Sin sección</option>
              {data.secciones.map((s) => (
                <option key={s.id} value={s.id}>{nombreSeccion.get(s.id)}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-2">
            Sin fotos: el avatar se genera automáticamente a partir del nombre.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModalEst(false)}>Cancelar</Boton>
          <Boton onClick={() => crearEstudiante.mutate()} disabled={crearEstudiante.isPending || nombreEst.trim().length < 3}>
            {crearEstudiante.isPending ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </Modal>

      {/* modal: generar invitación */}
      <Modal abierto={modalInv} titulo="Generar código de invitación" onCerrar={() => setModalInv(false)}>
        {codigoNuevo ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-muted">Entrega este código. Se canjea una sola vez y vence en 30 días.</p>
            <div className="mb-4 rounded-2xl bg-cream-2 py-5 font-mono text-2xl font-bold tracking-widest">
              {codigoNuevo}
            </div>
            <Boton onClick={() => navigator.clipboard.writeText(codigoNuevo)}>
              <Copy className="h-4 w-4" /> Copiar código
            </Boton>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <Etiqueta>Para</Etiqueta>
                <div className="flex gap-2">
                  {(['docente', 'padre'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRolInv(r)}
                      className={`h-11 flex-1 rounded-xl text-sm font-bold transition-colors ${
                        rolInv === r ? 'bg-ink text-cream' : 'bg-cream-2 text-muted'
                      }`}
                    >
                      {r === 'docente' ? 'Docente' : 'Padre / Tutor'}
                    </button>
                  ))}
                </div>
              </div>
              {rolInv === 'padre' && (
                <div>
                  <Etiqueta>Vincular con estudiante(s)</Etiqueta>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-borde p-2">
                    {data.estudiantes.length === 0 && (
                      <p className="p-2 text-sm text-muted">Primero agrega estudiantes.</p>
                    )}
                    {data.estudiantes.map((e) => (
                      <label key={e.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-cream-2">
                        <input
                          type="checkbox"
                          checked={hijosSel.includes(e.id)}
                          onChange={(ev) =>
                            setHijosSel(ev.target.checked ? [...hijosSel, e.id] : hijosSel.filter((x) => x !== e.id))
                          }
                        />
                        <span className="truncate text-sm">{e.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => setModalInv(false)}>Cancelar</Boton>
              <Boton onClick={() => crearInvitacion.mutate()} disabled={crearInvitacion.isPending}>
                {crearInvitacion.isPending ? 'Generando…' : 'Generar'}
              </Boton>
            </div>
          </>
        )}
      </Modal>

      {/* modal: credenciales generadas (se muestran UNA vez) */}
      <Modal abierto={credenciales !== null} titulo="Acceso del estudiante" onCerrar={() => setCredenciales(null)}>
        {credenciales && (
          <div className="text-center">
            <p className="mb-4 text-sm text-muted">
              Entrega estas credenciales a <b className="text-ink">{credenciales.nombre}</b>. El PIN se muestra solo esta vez.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-cream-2 py-4">
                <div className="font-mono text-[10px] tracking-widest text-muted-2 uppercase">Usuario</div>
                <div className="mt-1 font-mono text-lg font-bold">{credenciales.usuario}</div>
              </div>
              <div className="rounded-2xl bg-cream-2 py-4">
                <div className="font-mono text-[10px] tracking-widest text-muted-2 uppercase">PIN</div>
                <div className="mt-1 font-mono text-lg font-bold">{credenciales.pin}</div>
              </div>
            </div>
            <Boton onClick={() => navigator.clipboard.writeText(`Usuario: ${credenciales.usuario}  PIN: ${credenciales.pin}`)}>
              <Copy className="h-4 w-4" /> Copiar credenciales
            </Boton>
          </div>
        )}
      </Modal>
    </>
  )
}
