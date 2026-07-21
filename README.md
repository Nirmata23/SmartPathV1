# SmartPath

Plataforma web de gestión escolar multi-colegio con 4 roles (Director, Docente,
Padre/Tutor, Estudiante) sobre Supabase. Plano completo en `README-FABLE.md` y
`docs/ESPECIFICACION-PRODUCTO.md`.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind 4 + Framer Motion (pnpm)
- **Backend**: Supabase — Postgres con RLS, Auth, Realtime y Edge Functions
- **Tipografía**: Fraunces (títulos) · Space Grotesk (UI) · JetBrains Mono (etiquetas)

## Arranque local

```bash
pnpm install
cp .env.example .env   # completa URL y clave publicable de tu proyecto Supabase
pnpm dev
```

## Estructura

```
src/
  app/            # rutas: publico (login/registro/codigo) + director/docente/padre/estudiante
  components/     # PixelAvatar, MosaicBackground, UI base
  features/auth/  # sesión + perfil (contexto)
  lib/            # cliente supabase, motor de avatares
supabase/
  migrations/     # SQL versionado: núcleo, RLS, vistas, permisos
  functions/      # Edge Functions: crear-colegio, canjear-invitacion
  tests/          # rls_test.sql — 33 pruebas con los 4 roles y 2 colegios
```

## Seguridad (reglas no negociables)

1. RLS activada en todas las tablas, aislada por `colegio_id` y afinada por rol.
2. Sin fotos de menores: avatares de píxeles generados (SVG al vuelo, cero storage).
3. Lo sensible se valida en el servidor (Edge Functions): creación de colegio,
   canje de códigos de un solo uso; XP y pagos seguirán el mismo patrón.
4. Secretos solo en variables de entorno; `service_role` jamás en el cliente.
5. Gráficos únicamente con datos reales (vistas de agregación con `security_invoker`).

Las pruebas de RLS (`supabase/tests/rls_test.sql`) se ejecutan contra el proyecto
real y deben terminar todas en `OK` antes de cada fase nueva.
