export type Rol = 'director' | 'docente' | 'padre' | 'estudiante'

export interface Perfil {
  id: string
  colegio_id: string
  rol: Rol
  nombre: string
  correo: string | null
  avatar_seed: string | null
  avatar_pixel: string | null
}

export interface Colegio {
  id: string
  nombre: string
  pais: string
  moneda: string
  idioma: string
  curriculo: string
  logo_url: string | null
}

export interface Estudiante {
  id: string
  colegio_id: string
  perfil_id: string | null
  nombre: string
  carne: string | null
  seccion_id: string | null
  avatar_seed: string | null
  avatar_pixel: string | null
}
