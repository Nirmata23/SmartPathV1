import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { EncabezadoPagina, Tarjeta } from '../AppLayout'
import { Boton } from '../../components/ui'
import { PixelAvatar } from '../../components/PixelAvatar'
import type { TemaAvatar } from '../../lib/avatar'

const TEMAS: { id: TemaAvatar; nombre: string }[] = [
  { id: 'aleatorio', nombre: 'Sorpresa' },
  { id: 'criatura', nombre: 'Criatura' },
  { id: 'flor', nombre: 'Flor' },
  { id: 'abeja', nombre: 'Abeja' },
  { id: 'mariposa', nombre: 'Mariposa' },
]

// El avatar se guarda como "tema:semilla" en perfil.avatar_seed — solo texto,
// cero archivos, cero fotos (regla no negociable #2).
export function AvatarPage() {
  const { perfil, refrescarPerfil } = useAuth()
  const qc = useQueryClient()
  const guardadoInicial = perfil?.avatar_seed ?? perfil?.nombre ?? 'SmartPath'
  const [tema, setTema] = useState<TemaAvatar>(
    (guardadoInicial.split(':')[0] as TemaAvatar) in
    { aleatorio: 1, criatura: 1, flor: 1, abeja: 1, mariposa: 1 }
      ? (guardadoInicial.split(':')[0] as TemaAvatar)
      : 'aleatorio',
  )
  const [ok, setOk] = useState(false)

  const semillaBase = perfil?.nombre ?? 'SmartPath'

  const guardar = useMutation({
    mutationFn: async () => {
      const valor = `${tema}:${semillaBase}`
      const { error } = await supabase.from('perfil').update({ avatar_seed: valor }).eq('id', perfil!.id)
      if (error) throw error
      // sincroniza también el registro de estudiante para que padres/docentes lo vean igual
      await supabase.from('estudiante').update({ avatar_seed: valor }).eq('perfil_id', perfil!.id)
    },
    onSuccess: async () => {
      setOk(true)
      await refrescarPerfil()
      qc.invalidateQueries()
    },
  })

  return (
    <>
      <EncabezadoPagina
        titulo={<>Mi <em className="text-amber-d italic">avatar</em></>}
        sub="Elige tu estilo. Nada de fotos: tu avatar es único y se dibuja a partir de tu nombre."
      />
      <Tarjeta className="mx-auto max-w-xl">
        <div className="flex flex-col items-center gap-6">
          <PixelAvatar seed={`${tema}:${semillaBase}`} tamano={140} />
          <div className="flex flex-wrap justify-center gap-2">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTema(t.id); setOk(false) }}
                className={`h-11 rounded-xl px-4 text-sm font-bold transition-colors ${
                  tema === t.id ? 'bg-ink text-cream' : 'bg-cream-2 text-muted hover:text-ink'
                }`}
              >
                {t.nombre}
              </button>
            ))}
          </div>
          {ok && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-exito">
              <Check className="h-4 w-4" /> Avatar guardado
            </span>
          )}
          <Boton onClick={() => guardar.mutate()} disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar mi avatar'}
          </Boton>
        </div>
      </Tarjeta>
    </>
  )
}
