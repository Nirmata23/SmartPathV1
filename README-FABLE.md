# SmartPath — Paquete de construcción para Fable

Este paquete es el **plano completo** para construir SmartPath, una plataforma web de gestión
escolar (multi-colegio, 4 roles) sobre **Supabase**. Léelo primero y sigue el orden.

---

## 1. Qué construir (en una frase)
Una app web todo-en-uno que reemplaza el papel/Excel/WhatsApp de un colegio: 4 roles
(**Director, Docente, Padre/Tutor, Estudiante**), cada uno con su panel, con gestión
académica, cobros, comunicación, planilla y una identidad visual original (no plantilla SaaS).

## 2. Archivos de este paquete
```
README-FABLE.md                      ← este archivo (empieza aquí)
docs/
  ESPECIFICACION-PRODUCTO.md         ← especificación completa (49 secciones) — LA FUENTE DE VERDAD
  ESQUEMA-BASE-DATOS.sql             ← esquema Postgres con RLS (39 tablas) + vistas de agregación
legal/
  POLITICA-DE-PRIVACIDAD.md
  TERMINOS-Y-CONDICIONES.md
  AVISO-TRATAMIENTO-DE-DATOS-Y-CONSENTIMIENTO.md
  LEEME-GUIA-LEGAL.md
ui-referencias/                      ← referencia VISUAL (HTML estáticos, abrir en Chrome)
  dashboard-mockup.html              ← panel Director (heatmap, KPIs, feed) — estándar de dashboards
  login-mockup.html                  ← login con fondo mosaico
  avatar-generator.html              ← motor de avatares de píxeles (portar a la app)
  ascii-nature.html                  ← metraje real → ASCII/mosaico/isolíneas
  media-wall.html / lattice/         ← "pared de medios" reutilizable (fondo login/secciones)
  assets/ , lattice/videos/          ← media libre (Mixkit): mariposa, medusa, camaleón
landing/
  index.html + assets/               ← landing page ya construido
```

## 3. Stack (obligatorio)
- **Frontend**: React + TypeScript + Vite + Tailwind + Framer Motion. Gestor: **pnpm**.
- **Backend**: **Supabase** (Postgres + Auth + RLS + Realtime + Edge Functions + Storage mínimo).
- **Pagos**: Recurrente (GT) / Stripe (internacional). **Facturación**: FEL (SAT) en Guatemala.
- **Notificaciones (gratis)**: Supabase Realtime (in-app) + Web Push + correo.
- **Tipografía**: Fraunces (títulos) + Space Grotesk (UI) + JetBrains Mono (etiquetas). Sin emojis.

## 4. Reglas NO negociables (aplicar en cada paso)
1. **RLS activada en TODAS las tablas**, aislado por `colegio_id`. Probar con los 4 roles.
2. **Sin fotos de menores**: estudiantes usan **avatares generados** (ver `avatar-generator.html`).
3. **Validar lo sensible en el servidor** (Edge Functions/RPC): XP, aprobación de pagos, notas.
4. **Texto en la base de datos; archivos comprimidos + con expiración** (controla costo).
5. **Secretos solo en variables de entorno**. `service_role` jamás en el cliente.
6. **Gráficos con datos reales** (agregaciones/vistas), nunca simulados. Estado vacío si no hay datos.
7. **UI impecable**: rejilla 8px, sin desbordes (truncar con elipsis), iconos centrados,
   composición **bento** (no rejilla uniforme), animaciones con propósito. Ver §40, §43, §46.

## 5. Orden de construcción (por fases — ver §30 del spec)
Paso 0 Setup → 1 Auth/roles → 2 Onboarding (colegio + códigos) → 3 Asistencia/notas →
4 Paneles por rol → 5 Calendario → 6 Comunicación/notificaciones → 7 Agenda Escolar →
8 Planificador → 9 Cobros → 10 Gamificación → 11 Reportes (PDF+QR) → 12 Extras.
En cada paso: construir → activar/probar RLS → desplegar.

## 6. Estructura de carpetas sugerida del proyecto
```
src/
  app/{director,docente,padre,estudiante}/   # rutas por rol
  components/   # UI reutilizable (PixelAvatar, NewsWindow, MediaWall, Heatmap…)
  features/     # dominio (auth, cobros, notas, planilla, gamificacion)
  lib/          # supabase client, validaciones (zod), helpers
  hooks/ styles/ types/
supabase/
  migrations/   # SQL versionado (usar ESQUEMA-BASE-DATOS.sql como base)
  functions/    # Edge Functions (aprobación de pagos, XP, web push, webhooks pasarela)
```

## 7. Verdades importantes (honestidad)
- Este documento es un **plano**, no código. Construye el **MVP** siguiendo el orden y
  **prueba** cada parte (sobre todo RLS por rol y cálculos de planilla) antes de producción.
- **Lo legal** (SAT/FEL, datos de menores) requiere trámites reales del colegio y **revisión
  de un abogado**. Los documentos en `legal/` son plantillas de referencia.
- Prioriza la **seguridad y la corrección** sobre la velocidad. Mejor pocas funciones bien
  hechas y seguras que muchas a medias.

## 8. Primer entregable esperado de Fable
Un MVP funcional de los **Pasos 0–4** (auth, onboarding, asistencia/notas, paneles por rol)
con **RLS probada** y la **identidad visual** de las referencias, desplegado y verificable.

> Fuente de verdad detallada: `docs/ESPECIFICACION-PRODUCTO.md`. Ante cualquier duda de
> alcance, ese documento manda.
