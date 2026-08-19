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

Si faltan las variables, la app no se queda en blanco: muestra una pantalla con los
pasos exactos para crear el `.env`.

## Despliegue (Vercel)

El repositorio ya trae `vercel.json` con todo lo necesario. En Vercel:

1. **Add New → Project** e importa `Nirmata23/SmartPathV1`.
2. En **Branch**, elige `claude/smartpath-school-platform-fc1qbo`.
3. Framework, build y carpeta de salida se detectan solos (Vite → `dist`).
4. Agrega las **Environment Variables** —las mismas del `.env`, sin comillas:

   | Nombre | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://TU-PROYECTO.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` |
   | `VITE_VAPID_PUBLIC_KEY` | *(opcional, solo para notificaciones)* |

5. **Deploy**. Al terminar tendrás una URL pública que abre en cualquier navegador o celular.

> Las variables `VITE_*` se incrustan en el bundle **durante la compilación**: si las
> cambias después, hay que volver a desplegar para que surtan efecto.

Qué resuelve `vercel.json`:

- **Reescritura SPA** — sin ella, abrir directamente `/verificar?c=…` (el enlace del QR)
  o `/admision?c=…` (el portal de admisiones) devolvería 404. Son justamente los dos
  enlaces pensados para compartirse fuera de la app.
- **Caché** — assets con huella digital se cachean un año; el service worker nunca,
  para que las actualizaciones lleguen enseguida.
- **Cabeceras de seguridad** — `nosniff`, `Referrer-Policy`, `X-Frame-Options` y
  `Permissions-Policy` restringiendo cámara, micrófono y ubicación.

### Después del primer despliegue

En Supabase → **Authentication → URL Configuration**, agrega tu dominio de Vercel en
**Site URL** y en **Redirect URLs**. Sin eso, el enlace de recuperar contraseña
apuntaría a `localhost`.

### Otros proveedores

Cloudflare Pages y Netlify funcionan igual (build `pnpm build`, salida `dist`), pero
necesitan su propia regla de reescritura: en Netlify, un archivo `public/_redirects`
con `/* /index.html 200`.

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

## Aplicar la base de datos (Supabase)

Las migraciones en `supabase/migrations/` van en orden y todas (0001–0016) están
aplicadas en el proyecto, y todas las Edge Functions están desplegadas. Para
reproducir el proyecto desde cero con el CLI de Supabase:

```bash
supabase link --project-ref <TU_PROYECTO>
supabase db push                 # aplica migraciones pendientes
supabase functions deploy        # despliega todas las Edge Functions
```

O aplica el SQL de `0009_cobros.sql` desde el editor SQL del dashboard y despliega
`supabase/functions/aprobar-pago` desde el panel de Edge Functions.

Edge Functions del proyecto: `crear-colegio`, `canjear-invitacion`,
`crear-acceso-estudiante`, `resetear-pin`, `otorgar-xp`, `aprobar-pago`,
`calcular-planilla`, `enviar-push`.

### Web Push (opcional)

Para activar las notificaciones del navegador hay que configurar el par de
llaves VAPID. La **pública** va en `.env` como `VITE_VAPID_PUBLIC_KEY`; la
**privada** es un secreto del servidor — nunca en el repo:

```bash
# genera un par nuevo con:  npx web-push generate-vapid-keys
supabase secrets set VAPID_PUBLIC_KEY=<publica> VAPID_PRIVATE_KEY=<privada>
```

Sin estas llaves, la app degrada con elegancia: el botón de campana no aparece
y `enviar-push` responde 503 sin romper nada.

## Seguridad (reglas no negociables)

1. RLS activada en todas las tablas, aislada por `colegio_id` y afinada por rol.
2. Sin fotos de menores: avatares de píxeles generados (SVG al vuelo, cero storage).
3. Lo sensible se valida en el servidor (Edge Functions): creación de colegio,
   canje de códigos de un solo uso; XP y pagos seguirán el mismo patrón.
4. Secretos solo en variables de entorno; `service_role` jamás en el cliente.
5. Gráficos únicamente con datos reales (vistas de agregación con `security_invoker`).

Las pruebas de RLS (`supabase/tests/rls_test.sql`) se ejecutan contra el proyecto
real y deben terminar todas en `OK` antes de cada fase nueva.
