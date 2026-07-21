# SmartPath — Especificación de producto (plano para construcción)

> Documento para entregar a **Fable** (o cualquier agente/equipo) como plano de construcción.
> Objetivo: app web de gestión escolar, multi-colegio, con 4 roles, sobre **Supabase**.
> Alineada a Guatemala (CNB, MINEDUC, quetzales) **y** utilizable a nivel internacional.

---

## Resumen ejecutivo (leer primero)

**Qué es:** una plataforma web todo-en-uno que reemplaza el papel, el Excel y los grupos de
WhatsApp de un colegio. Cuatro roles —**Director, Docente, Padre/Tutor, Estudiante**— cada
uno con su panel, dentro de un mismo sistema multi-colegio.

**Cómo se construye:** React + TypeScript + Vite + Tailwind + Framer Motion en el frontend;
**Supabase** (Postgres + Auth + RLS + Realtime + Edge Functions) en el backend. Gestor de
paquetes: pnpm. Se construye **por fases** (ver §30).

**Principios no negociables:**
1. **RLS activada en todas las tablas**, aislado por `colegio_id` (nadie ve datos de otro
   colegio, ni siquiera adivinando IDs).
2. **Sin fotos de menores**: los estudiantes usan **avatares generados** (motor ya
   prototipado en `avatar-generator.html`). Cero almacenamiento.
3. **Validación de lo sensible en el servidor** (Edge Functions/RPC), nunca en el cliente.
4. **Texto en la base de datos; archivos comprimidos + con expiración** (controla el costo).
5. **Secretos solo en variables de entorno.**

**Costo:** el MVP corre **gratis** (Supabase free + hosting en CDN + Web Push + correo en
tramo gratis). A escala, la infraestructura es **~1–2% de los ingresos** (ver §17 y §31).
Lo que cuesta por uso (WhatsApp, IA, pasarela) se activa **solo en planes de pago**.

**Diferenciadores clave:** cobros con validación anti-fraude sin fotos (§33), planilla con
IGSS/ISR/Bono 14 (§32), Agenda Escolar con físicas y dibujo (§25), gamificación con racha
(§9), notificaciones en tiempo real gratis (§37), y avatares de píxeles (§35 / demo).

---

## Índice

1. Visión y principios · 2. Los 4 roles · 3. Permisos (RLS) · 4. Onboarding ·
5. Panel de noticias · 6. Agenda "hoja real" · 7. Planificador · 8. Cobros y pagos ·
9. Gamificación · 10. Más ideas · 11. Modelo de datos · 12. Seguridad ·
13. Localización · 14. Stack técnico · 15. Roadmap · 16. Instrucciones para Fable ·
17. Costo (gratis vs pago) · 18. Backlog por fases · 19. Widgets y UX ·
20. Blindaje de seguridad · 21. Login · 22. Escalabilidad · 23. Estructura por rol ·
24. Todo editable · 25. Agenda Escolar (físicas) · 26. Anuncios estilo Apple ·
27. Interconexión de roles · 28. Almacenamiento (DB vs archivos) · 29. Pagos y boletas ·
30. Guía de construcción por fases · 31. Costo a escala · 32. Planilla del personal ·
33. Verificación de pagos · 34. Extras de cobros · 35. Módulos adicionales ·
36. User stories · 37. Notificaciones (con código) · 38. Glosario ·
39. Convención de términos.

---

## 1. Visión y principios

SmartPath reemplaza el papel, el Excel y los grupos de WhatsApp de un colegio con una sola
plataforma clara, rápida y agradable. Principios de diseño:

1. **Cada rol ve solo lo suyo** (seguridad por rol + aislamiento por colegio).
2. **Menos fricción que el papel**: si una tarea toma más clics que a mano, está mal diseñada.
3. **Local pero global**: valores por defecto guatemaltecos, pero configurables (moneda,
   formato de reportes, idioma, currículo).
4. **Privacidad de menores por diseño**: los estudiantes nunca suben fotos; usan avatares
   generados.
5. **Cero-a-poco almacenamiento**: evitar guardar imágenes pesadas (ver módulo de pagos y
   avatares).
6. **Interactivo y con "alma"**: micro-animaciones, gamificación, elementos que se sienten
   vivos (agenda tipo hoja real).

---

## 2. Los 4 roles

Roles del sistema: **Director** (admin del colegio), **Catedrático** (docente), **Padre/Tutor**,
**Estudiante**. (Opcional futuro: **Super-admin** de SmartPath, **Secretaría/Contabilidad**.)

### 2.1 Director — panel de control total
- **Dashboard ejecutivo**: alumnos activos, asistencia del día, cartera vencida, cobros del
  mes, promedio general, alertas.
- **Gestión de estructura**: ciclos, grados, secciones, materias, horarios, jornadas.
- **Gestión de personas**: alta de docentes, padres y estudiantes (ver §4 Onboarding).
- **Motor de cobros** (colegiaturas, mora automática, validación de pagos, recordatorios).
- **Reportes**: actas, boletas, cuadros de asistencia — formato MINEDUC (GT) o plantilla
  internacional configurable. Exportables a PDF/Excel.
- **Panel de noticias**: publica avisos del colegio; conecta fuentes externas (MINEDUC,
  municipalidad, etc.) — ver §5.
- **Analíticas**: tendencias de asistencia, rendimiento por sección/materia, morosidad,
  retención.
- **Configuración**: moneda, idioma, currículo (CNB / internacional), branding (logo del
  colegio), plantillas de reportes, roles y permisos finos.
- **Bandeja de aprobaciones**: pagos por referencia, solicitudes de docentes, quejas
  escaladas.
- **Auditoría**: quién cambió qué nota, quién aprobó qué pago (trazabilidad).

### 2.2 Catedrático (docente)
- **Toma de asistencia** con un clic (presente/ausente/tardanza/justificado), historial
  automático.
- **Libro de calificaciones**: subir notas por actividad, ponderaciones, cálculo automático
  de promedios; la nota llega al padre/estudiante al guardarse.
- **Planificador de clases** (ver §7): alineado al CNB o a competencias internacionales,
  **compartible** con otros docentes y con el director.
- **Agenda virtual** hacia padres/estudiantes (ver §6): adjuntar material, tareas,
  propuestas, quejas/observaciones.
- **Tareas y objetivos**: crear tareas con fecha, rúbrica y puntos (alimenta el sistema de
  recompensas del estudiante).
- **Comunicación**: mensajes a la clase o a un padre específico (con acuse de lectura).
- **Banco de material**: subir/guardar recursos reutilizables por materia (documentos,
  enlaces).
- **Reportes rápidos**: quién no entregó, quién faltó, top y bottom de rendimiento.

### 2.3 Padre / Tutor
- **Vista del hijo/a** (varios hijos en una cuenta): asistencia, notas, tareas pendientes,
  comunicados.
- **Notificación inmediata** si el hijo no llegó al colegio.
- **Pagos**: ver cuota, pagar en línea o registrar referencia bancaria (sin subir fotos, ver
  §8); historial de pagos y comprobantes/facturas.
- **Agenda**: recibir material, propuestas y quejas del docente; responder/firmar de enterado.
- **Calendario**: exámenes, entregas, eventos, feriados.
- **Panel de noticias**: avisos del colegio y de entes públicos.
- **Reuniones**: agendar cita con docente/director (con horarios disponibles).

### 2.4 Estudiante
- **Mis tareas** (con prioridad y fecha), **mis notas**, **mi asistencia**.
- **Gamificación** (ver §9): XP, niveles, **racha** (streak), logros/insignias, recompensas
  por objetivos (tareas completadas, material adquirido, asistencia perfecta).
- **Avatar de píxeles** propio (criatura/flor/abeja/mariposa) o editor de pixel art — sin
  fotos, sin almacenamiento.
- **Agenda**: material y mensajes del docente.
- **Calendario** de entregas y exámenes.
- **Metas personales**: fijarse objetivos y verlos cumplidos.

---

## 3. Permisos (resumen RLS)

| Recurso | Director | Docente | Padre | Estudiante |
|---|---|---|---|---|
| Estructura del colegio | CRUD | leer | — | — |
| Personas (altas) | CRUD | — | — | — |
| Notas | leer todo | CRUD de sus clases | leer (su hijo) | leer (propias) |
| Asistencia | leer todo | CRUD de sus clases | leer (su hijo) | leer (propia) |
| Cobros | CRUD | — | leer/pagar (su familia) | — |
| Noticias | CRUD | crear (clase) | leer | leer |
| Agenda | leer | CRUD (sus clases) | leer/responder | leer/responder |
| Planificador | leer todo | CRUD (propios) + compartir | — | — |

Todo filtrado además por **`colegio_id`** (aislamiento multi-tenant). Ver §11.

---

## 4. Onboarding — alta simple del colegio y las personas

Flujo pensado para que sea **rápido y sin fricción**:

1. **Registro del colegio** (self-service):
   - El director crea la cuenta (correo + contraseña), nombra el colegio, elige país,
     moneda, idioma y currículo (CNB / internacional).
   - Se crea el registro `colegio` y el usuario director queda vinculado.

2. **Configurar estructura** (asistente guiado, paso a paso):
   - Grados → secciones → materias → horarios. Con plantillas predefinidas (ej. "Primaria
     GT", "Secondary International") para no empezar de cero.

3. **Invitar personas con códigos** (lo más simple posible):
   - El sistema genera **códigos de invitación de un solo uso** por rol.
   - **Docentes**: el director genera códigos o sube un CSV (nombre + correo) → se envía
     invitación; el docente entra con el código y crea su contraseña.
   - **Estudiantes**: se importan por **CSV** (nombre, grado, sección) o se agregan a mano.
     No necesitan correo obligatorio; el director/tutor gestiona su acceso.
   - **Padres**: se vinculan a su(s) hijo(s) mediante un **código familiar** que el colegio
     entrega; un padre puede tener varios hijos.
   - Regla clave: **los códigos se validan en el servidor**, son de un solo uso y expiran.

4. **Listo**: cada quien entra y ve su panel. Meta: colegio operativo en < 30 min.

> **Lógica de vinculación**: `usuario` ↔ `rol` ↔ `colegio`. Un estudiante se relaciona con
> padres vía tabla `parentesco`. Un docente se relaciona con secciones/materias vía
> `asignacion_docente`.

---

## 5. Panel de noticias (estilo iPhone)

Tarjetas apiladas, con color por fuente, título, resumen y "ver más" (como el widget de
deportes de iOS de referencia).

- **Fuentes**:
  - **Colegio** (publica el director/secretaría).
  - **MINEDUC** y otros **entes públicos** (municipalidad, salud, etc.) — configurable.
  - **Internacional**: fuentes educativas opcionales.
- **Cómo entran las noticias externas**: vía **feed** (RSS/JSON) o publicación manual. Para
  el MVP, un editor manual + soporte de RSS. (Evitar depender de scraping frágil.)
- **Segmentación**: una noticia puede ir a todo el colegio, a un grado o a una sección.
- **Interacción**: marcar como leída, guardar, notificación push/correo para urgentes.
- **Datos**: tabla `noticia` (fuente, alcance, cuerpo, fecha, prioridad).

---

## 6. Agenda virtual "hoja real" (skeuomórfica)

Una libreta digital que **se ve, se mueve y suena como papel**: pasar página con animación
de "page-flip", textura de hoja, sonido sutil (activable). La crea el **catedrático** para
padres y estudiantes.

- **Contenido adjuntable por página**:
  - **Material** (documentos, enlaces, imágenes de apoyo).
  - **Tareas / propuestas** (con fecha y puntos).
  - **Quejas / observaciones** (privadas al padre correspondiente).
  - **Notas del día** de la clase.
- **Interacción del padre/estudiante**: leer, **firmar de enterado**, responder.
- **Tecnología sugerida**: animación de page-flip con CSS 3D / librería ligera; sonido con
  `<audio>` corto; respetar `prefers-reduced-motion` (accesibilidad).
- **Privacidad**: las quejas/observaciones son visibles solo para el padre del alumno
  involucrado (RLS estricta).
- **Datos**: `agenda_pagina` (clase, fecha, tipo, contenido, adjuntos), `agenda_respuesta`.

---

## 7. Planificador docente (compartible)

- Planificación por **unidad / competencia / contenido**, alineable al **CNB** (áreas
  curriculares GT) o a marcos internacionales (competencias, objetivos de aprendizaje).
- **Plantillas** reutilizables y **biblioteca compartida** entre docentes del colegio (o
  export/import).
- Vincular cada plan con sus **tareas, material y evaluaciones**.
- **Compartir**: con el director (revisión), con otros docentes (colaboración), o marcar como
  privado.
- Vista **calendario** y vista **lista**; exportable a PDF.

---

## 8. Cobros y pagos (sin almacenar fotos)

- **Colegiaturas** con **mora automática** configurable (día y monto).
- **Validación de pago legítima sin imágenes** (3 vías, priorizadas):
  1. **Pasarela** (Recurrente en GT / Stripe internacional): pago con tarjeta → webhook →
     cuota saldada automáticamente. Cero almacenamiento.
  2. **Referencia bancaria por texto**: el padre escribe No. de boleta + monto + fecha; el
     director concilia con su estado de cuenta y aprueba. Cero imágenes.
  3. **(Opcional) foto temporal + OCR**: si se sube foto, se extrae el texto y **se borra la
     imagen** de inmediato.
- **Facturación**: integración con **FEL (SAT)** en Guatemala; plantilla genérica
  internacional.
- **Recordatorios** automáticos por correo/push antes del vencimiento y en mora.
- **Datos**: `cuota`, `pago`, `mora_config`, `conciliacion`.

---

## 9. Gamificación (estudiante)

- **XP y niveles** por acciones positivas: entregar tareas, asistencia, cumplir objetivos,
  adquirir material.
- **Racha (streak)**: días/semanas consecutivas cumpliendo (asistencia + entregas). Con
  "protección de racha" ocasional para no desmotivar.
- **Logros / insignias** por hitos (primera semana perfecta, 10 tareas seguidas, etc.).
- **Metas**: el estudiante fija objetivos; al cumplirlos gana recompensas.
- **Tablero opcional** por sección (competencia sana; con opción de anonimizar).
- **Reglas anti-abuso**: XP validado en servidor (nunca en cliente); acciones registradas.
- **Datos**: `xp_evento`, `logro`, `racha`, `meta`.

---

## 10. Más ideas (para hacerla imprescindible)

**Ahorro de tiempo / adiós al papel**
- **Circulares con acuse de lectura** (saber quién leyó, sin perseguir a nadie).
- **Permisos/ausencias digitales**: el padre justifica una falta desde la app.
- **Constancias automáticas** (de inscripción, de conducta, de notas) con un clic.
- **Firma digital de enterado** en comunicados y boletas.

**Comunicación**
- **Chat colegio↔familia** con horarios de atención (no 24/7) y plantillas.
- **Traducción automática** de comunicados (útil internacional y comunidades bilingües; en
  GT idiomas mayas a futuro).
- **Encuestas** rápidas a padres (ej. confirmación de asistencia a evento).

**Académico**
- **Rúbricas** reutilizables para calificar.
- **Alertas tempranas**: detecta caída de rendimiento/asistencia y avisa al docente/padre.
- **Recuperaciones y planes de mejora** con seguimiento.
- **Portafolio del estudiante** (evidencias de aprendizaje, sin fotos de la persona).

**Operación del colegio**
- **Horario visual** (arrastrar y soltar) con detección de choques.
- **Control de inventario** de material/libros; vincular "compró material" con recompensas.
- **Gestión de eventos** (actos, excursiones) con permisos y cobro asociado.
- **Carné digital** del estudiante con QR (para entrada/salida).
- **Registro de entrada/salida** con QR o código (seguridad).

**Datos y decisiones**
- **Predicción de morosidad** (qué familias probablemente se atrasen).
- **Reporte de retención** (riesgo de deserción).
- **Exportaciones** a Excel/PDF en todos lados.

**Bienestar y comunidad**
- **Bitácora de conducta** positiva/negativa (con enfoque formativo).
- **Buzón anónimo** de bullying/quejas (moderado).
- **Cartelera de logros** del colegio.

**Accesibilidad e inclusión**
- Modo alto contraste, tamaños de fuente, `prefers-reduced-motion`.
- Multi-idioma (es/en al inicio; extensible).

---

## 11. Modelo de datos (Supabase / PostgreSQL) — resumen

Ver `docs/ESQUEMA-BASE-DATOS.sql` para el detalle con RLS. Tablas núcleo:

- `colegio` (tenant raíz) — país, moneda, idioma, currículo, branding.
- `perfil` (extiende `auth.users`) — nombre, rol, `colegio_id`, avatar (seed o código pixel).
- `rol` / o campo `rol` enum: `director|docente|padre|estudiante`.
- `grado`, `seccion`, `materia`, `horario`.
- `asignacion_docente` (docente ↔ sección ↔ materia).
- `estudiante` (perfil de alumno) y `parentesco` (padre ↔ estudiante).
- `invitacion` (código, rol, colegio, usado, expira).
- `asistencia`, `calificacion`, `tarea`, `entrega`.
- `agenda_pagina`, `agenda_respuesta`.
- `plan_clase`.
- `noticia`.
- `cuota`, `pago`, `mora_config`.
- `xp_evento`, `logro`, `racha`, `meta`.
- `mensaje`, `comunicado`, `acuse_lectura`.
- `auditoria` (trazabilidad de cambios sensibles).

**Regla de oro RLS**: casi toda tabla lleva `colegio_id` y las políticas exigen que el
`colegio_id` del registro sea igual al del usuario autenticado; luego se afina por rol.

---

## 12. Seguridad (como senior de ciberseguridad)

- **Supabase Auth** (hashing de contraseñas gestionado).
- **RLS activada en TODAS las tablas** (nada accesible por defecto). Nunca confiar en el
  cliente.
- **Aislamiento por `colegio_id`** en cada política.
- **Validación de servidor** para acciones sensibles (XP, aprobación de pagos, cambio de
  notas) vía **Edge Functions**/RPC con `security definer` controlado.
- **Códigos de invitación** de un solo uso, con expiración, validados en servidor.
- **Secretos** en variables de entorno (`.env`), nunca en el repo. Claves `service_role`
  solo en backend, jamás en el cliente.
- **Pagos**: datos de tarjeta solo en la pasarela (PCI del proveedor).
- **Auditoría** de cambios críticos.
- **Rate limiting** y protección contra XSS/CSRF/SQLi.
- **Backups** automáticos y política de retención.
- **Minimización de datos** de menores (sin fotos de estudiantes).

## 13. Localización (GT + internacional)

- **Configurable por colegio**: moneda (GTQ/USD/…), idioma (es/en), formato de fecha,
  currículo (CNB / competencias internacionales), plantilla de reportes (MINEDUC / genérica).
- Reportes oficiales de GT como **plantilla**, no como estructura rígida, para poder añadir
  otros países.

## 14. Stack técnico recomendado

- **Frontend**: React + TypeScript + Vite + Tailwind + Framer Motion (interactividad).
- **Backend/DB**: Supabase (Postgres + Auth + RLS + Storage mínimo + Edge Functions).
- **Pagos**: Recurrente (GT) / Stripe (internacional).
- **Correo**: proveedor transaccional (Resend/SendGrid).
- **Gestión de paquetes**: pnpm.

### Estructura de carpetas sugerida
```
src/
├── app/                 # rutas / páginas por rol
│   ├── director/
│   ├── docente/
│   ├── padre/
│   └── estudiante/
├── components/          # UI reutilizable (incl. PixelAvatar, NewsPanel, Agenda)
├── features/            # lógica por dominio (auth, cobros, notas, gamificacion)
├── lib/                 # supabase client, helpers, validaciones
├── hooks/
├── styles/
└── types/
supabase/
├── migrations/          # SQL versionado (tablas + RLS)
└── functions/           # Edge Functions (XP, aprobación de pagos, webhooks)
```

## 15. Roadmap sugerido (MVP → completo)

- **MVP (fase 1)**: onboarding (colegio + códigos), roles, asistencia, notas, comunicados,
  panel de noticias básico, avatares.
- **Fase 2**: cobros + pasarela, agenda skeuomórfica, gamificación, planificador.
- **Fase 3**: analíticas/alertas, QR de entrada, FEL, multi-idioma, tablero de retención.

---

## 16. Instrucciones para Fable
1. Respeta la **privacidad de menores** (sin fotos de estudiantes; usar el motor de avatares
   ya prototipado en `avatar-generator.html`).
2. **RLS activada en todas las tablas** desde el día uno, con aislamiento por `colegio_id`.
3. Onboarding **simple** con códigos de un solo uso validados en servidor.
4. Mantén todo **configurable** para GT e internacional.
5. No pongas claves ni secretos en el repositorio.
6. Reutiliza el diseño/paleta del landing (tokens de color, tipografías) para coherencia de
   marca.

---

## 17. Costo real: qué es GRATIS y qué CUESTA (arranque con $0)

> La verdad sin adornos: puedes construir y operar casi TODO el MVP por **$0** hasta tener
> clientes reales. Solo **dos** cosas cuestan desde el inicio (WhatsApp y la IA). Difiérelas.

### Infraestructura base — GRATIS al inicio
- **Supabase (free tier):** 500 MB de base de datos, 50,000 usuarios activos/mes de auth,
  1 GB de storage, 5 GB de egreso. Suficiente para tus primeros colegios. Pro ($25/mes) solo
  cuando crezcas.
- **Hosting (Vercel/Netlify/Cloudflare Pages, free tier):** gratis para una app así.
- **Web Push (notificaciones del navegador):** **gratis** (estándar del navegador). Úsalo en
  lugar de WhatsApp al inicio.
- **Correo transaccional:** Resend/Brevo tienen tramos gratis (~3,000/mes). Suficiente para
  empezar.

### Ideas GRATIS (solo tu tiempo de desarrollo)
Estas no generan gasto de servicios: PWA/offline, resumen semanal por correo/push, exportar
calendario, **boletas/constancias con QR verificable**, toda la **gamificación** (XP, racha,
tienda de recompensas, avatares evolutivos), reservas de recursos, cartelera de logros,
encuestas/votaciones, directorio de clase, eventos e inscripciones, sistema de méritos,
**panel financiero**, multi-sede, portal de admisiones, **detección de riesgo/deserción**
(cruzar datos que ya tienes), bitácora de conducta, buzón anónimo, modo alto contraste.
→ **El 80% de las ideas entra aquí.**

### Ideas que CUESTAN (difiérelas hasta tener ingresos)
| Idea | Por qué cuesta | Alternativa gratis para empezar |
|---|---|---|
| **WhatsApp API** | Meta cobra por conversación (hay ~1,000 gratis/mes, luego pago) | **Web Push + correo** (gratis) al inicio |
| **Asistente con IA** (planes/exámenes) | Las llamadas al modelo cuestan por uso | Plantillas manuales primero; IA como función premium después |
| **SMS** | Cada mensaje cuesta | Push/correo |
| **Integración bancaria automática** | Compleja y con costos | Validación por **referencia (texto)** — gratis |
| **Pasarela de pago** | Comisión por transacción (~4-5%) | Registro de pago por referencia; la comisión la cubre el cobro |
| **Idiomas mayas** | La traducción cuesta trabajo/dinero producirla | Empezar es/en; agregar después |
| **Correo/almacenamiento a gran escala** | Al pasar los tramos gratis | Comprimir, minimizar, avatares generados (ya definido) |

### Stack "$0" recomendado para arrancar
**Supabase (free) + Vercel (free) + Web Push (free) + correo en tramo gratis.**
Con esto operas los primeros colegios sin pagar nada. Cuando tengas ingresos, activas
WhatsApp e IA como diferenciadores.

> **Regla de oro para no gastar de más:** todo lo que se cobra por-uso (WhatsApp, IA, SMS)
> se activa **solo en planes de pago** o cuando el ingreso ya lo cubre. Nunca lo pongas
> "gratis para todos" o te come el margen.

---

## 18. Backlog completo por fases (todas las ideas priorizadas)

### Fase 1 — MVP ($0, lo esencial)
Onboarding (colegio + códigos), 4 roles, asistencia, notas/boletas, comunicados con acuse de
lectura, panel de noticias básico, avatares generados, **PWA/offline**, **Web Push**,
**resumen semanal automático**, calendario exportable, justificantes de ausencia.

### Fase 2 — Enganche y diferenciación ($0 en su mayoría)
Agenda skeuomórfica "hoja real", planificador docente compartible, **gamificación completa**
(XP, racha, logros, tienda de recompensas, avatares evolutivos), **boletas con QR
verificable**, cobros por referencia + recordatorios, rúbricas, reservas de recursos,
encuestas/votaciones, eventos con inscripción, cartelera de logros, directorio de clase.

### Fase 3 — Inteligencia y escala (algunas de pago)
**Detección de riesgo/deserción** (gratis), panel financiero y proyección (gratis),
multi-sede (gratis), portal de admisiones (gratis), **asistente con IA** (de pago),
**WhatsApp** (de pago), pasarela de pago + FEL, alertas tempranas, bitácora de conducta,
buzón anónimo anti-bullying.

### Fase 4 — Ambiciosas (con costo/complejidad)
Control de acceso con QR/carné, transporte escolar, integración bancaria automática,
idiomas mayas, reconocimiento de constancias con OCR.

---

## 19. Diseño de widgets y UX (paneles cómodos y ordenados)

Meta: que cada panel sea **cómodo, entendible, atractivo y ordenado**, sin hostigar. Reglas
para Fable:

### Principios
1. **Máximo 5–7 widgets por vista.** Más de eso satura. Lo demás va en subpáginas.
2. **Jerarquía clara:** lo más importante arriba a la izquierda (lo primero que se lee).
   Ej. Director: asistencia de hoy + cobros + alertas. Estudiante: tareas de hoy + racha.
3. **Divulgación progresiva:** mostrar el resumen; el detalle aparece al hacer clic ("ver
   más", como el panel de noticias de iPhone). No abrumar con todo de golpe.
4. **Widgets como tarjetas** consistentes: mismo radio, sombra, espaciado y tipografía en
   todos (reusar tokens del landing).
5. **Un color por tipo de dato** (cobros=ámbar, alerta=rojo, logro=verde) para lectura rápida.
6. **Cuadrícula ordenada** (grid responsive), no elementos flotando. Alineación perfecta.
7. **Estados vacíos amables:** "Aún no hay tareas — ¡todo al día!" en vez de un hueco en
   blanco. Con un dibujito (la mascota).
8. **Mobile-first:** la mayoría de padres entra desde el celular. Diseñar primero para móvil,
   luego escalar a escritorio.
9. **Personalización ligera:** permitir reordenar/ocultar widgets (arrastrar), pero con un
   orden por defecto ya bien pensado.
10. **Micro-interacciones con propósito** (no decorativas): contadores que animan, la racha
    que "pulsa", confetti al cumplir una meta. Respetar `prefers-reduced-motion`.
11. **Accesibilidad:** contraste suficiente, tamaños de toque ≥44px, foco visible, textos
    alternativos.
12. **Consistencia total:** los mismos patrones en los 4 roles para que aprender uno enseñe
    los demás.

### Layout sugerido por rol (arriba = más importante)
- **Director:** [Asistencia hoy] [Cobros del mes] [Cartera vencida] · [Alertas] [Noticias]
  [Accesos rápidos].
- **Docente:** [Mis clases de hoy] [Pendientes por calificar] · [Agenda] [Planificador]
  [Mensajes].
- **Padre:** [Estado de mi hijo hoy] [Cuota] · [Tareas pendientes] [Comunicados] [Calendario].
- **Estudiante:** [Tareas de hoy] [Mi racha/XP] · [Mis notas] [Logros] [Agenda].

### Anti-patrones a evitar
- Pantallas con 15 números y ningún foco.
- Menús de 10 opciones al mismo nivel (agrupar por categorías).
- Texto denso sin espacio en blanco.
- Notificaciones excesivas (agrupar y priorizar; nada de spam).

---

## 20. Blindaje de seguridad (anti-ataques e inyecciones)

Además de lo básico (§12), medidas concretas contra ataques reales:

### Contra inyección SQL
- **Nunca** construir SQL concatenando texto del usuario. Usar el **query builder** de
  Supabase o **consultas parametrizadas** en RPC. Toda entrada viaja como parámetro, jamás
  como string interpolado.
- Funciones RPC con `security definer` **solo** con `search_path` fijo y validación interna.

### Contra XSS (scripts inyectados)
- React **escapa por defecto**; nunca usar `dangerouslySetInnerHTML` con datos del usuario.
- El contenido rico (agenda, noticias) se **sanitiza** con DOMPurify antes de renderizar.
- **CSP** (Content-Security-Policy) estricta que bloquee scripts externos no autorizados.

### Contra IDOR (ver datos de otros)
- **RLS** hace imposible leer filas de otro colegio o de otro usuario **aunque se adivine el
  ID**. Es la defensa principal. Probar cada tabla con los 4 roles.

### Contra fuerza bruta / abuso de login
- **Límite de intentos** + bloqueo temporal; **captcha** (Cloudflare Turnstile, gratis) en
  registro y login.
- **Rate limiting** en Edge Functions y endpoints sensibles.

### Autenticación robusta
- Política de **contraseña fuerte**, verificación de correo, **MFA opcional** (recomendado
  para el director).
- Sesiones con **JWT de Supabase** (expiran y se refrescan solos). `service_role` **jamás**
  en el cliente.

### Cabeceras y transporte
- HTTPS forzado (**HSTS**), `X-Frame-Options`/frame-ancestors (anti-clickjacking),
  `X-Content-Type-Options`, Referrer-Policy.

### Archivos (los pocos que haya)
- Validar **tipo y tamaño**; URLs **firmadas** de corta expiración; nunca exponer bucket
  público. (Recordar: sin fotos de menores.)

### Operación y auditoría
- **Tabla de auditoría** para acciones sensibles (cambios de nota, aprobación de pagos).
- **Supabase Advisors** (linter de seguridad) revisado en cada release.
- **Dependabot / npm audit** para vulnerabilidades de librerías.
- **Backups automáticos** + plan de recuperación.
- **Pen-test / revisión de seguridad** antes de lanzar a producción.
- **Secretos** solo en variables de entorno; rotación periódica de llaves.

### Principio rector
Todo dato sensible se valida **en el servidor** (Edge Functions/RPC), nunca se confía en el
cliente. El cliente solo pinta; el servidor decide.

---

## 21. Método de inicio de sesión (cómo entra cada rol)

**Una sola pantalla de login** que, tras autenticar, lee el `rol` del `perfil` y redirige al
panel correspondiente. Motor: **Supabase Auth**.

| Rol | Cómo inicia sesión |
|---|---|
| **Director** | Correo + contraseña. **MFA recomendado.** |
| **Docente** | Correo + contraseña (o enlace mágico). Entra la primera vez con **código de invitación**. |
| **Padre/Tutor** | Correo + contraseña. Se vincula a sus hijos con **código familiar**. |
| **Estudiante** | **Puede no tener correo.** Inicia con **usuario/carné + PIN** emitido por el colegio (o enlace del padre). Sencillo y apto para menores. |

- **Primer ingreso** siempre por **código de un solo uso** (validado en servidor, expira).
- **Recuperación** por correo (para quien tenga); para estudiantes, el director/padre
  reinicia el PIN.
- **Enlaces mágicos** (magic link) como opción sin contraseña para padres.
- Sesión persistente y segura (JWT con refresco automático).

> Flujo: `login → Supabase Auth valida → lee perfil.rol → redirige a /director | /docente | /padre | /estudiante`. Cada ruta protegida verifica rol **en servidor**, no solo en el cliente.

---

## 22. Escalabilidad (¿se caerá con muchos usuarios?)

Respuesta honesta: **no se cae por cantidad de usuarios si se construye bien.** Lo que tumba
una app no es "mucha gente", son **consultas mal hechas y falta de índices**. Reglas:

- **Frontend estático en CDN** (Vercel/Cloudflare): escala prácticamente infinito para la
  interfaz; no hay servidor que "se caiga".
- **Base de datos (Supabase/Postgres)** con **pool de conexiones (PgBouncer)**: soporta
  miles de usuarios concurrentes en planes modestos.
- **Índices** en columnas calientes: `colegio_id` y todas las llaves foráneas. Sin esto,
  todo se vuelve lento al crecer.
- **Paginación siempre**: nunca cargar "todas las filas". Listas de a 20–50.
- **Caché en el cliente** (React Query/SWR): menos golpes a la base de datos.
- **Evitar N+1**: traer datos en consultas agrupadas, no una por fila.
- **Realtime con cabeza**: suscribirse solo a lo visible (una sección, no todo el colegio).
- **Escalar por plan**: Free para validar; **Pro ($25)** aguanta bastante; planes mayores
  cuando de verdad crezcas. El costo sube **con los ingresos**, no antes.

**Conclusión:** con índices + paginación + pooling + CDN, cientos de colegios con miles de
alumnos cada uno funcionan sin problema. La arquitectura ya está pensada para eso.

---

## 23. Estructura final por rol (mapa de navegación)

Lo que ve cada rol al entrar (secciones del menú). Cada rol **solo** ve lo suyo (RLS + rutas
protegidas por rol).

### Director  `/director`
`Inicio` (dashboard) · `Colegio` (grados/secciones/materias/horarios) · `Personas`
(docentes/padres/estudiantes + invitaciones) · `Académico` (notas/asistencia/reportes) ·
`Cobros` · `Noticias` · `Analíticas` · `Configuración` · `Auditoría`.

### Catedrático  `/docente`
`Inicio` (mis clases de hoy) · `Asistencia` · `Calificaciones` · `Tareas` · `Agenda` ·
`Planificador` · `Material` · `Mensajes`.

### Padre/Tutor  `/padre`
`Inicio` (estado de mi(s) hijo(s)) · `Notas` · `Asistencia` · `Tareas` · `Agenda` · `Pagos`
· `Comunicados` · `Calendario` · `Reuniones`.

### Estudiante  `/estudiante`
`Inicio` (tareas de hoy + racha/XP) · `Mis notas` · `Mi asistencia` · `Tareas` · `Logros`
· `Agenda` · `Calendario` · `Mi avatar`.

> Regla: cada ruta valida el rol **en servidor**. Un padre que fuerce la URL `/director` es
> rechazado por la política de rol y por RLS — no ve nada.

---

## 24. Todo editable y configurable (principio transversal)

Nada "quemado": el usuario ajusta lo suyo. Todo esto es **gratis** (solo son datos):

### Calendario editable con colores
- Agregar/editar/borrar eventos (exámenes, entregas, reuniones, feriados, actividades).
- **Color a elección** por evento o por categoría (ej. "Exámenes = rojo", "Eventos = verde").
- Eventos con alcance: personal, sección, grado o colegio.
- Repetición (semanal, mensual), recordatorios, y **exportable** (iCal/Google — gratis).
- Vistas: mes / semana / día / agenda.
- Datos: `evento_calendario` (titulo, fecha_ini, fecha_fin, color, categoria, alcance, repeticion).

### Planificador con DOS modos (a elección del docente)
1. **Modo CNB**: plantillas con las áreas curriculares del Currículo Nacional Base ya
   cargadas; el docente solo rellena.
2. **Modo libre**: crea su **propia estructura** de planificación desde cero (sus secciones,
   sus campos).
- Puede mezclar: partir de CNB y personalizar. Guardar como plantilla reutilizable.
- Datos: `plan_clase.modo` = `'cnb' | 'libre'`, `contenido jsonb` flexible.

### Otros configurables
- Ponderaciones de notas, escalas de calificación, periodos/bimestres.
- Categorías y colores de noticias, de eventos, de recompensas.
- Branding del colegio (logo, color primario).
- Idioma, moneda, formato de reportes.

---

## 25. "Agenda Escolar" con físicas realistas (libreta interactiva)

Una libreta digital que se siente **real**: pasar hoja con animación 3D, textura de papel,
sonido sutil (activable), y elementos que se mueven con física ligera.

### Notas tipo "sticky" con física
- El catedrático suelta **notitas adhesivas** (post-it) en la página; caen/rebotan con una
  física suave, se pueden **arrastrar**, girar levemente y fijar.
- Colores a elección; texto libre.
- **Tecnología gratis**: animación con CSS 3D + una librería ligera de física/springs
  (Framer Motion o similar). Respetar `prefers-reduced-motion`.

### Dibujo dentro del libro
- El docente puede **dibujar figuras a mano** dentro de la página (líneas, formas, marcas)
  sobre un `<canvas>`.
- Herramientas: lápiz, colores, grosor, borrador, deshacer.
- **Sin costo de almacenamiento**: el dibujo se guarda como **trazos vectoriales (JSON
  compacto)**, no como imagen. Unos pocos KB por página, se redibuja al abrir.
- Datos: `agenda_pagina.dibujo jsonb` (lista de trazos: color, grosor, puntos).

### Contenido por página (además del dibujo/notas)
- Material, tareas, propuestas, quejas privadas, notas del día (ya en §6).
- El padre/estudiante **lee, responde y firma de enterado**.

> Todo esto es **gratis**: es front-end + datos JSON en Supabase. Cero servicios externos.

---

## 26. Panel de anuncios estilo Apple + fuentes externas (MINEDUC, etc.)

### El panel visual (estilo iOS) — SÍ se puede, GRATIS
Tarjetas apiladas con color por fuente, título, marcador y "ver más" (como la referencia de
iOS). Es **puro front-end**: 100% gratis, se ve premium. Animaciones de entrada al hacer
scroll, expandir/colapsar, marcar leído/guardar.

### Conectar con MINEDUC u otras instituciones — la verdad honesta
Traer publicaciones de **redes sociales** (Facebook, X/Twitter, Instagram) tiene límites que
debes conocer:

| Método | ¿Gratis y legal? | Nota |
|---|---|---|
| **RSS / feed oficial** del ente | ✅ Sí | Si la institución publica RSS, se ingiere directo. Lo ideal. |
| **Publicación manual** por el admin | ✅ Sí | El colegio copia/pega o enlaza el anuncio. Simple y 100% legal. |
| **API oficial de Facebook/Instagram** | ⚠️ Parcial | Requiere app aprobada por Meta y permisos; complejo. Gratis pero con trámite. |
| **API de X/Twitter** | ❌ De pago | Hoy la API cuesta. Evitar al inicio. |
| **Scraping** de las redes | ❌ No recomendado | Frágil y suele violar términos de uso. **Evitar.** |

**Recomendación honesta para arrancar gratis y legal:**
1. **RSS oficial** donde exista (MINEDUC/gobierno suelen tener).
2. **Publicación manual/curada** por el director (con enlace a la fuente original).
3. Más adelante, si vale la pena, integrar la **API oficial de Facebook** (trámite, pero
   gratis).

> Regla: **enlazar a la fuente oficial** (no copiar contenido ajeno como propio) evita
> problemas de copyright y de términos de uso.

---

## 27. Interconexión de los roles (cómo se unen, fácil y seguro)

Todo se conecta por **relaciones en la base de datos**, y los cambios fluyen en **tiempo
real** (Supabase Realtime, incluido — gratis). Cadena de vínculos:

```
COLEGIO
  └─ Grados → Secciones → Materias → Horarios
        └─ asignacion_docente  (Docente ↔ Sección ↔ Materia)
        └─ Estudiante (en una sección)
              └─ parentesco   (Padre ↔ Estudiante)
```

### Cómo fluye la información (ejemplos reales)
- El **docente** guarda una nota → por la relación `estudiante → parentesco`, al **padre** y
  al **estudiante** les llega **al instante** (Realtime) y por notificación.
- El **docente** marca una falta → el **padre** recibe aviso inmediato.
- El **director** publica un comunicado a un grado → llega solo a las secciones de ese grado.
- El **docente** pone una nota en la **Agenda Escolar** → el padre/estudiante de esa sección
  la ve y firma de enterado.
- El **padre** registra un pago por referencia → entra a la **bandeja de aprobación** del
  director.

### Por qué es fácil y cómodo
- **Un solo login** por persona; el sistema sabe su rol y sus vínculos, y arma su panel.
- Un padre con varios hijos ve **todo en una cuenta** (cambia de hijo con un toque).
- Un docente ve solo **sus** secciones/materias; no navega de más.

### Por qué es seguro (y gratis)
- Cada vínculo se respeta con **RLS**: el padre solo ve datos de **sus** hijos; el docente
  solo de **sus** clases; todo aislado por `colegio_id`.
- Sin servicios extra: relaciones + Realtime + RLS ya vienen en **Supabase** (lo que pagas).
- **Escala** sin costo adicional relevante: son consultas indexadas, no procesos pesados.

---

## 28. Almacenamiento: base de datos vs archivos (clave para el costo)

Hay que separar DOS cosas que en Supabase cuestan distinto:

| Tipo | Dónde vive | ¿Pesa? | Ejemplos |
|---|---|---|---|
| **Texto / datos** | Base de datos (Postgres) | **Casi nada** | Noticias, notas, asistencia, mensajes, eventos, trazos de dibujo (JSON) |
| **Archivos / imágenes** | Storage (bucket) | **Sí, mucho** | Fotos, PDFs, videos, comprobantes escaneados |

**Conclusión honesta:** una noticia o anuncio del director es **texto** → vive en la base
de datos y ocupa **unos pocos KB**. El plan gratis (500 MB) guarda **cientos de miles** de
anuncios. **El texto NO es tu problema de costo.** El problema serían las **imágenes**, y
por eso ya decidimos: sin fotos de menores, avatares generados, comprobantes por referencia.

### Anuncios del director: publicación manual + auto-borrado
- Sí, se guarda en Supabase (en la tabla `noticia`), pero por ser texto **es despreciable**.
- Aun así, para mantener todo limpio: cada anuncio lleva **fecha de expiración** (`expira_en`)
  y un **trabajo programado gratuito** (pg_cron en Supabase, o Edge Function agendada) borra
  los vencidos automáticamente. Cero mantenimiento manual, cero costo.
- Si el director adjunta una **imagen** a un anuncio: comprimirla y aplicarle expiración
  (borrado automático a los X días). Ahí sí importa el peso; el texto no.
- Campo sugerido: `noticia.expira_en timestamptz` (por defecto, ej. 30–60 días).

> Regla simple: **texto = guárdalo tranquilo; archivos = comprime, expira y borra.**

---

## 29. Método de pagos y boletas (recordatorio consolidado)

Aclaración de términos (en Guatemala "boleta" es ambiguo):
- **Boleta de pago / depósito** = comprobante de que el padre pagó.
- **Boleta de calificaciones** = reporte de notas del alumno.

### A) Cobros y comprobantes de pago — SIN almacenar fotos
Tres formas de validar un pago de forma legítima (de mejor a más simple):
1. **Pasarela de pago** (Recurrente en GT / Stripe): el padre paga con tarjeta → llega un
   webhook "pagado" → la cuota se marca saldada **automáticamente**. Cero almacenamiento.
   (Costo: comisión ~4-5% por transacción, la cubre el propio cobro.)
2. **Referencia bancaria por texto** (gratis): el padre deposita en el banco y **escribe el
   No. de boleta + monto + fecha** (solo texto). El director concila con su estado de cuenta
   y aprueba con un clic. **Sin imágenes.** → *recomendado para arrancar gratis.*
3. **Foto temporal + OCR** (si de plano se necesita): se sube la foto, se **lee el texto**
   (referencia/monto), se guarda el dato y **se borra la imagen** de inmediato.

Flujo: `padre registra pago (referencia) → estado 'en_revision' → director aprueba →
estado 'pagado' → cuota saldada → notificación al padre`. Todo con auditoría.

### B) Boletas de calificaciones (reportes de notas)
- Se **generan al vuelo como PDF** desde los datos de notas (no se almacenan como archivo).
- Plantilla **MINEDUC** (GT) o genérica internacional, configurable.
- Con **QR verificable** opcional (anti-falsificación) — gratis.
- El padre las **descarga cuando quiere**; no ocupan storage permanente.

### C) Facturación
- En GT, integrar **FEL (SAT)** para facturar las suscripciones y/o colegiaturas.
- Fuera de GT, plantilla de factura genérica.

---

## 30. Guía de construcción por fases para Fable (paso a paso)

Orden recomendado para construir **poco a poco**, probando seguridad en cada paso. Cada paso:
construir → activar RLS → probar con los 4 roles → desplegar.

- **Paso 0 — Setup**: Vite + React + TS + Tailwind + Framer Motion; proyecto Supabase;
  variables de entorno; cliente Supabase; layout base con la paleta del landing.
- **Paso 1 — Auth y roles**: registro/login, tabla `perfil` con `rol` y `colegio_id`,
  redirección por rol, rutas protegidas (verificación en servidor).
- **Paso 2 — Onboarding**: crear colegio, asistente de estructura (grados/secciones/materias),
  invitaciones por código de un solo uso, importación CSV, vínculos padre-hijo.
- **Paso 3 — Núcleo académico**: asistencia y calificaciones (con Realtime hacia padres).
- **Paso 4 — Paneles por rol**: dashboards y navegación de cada rol (§23), estados vacíos.
- **Paso 5 — Calendario** editable con colores y recordatorios.
- **Paso 6 — Comunicación**: comunicados/anuncios con expiración + notificaciones
  (Realtime in-app + Web Push + correo).
- **Paso 7 — Agenda Escolar**: libreta con notas sticky (física) y dibujo (canvas → JSON).
- **Paso 8 — Planificador**: modos CNB y libre; compartir.
- **Paso 9 — Cobros**: cuotas, mora, pago por referencia + aprobación; (pasarela después).
- **Paso 10 — Gamificación**: XP, racha, logros, metas (validado en servidor).
- **Paso 11 — Reportes**: boletas/actas en PDF al vuelo, con QR opcional.
- **Paso 12 — Extras por fase**: analíticas, alertas, QR de acceso, FEL, multi-idioma.

**Reglas fijas en cada paso** (no negociables):
1. RLS activada y probada por rol + aislamiento por `colegio_id`.
2. Sin fotos de menores (avatares generados).
3. Validación de lo sensible en servidor (Edge Functions/RPC).
4. Paginación + índices desde el inicio.
5. Secretos solo en variables de entorno.
6. Texto en base de datos; archivos comprimidos + con expiración.

---

## 31. Costo real a escala (¿cuánto gasto con muchos clientes?)

Verdad sin adornos. La clave: como **evitamos guardar imágenes**, el costo de infraestructura
se mantiene **bajo y predecible**, y siempre es una **fracción pequeña de tus ingresos**.

### Disponibilidad 24/7
La app está disponible **24 horas, todos los días, sin costo extra**: el frontend vive en un
CDN (siempre encendido) y Supabase no se apaga en plan de pago. La "disponibilidad 24/7" es
**parte de la arquitectura**, no un plan aparte que se pague.
(Si te referías a dar **soporte** en 24h a los colegios, eso NO es costo de servidores: es
**tu tiempo** o el de alguien que contrates. Se ofrece como beneficio de los planes altos.)

### Proyección de costos por etapa (infraestructura)
| Etapa | Clientes | Stack | Costo aprox./mes |
|---|---|---|---|
| Validación | 1–5 colegios | Supabase Free + Cloudflare Pages Free + correo free | **~$0** (solo dominio ~$1) |
| Arranque | 5–30 colegios | **Supabase Pro $25** + hosting free + correo free/barato | **~$25–45** |
| Crecimiento | 30–100 colegios (miles de alumnos) | Supabase Pro + uso extra + correo $20 + hosting $20 | **~$75–130** |
| Escala | 100+ colegios | Supabase con más cómputo + correo + hosting | **~$150–500** |

> A 100 colegios en plan Colegio (Q1,290) facturas ~**Q129,000/mes (~$16,700)**. Pagar
> ~$150–300 de infraestructura es **~1–2% de tus ingresos**. Sanísimo.

### Qué SÍ escala con el uso (vigílalo)
Costos que suben con volumen — actívalos **solo en planes de pago** para que el ingreso los
cubra:
- **WhatsApp / SMS** (por mensaje) → usar Web Push + correo gratis al inicio.
- **IA** (por uso) → función premium.
- **Pasarela de pago** (~4–5% por transacción) → la cubre el propio cobro.
- **Correo a gran volumen** → tramos de pago tras el gratis.
- **Egress/cómputo de Supabase** si hay consultas pesadas → se controla con índices,
  paginación y caché (ya definido).

### Regla de oro del gasto
1. Lo que se cobra **por uso** (WhatsApp, IA, SMS) va **solo en planes de pago**.
2. **Sin imágenes** = sin la factura que mata a las apps escolares.
3. Índices + paginación + caché = la base de datos no se dispara en costo.
4. El costo de infra crece **detrás** del ingreso, nunca por delante.

**Conclusión honesta:** con este diseño, incluso con muchos clientes gastarías **cientos de
dólares al mes, no miles**, y siempre por debajo del ~2–5% de lo que facturas. Es un negocio
de **márgenes altos** si se mantiene la disciplina de no almacenar archivos pesados.

---

## 32. Planilla / pagos al personal (director → catedráticos y staff)

Sí se puede, y **aporta muchísimo** al director. Pero hay que separar dos cosas:

### Lo que SÍ conviene hacer (gratis, legal, alto valor) — "Planilla"
Un módulo de **planilla** que **registra y calcula**, pero **NO mueve el dinero**:
- Registrar el **salario** de cada empleado (docentes, administrativos, staff).
- Calcular **descuentos y prestaciones de Guatemala**: IGSS, retención de ISR, y provisiones
  de **Bono 14** y **Aguinaldo**. (Configurable para otros países.)
- Generar el **recibo de pago (nómina)** en PDF, con desglose.
- Llevar el **historial**: quién cobró, cuánto, cuándo; marcar "pagado".
- Reportes de planilla por mes (total a pagar, cargas sociales).
- El empleado ve su **recibo** en su panel.

> El **movimiento real del dinero lo hace el director por su banco** (transferencia/cheque),
> igual que hoy. La app **calcula, registra y comprueba** — que es donde está el dolor y el
> valor. Esto es **solo datos + PDF → gratis**, sin volverte entidad financiera.

### Lo que MEJOR se hace aparte (por ahora) — mover el dinero
Pagar los salarios **a través de la app** (dispersión de fondos) requiere:
- Un proveedor de **payout/dispersión** (con comisiones por transacción).
- **KYC** y cumplimiento financiero; tú pasarías a "manejar dinero de terceros" → más
  regulación y riesgo.
**Recomendación honesta:** **no** muevas tú el dinero al inicio. Deja que el pago se haga
por el banco y tú solo registras/generas el recibo. Si más adelante hay demanda, se integra
un proveedor de dispersión como **función premium**.

### Rol y permisos
- Solo el **Director** (y opcional **Secretaría/Contabilidad**) ve y gestiona la planilla.
- Cada **empleado** ve únicamente **sus propios** recibos.
- RLS: aislado por `colegio_id`; el empleado solo lee sus registros.

### Datos sugeridos
- `empleado` (perfil de staff, puesto, salario_base).
- `planilla_periodo` (mes, estado).
- `pago_personal` (empleado, periodo, bruto, descuentos jsonb, neto, estado, pagado_en).

> Diferenciador: la mayoría de sistemas escolares **no** trae planilla con IGSS/ISR/Bono 14.
> Es un gancho fuerte para el director en Guatemala.

---

## 33. Verificación de pagos: ¿cómo sabemos que el padre pagó?

La clave: **nada se marca "Pagado" hasta que se confirma contra dinero real.** Hay 3
métodos, con distinto nivel de automatización.

### Estados de una cuota (siempre los mismos)
`pendiente` → (el padre registra/paga) → `en_revision` → (se confirma) → `pagado`
Si algo no cuadra: `rechazado` (con motivo). Todo queda en auditoría.

### Método 1 — Pasarela de pago (Recurrente/Stripe): verificación AUTOMÁTICA ✅
1. El padre da clic en "Pagar Q350" **dentro de la app** y paga con tarjeta.
2. La pasarela cobra y, cuando el dinero **realmente entra**, envía un **webhook** ("pagado")
   a una Edge Function del sistema.
3. La función marca la cuota como `pagado` **sola**, sin que nadie revise.
- **Verificación:** la da la pasarela — el dinero llegó, punto. Es el método **más
  confiable** y no requiere trabajo humano. (Costo: comisión por transacción.)

### Método 2 — Referencia bancaria: verificación por el DIRECTOR 🔎 (gratis) ★ POR DEFECTO
> **Este es el método oficial de arranque de SmartPath.** Gratis, sin fotos, sin
> almacenamiento, a prueba de fraude y compatible con cualquier banco.
1. El padre deposita/transfiere en el banco (fuera de la app, como siempre).
2. En SmartPath escribe **No. de boleta + monto + fecha** → la cuota pasa a `en_revision`.
3. **El director confirma:** abre su **banca en línea** (o su estado de cuenta), busca ese
   depósito por monto/fecha/referencia, y si existe, da clic en **"Aprobar"** → `pagado`.
- **Verificación:** la hace el **director contra el banco real**. Mientras no confirme, la
  app **no** cuenta el pago (sigue `en_revision`). Así, si un padre inventa una referencia,
  el director no la encuentra en el banco y **la rechaza**. Cero fraude.
- Es **gratis** y funciona con cualquier banco.

### Método 3 — Conciliación automática (fase posterior, gratis-ish) ⚙️
- El director **importa el estado de cuenta** del banco (archivo CSV/Excel que el banco
  exporta) → el sistema **cruza automáticamente** los depósitos con las referencias que los
  padres ingresaron y marca como `pagado` las que coinciden.
- Reduce casi todo el trabajo manual del Método 2, sin conectarse directo al banco (que es
  complejo). Buen punto medio para cuando crezcas.

### Regla anti-fraude (para los 3)
- El pago **solo** cuenta cuando: (a) la pasarela lo confirma, o (b) el director lo aprueba
  contra el banco, o (c) la conciliación lo empata con el estado de cuenta.
- La **declaración del padre no basta** por sí sola: siempre hay una confirmación contra
  dinero real. Todo con registro de auditoría (quién aprobó, cuándo).

### Recomendación
- **Arranca con el Método 2** (referencia + aprobación del director): gratis y suficiente.
- Ofrece el **Método 1** (pasarela) como comodidad (en planes de pago).
- Agrega el **Método 3** (conciliación por CSV) cuando el volumen lo justifique.

---

## 34. Extras de cobros (alto valor, gratis)

Complementan el Método 2 y hacen el módulo de cobros más completo — todo son datos + PDF:

- **Recibo automático para el padre**: al aprobarse el pago, se genera un **recibo en PDF**
  con número correlativo, descargable. (No se almacena como imagen; se regenera al vuelo.)
- **Estado de cuenta de la familia**: histórico de cuotas, pagos y **saldo pendiente** en un
  solo lugar; el padre lo ve claro y el director también.
- **Numeración correlativa** de recibos (control contable).
- **Convenios de pago**: para familias con atraso, dividir la deuda en **cuotas acordadas**
  con fechas; el sistema da seguimiento.
- **Becas y descuentos**: por hermanos, pronto pago o beca; se aplican automáticamente al
  calcular la cuota.
- **Recordatorios automáticos**: aviso al padre antes del vencimiento y al entrar en mora
  (por notificación/correo, gratis).
- **Reporte de morosidad** para el director: quién debe, cuánto y hace cuánto; exportable.

> Datos sugeridos: `recibo` (pago_id, correlativo, pdf_generado_al_vuelo),
> `convenio_pago` (familia, total, cuotas[]), `descuento` (tipo, valor, regla).

---

## 35. Módulos adicionales (nuevos, gratis)

Seis módulos de alto valor; todos son datos + PDF/lógica → **sin costo de servicios**.

### 35.1 Constancias y solvencias automáticas
- El padre/estudiante descarga con un clic: **constancia de inscripción**, **de conducta**,
  **de notas** y **de solvencia** (que está al día en pagos).
- Se **generan al vuelo en PDF** con **número correlativo** y **QR verificable** (cualquiera
  escanea y confirma que es legítima). No se almacenan como archivo.
- La solvencia se calcula solo desde el estado de cuenta (sin cuotas pendientes = solvente).

### 35.2 Portal de admisiones (capta clientes)
- **Formulario público** (enlace propio del colegio) para que familias nuevas soliciten
  inscripción.
- Entra a un **embudo** para el director: nuevo → contactado → aceptado → inscrito.
- Al aceptar, se **convierte en estudiante + padre** con sus códigos, sin recapturar datos.
- Datos: `solicitud_admision` (datos del prospecto, estado, origen).

### 35.3 Boletas de calificaciones en PDF (firma + QR)
- Boleta/acta de notas **generada al vuelo** con plantilla MINEDUC (GT) o internacional.
- **Firma digital** del responsable y **QR verificable** anti-falsificación.
- El padre la descarga; no ocupa almacenamiento permanente.

### 35.4 Bitácora de conducta (formativa)
- Registro de incidencias **positivas y negativas** por el docente/director, con enfoque
  formativo (no punitivo).
- Visible al padre del alumno (RLS). Sirve para seguimiento y alertas tempranas.
- Datos: `conducta` (estudiante, tipo, descripcion, docente, fecha).

### 35.5 Eventos con inscripción y cobro asociado
- El colegio crea **eventos** (excursiones, actos, talleres) con cupo y, si aplica, **cobro**.
- El padre **confirma asistencia** e inscribe a su hijo; el cobro entra al módulo de cuotas.
- Datos: `evento` (titulo, fecha, cupo, costo), `inscripcion_evento` (estudiante, estado).

### 35.6 Encuestas a padres
- El director/docente lanza **encuestas rápidas** (confirmar asistencia, votar fechas,
  opinión). Resultados en vivo.
- Datos: `encuesta` (pregunta, opciones jsonb, alcance), `respuesta_encuesta`.

---

## 36. User stories (para construir con precisión)

Formato: *como [rol] quiero [acción] para [beneficio]*. Guía a Fable sobre el "para qué".

### Director
- Como director quiero **ver la asistencia y los cobros del día al entrar** para tomar
  decisiones sin buscar en varios lados.
- Como director quiero **dar de alta el colegio y generar códigos** para que docentes,
  padres y alumnos se unan sin que yo capture todo.
- Como director quiero **aprobar pagos contra mi estado de cuenta** para confirmar que el
  dinero realmente entró.
- Como director quiero **generar planilla con IGSS/ISR** para pagar al personal sin cálculos
  a mano.
- Como director quiero **detectar familias en riesgo de retiro** para actuar a tiempo.

### Catedrático
- Como docente quiero **tomar asistencia con un clic** para no perder tiempo de clase.
- Como docente quiero **subir notas y que el padre las vea al instante** para evitar
  reclamos y llamadas.
- Como docente quiero **planificar en modo CNB o libre** para adaptarme a mi forma de
  trabajar.
- Como docente quiero **dejar notas y dibujos en la Agenda Escolar** para comunicarme con
  padres de forma clara y cercana.

### Padre / Tutor
- Como padre quiero **saber al instante si mi hijo no llegó** para reaccionar rápido.
- Como padre quiero **ver notas, tareas y cuota en un solo lugar** para no perseguir
  información.
- Como padre quiero **registrar mi pago por referencia** para no ir a la secretaría.
- Como padre quiero **descargar la constancia de solvencia** para trámites, sin pedirla en
  ventanilla.

### Estudiante
- Como estudiante quiero **ver mis tareas de hoy y mi racha** para mantenerme motivado.
- Como estudiante quiero **ganar XP y logros** al cumplir objetivos para que estudiar sea
  más divertido.
- Como estudiante quiero **elegir/crear mi avatar** para sentir el espacio como mío.

---

## 37. Notificaciones en tiempo real — gratis y sin terceros (con código de referencia)

Stack: **Supabase Realtime** (app abierta) + **Web Push** (app cerrada) + **correo**
(respaldo). Todo gratis (dentro de lo que ya se paga en Supabase). Código orientativo:

### 37.1 In-app en tiempo real (Supabase Realtime)
```ts
// El padre se suscribe a cambios de las notas de su hijo — llega al instante.
supabase
  .channel('notas-hijo')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'calificacion',
      filter: `estudiante_id=eq.${estudianteId}` },
    (payload) => mostrarNotificacion('Nueva nota publicada', payload.new))
  .subscribe()
```

### 37.2 Web Push (notificación aunque la app esté cerrada)
```js
// service worker: public/sw.js
self.addEventListener('push', (e) => {
  const d = e.data.json()
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: '/logo.svg', data: d.url
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data || '/'))
})
```
```ts
// cliente: pedir permiso y suscribirse (VAPID gratis, llaves generadas por ti)
const reg = await navigator.serviceWorker.register('/sw.js')
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY
})
await supabase.from('push_sub').insert({ user_id, sub })  // guardar suscripción
```
```ts
// Edge Function que envía el push cuando ocurre un evento (usa web-push, gratis)
import webpush from 'npm:web-push'
webpush.setVapidDetails('mailto:tu@correo', VAPID_PUBLIC, VAPID_PRIVATE)
await webpush.sendNotification(sub, JSON.stringify({
  title: 'Ausencia', body: 'Tu hijo no registró entrada hoy', url: '/padre'
}))
```

### 37.3 Correo (respaldo, tramo gratis)
Para quien no tenga push (ej. iPhone sin PWA instalada), enviar el mismo aviso por correo
transaccional (Resend/Brevo, tramo gratis).

> Datos: tabla `push_sub` (user_id, sub jsonb). Secretos VAPID en variables de entorno.

---

## 38. Glosario

- **Colegio (tenant)**: la organización cliente; todo se aísla por `colegio_id`.
- **RLS (Row Level Security)**: reglas en Postgres que limitan qué filas ve cada usuario.
- **Rol**: director, catedrático (docente), padre/tutor, estudiante.
- **Onboarding**: alta del colegio y de las personas con códigos.
- **Cuota**: monto que un padre debe (colegiatura u otro concepto).
- **Mora**: recargo por pago tardío.
- **Convenio de pago**: acuerdo para pagar una deuda en cuotas.
- **Solvencia**: estar al día en pagos.
- **Referencia**: No. de boleta/depósito con que se identifica un pago (texto).
- **Conciliación**: cruzar depósitos del banco con los pagos registrados.
- **Planilla / nómina**: cálculo de sueldos del personal (IGSS, ISR, Bono 14, Aguinaldo).
- **CNB**: Currículo Nacional Base de Guatemala.
- **FEL**: Factura Electrónica en Línea (SAT, Guatemala).
- **Realtime / Web Push**: mecanismos gratuitos de notificación (in-app / navegador).
- **PWA**: app web instalable en el teléfono (necesaria para push en iPhone).

---

## 39. Convención de términos (unificado)

Para evitar ambigüedad, en todo el producto y la interfaz usar:
- **"Docente"** como término visible (sinónimo interno: catedrático).
- **"Boleta de pago"** = comprobante de pago; **"Boleta de calificaciones"** = reporte de
  notas. Nunca "boleta" a secas.
- **"Cuota"** para lo que paga el padre; **"Pago"** para el registro de que pagó.
- **"Colegio"** como término general (aplica a escuela/academia/instituto).

---

## 40. Sistema de diseño (UI/UX) — obligatorio para Fable

Meta: que se vea **bonito, ordenado y profesional**, como los grandes sistemas
(iOS/macOS), pero con **personalidad propia** de marca. **Prohibido usar emojis** en la
interfaz; se usan **iconos de una librería** (ver §40.7).

### 40.0 Dirección de estilo recomendada: "Editorial cálido minimalista"
Combina lo mejor de dos mundos:
- **La claridad estructural de iOS/macOS**: mucho espacio en blanco, tarjetas redondeadas,
  jerarquía nítida, profundidad sutil, translucidez en acentos.
- **La calidez editorial de la marca SmartPath**: fondo crema, acento ámbar, **títulos con
  serif** (DM Serif Display) sobre cuerpo sans (Plus Jakarta Sans).
Resultado: se siente premium y humano, no un dashboard genérico y frío. (Alternativa válida:
minimalista puro estilo Linear/Notion — más monocromo; pero la editorial cálida diferencia
más.)

### 40.1 Tokens de color (reusar los del landing)
```
--cream:#faf8f4  --cream2:#f2ede5  --cream3:#e8e0d4   (fondos)
--ink:#0c0b09    --muted:#6b6156   --muted2:#a09488   (texto)
--amber:#e07b00  (acento/primario)  --border:#e2dbd0
Estados: éxito #16a34a · alerta #dc2626 · aviso #d97706 · info #2563eb
```
- **Un solo color de acento** (ámbar) para acciones primarias. Los colores de estado solo
  para su significado (no decoración). Modo oscuro: invertir a tinta con crema como texto.

### 40.2 Tipografía y escala
- Títulos: **Fraunces** (serif con carácter, cálido; usar opsz/italic para expresividad). Cuerpo/UI: **Space Grotesk** (grotesca geométrica, distintiva). Mono: **JetBrains Mono** para etiquetas técnicas. (Evitar las combinaciones genéricas tipo Inter/Roboto.)
- Escala (px): 12 (meta), 14 (cuerpo), 16 (énfasis), 20/24 (subtítulos), 32/40 (títulos).
- Interlineado cómodo (1.5 cuerpo). Peso: 400–600 UI; el serif para jerarquía, no para
  párrafos largos.

### 40.3 Espaciado, radios y sombras (consistencia total)
- **Rejilla de 8px**: todo espacio es múltiplo de 8 (8/16/24/32…). Nada "a ojo".
- **Radios**: 8 (chips), 12 (inputs/botones), 16 (tarjetas), 24 (contenedores).
- **Sombras suaves** y de bajo contraste (elevación sutil, no dura). Máximo 2 niveles.
- **Padding interno de tarjeta**: 24px desktop / 16px móvil. Consistente en TODAS.

### 40.4 Layout del dashboard (ordenado, sin desbordes)
- **Estructura**: barra lateral izquierda (navegación por rol) + área de contenido. En móvil,
  la lateral se colapsa a un menú inferior o hamburguesa.
- **Contenido en rejilla** responsive (12 columnas desktop → 1 columna móvil). Alineación
  perfecta; **nada flotando**.
- **Encabezado de página** consistente: título + acción principal a la derecha.
- **Máximo 5–7 widgets** por vista (lo demás en subpáginas). Ver §19.
- **Anchos máximos** de contenido para que no se estire feo en pantallas grandes.

### 40.5 Reglas anti-desborde (texto/bordes) — CRÍTICO
El usuario pidió explícitamente que nada se salga. Reglas obligatorias:
- Contenedores flex con texto: usar `min-width:0` para permitir truncado.
- Texto largo: **truncar con elipsis** (`text-overflow:ellipsis; overflow:hidden;
  white-space:nowrap`) o limitar a N líneas (`-webkit-line-clamp`).
- **`box-sizing:border-box`** global (el padding no rompe el ancho).
- Imágenes/medios: `max-width:100%`.
- **Tablas anchas**: contenedor con `overflow-x:auto` (scroll interno), nunca desbordar la
  página; en móvil, convertir filas en tarjetas.
- Nombres/correos largos: truncar con tooltip al pasar el mouse.
- Probar con **textos extremos** (nombres larguísimos, números grandes) en cada componente.

### 40.6 Componentes base (consistentes en toda la app)
- **Tarjeta**: fondo blanco, borde 1px `--border`, radio 16, sombra suave, padding 24.
- **Botón primario**: ámbar, texto blanco, radio 12, altura 44. Secundario: contorno.
- **Input**: alto 44–48, radio 12, borde que resalta a ámbar en foco. Con etiqueta y ayuda.
- **Tabla/lista**: encabezado sutil, filas con hover, acciones alineadas a la derecha,
  paginación abajo. En móvil → tarjetas.
- **Chip/etiqueta de estado**: color de estado tenue de fondo + texto del color.
- **Modal**: centrado, fondo con desenfoque, acciones abajo a la derecha.
- **Estado vacío**: texto amable + ilustración/mascota (nunca un hueco en blanco).
- **Skeletons** de carga (no spinners bruscos).

### 40.7 Iconografía (sin emojis)
- Usar una sola librería de iconos vectoriales (ej. **Lucide** o **Bootstrap Icons**),
  trazo consistente, mismo grosor y tamaño (16–20px). **Nunca emojis** en la UI.

### 40.8 Movimiento (con propósito, no decorativo)
- Transiciones suaves (150–300ms, curva ease-out). Micro-interacciones: contadores que
  animan, tarjetas que elevan levemente al hover, entrada en cascada al cargar una vista.
- Respetar `prefers-reduced-motion` (desactivar animaciones si el usuario lo pide).

### 40.9 Accesibilidad
- Contraste AA mínimo. Objetivos táctiles ≥44px. Foco visible. Etiquetas en formularios.
- Texto escalable; no depender solo del color para transmitir significado.

### 40.10 Modo claro/oscuro
- Diseñar ambos desde el inicio con los tokens (crema/tinta se invierten). El acento ámbar
  se mantiene.

> **Regla de oro de UI**: consistencia > creatividad puntual. Los mismos componentes,
> espaciados y patrones en los 4 roles, para que aprender uno enseñe los demás.

---

## 41. Asistencia del personal y su impacto en planilla

Igual que se registra la asistencia de los alumnos, se registra la del **personal** (docentes
y administrativos), y **alimenta la planilla** con sus descuentos. Todo gratis (datos + PDF).

### Registro de asistencia del personal
- Estados: **presente, ausente, tardanza, permiso, vacaciones, incapacidad (IGSS/suspensión)**.
- Se marca por día (o por jornada); historial por empleado, con justificación adjuntable
  (texto/enlace, sin fotos pesadas).
- Vista de calendario del personal y reporte mensual de inasistencias.
- Panel tipo **heatmap** del año por empleado (como el de asistencia de alumnos).

### Cómo impacta la planilla (todo lo que se descuenta)
Al cerrar la planilla del mes, el sistema calcula el **neto** aplicando:
- **Descuentos de ley (Guatemala):**
  - **IGSS** (cuota laboral, típico 4.83% — configurable).
  - **ISR** (retención según renta, configurable por tramos).
- **Descuentos por inasistencia**: días no justificados descontados del salario según el
  registro de asistencia del personal (proporcional al salario diario).
- **Otros descuentos**: préstamos/anticipos, pensiones, etc. (configurables).
- **Provisiones y prestaciones**: **Bono 14** y **Aguinaldo** (cálculo y acumulado), más
  vacaciones. (Configurable/desactivable para otros países.)

Fórmula base: `neto = salario_base − IGSS − ISR − inasistencias − otros`.
Cada concepto queda **desglosado en el recibo de nómina** (PDF con correlativo) y en el
historial. Todo con **auditoría** (quién cerró la planilla, cuándo).

> Importante: el sistema **calcula y registra**; el **pago real lo hace el director por el
> banco** (SmartPath no mueve dinero). Ver §32.

### Datos (añadir al esquema)
- `asistencia_personal` (empleado, fecha, estado, justificacion).
- `pago_personal.descuentos jsonb` ya soporta `{igss, isr, inasistencias, otros}`.
- Config del colegio: `%IGSS`, tramos ISR, si aplica Bono 14/Aguinaldo.

> RLS: el empleado ve **solo su** asistencia y sus recibos; director/secretaría gestionan
> todo. Aislado por `colegio_id`.

---

## 42. Gráficos por rol y datos REALES (no simulados) — obligatorio

Regla absoluta: **todos los gráficos de los 4 roles se alimentan de datos reales** de la base
(consultas agregadas), nunca de datos aleatorios o "de ejemplo". El mockup
(`dashboard-mockup.html`) usa datos de relleno **solo como referencia visual**; en producción
**cada gráfico se enlaza a una consulta**.

### Principio de datos reales
- Cada visualización se alimenta de una **consulta agregada** (SQL) o de una **vista de
  Postgres** que resume los datos reales del colegio.
- Las agregaciones pesadas se hacen como **vistas** o **RPC** en el servidor (no en el
  cliente), respetando **RLS** (cada rol ve solo lo suyo, aislado por `colegio_id`).
- En el cliente: **React Query/SWR** para cachear, y **Supabase Realtime** para refrescar
  cuando cambian los datos.
- **Nunca** `Math.random()` ni valores hardcodeados en producción. Si no hay datos, mostrar
  **estado vacío** ("Aún no hay datos"), no inventar.

### Qué gráfico va en cada rol y su fuente
**Director**
- **Heatmap de asistencia del ciclo** (colegio) → agregación diaria de `asistencia`
  (`% presentes por día`).
- **Tendencia de cobros** (semana/mes) → suma de `pago` (estado `pagado`) por periodo.
- **Cartera vencida / morosidad** → `cuota` vencidas sin pago, por antigüedad.
- **Rendimiento por sección/materia** → promedio de `calificacion` agrupado.

**Docente**
- **Heatmap de asistencia de SUS secciones** → `asistencia` filtrada por
  `asignacion_docente`.
- **Distribución de notas** (histograma) por actividad/materia → `calificacion`.
- **Entregas pendientes vs a tiempo** → `entrega` por `tarea`.

**Padre**
- **Anillo/heatmap de asistencia del hijo** → `asistencia` del `estudiante` (vía
  `parentesco`).
- **Notas por materia** (barras) → `calificacion` del hijo.
- **Historial de pagos y saldo** → `cuota` + `pago` de la familia.

**Estudiante**
- **Racha (streak) y progreso de XP** → `xp_evento` + `racha`.
- **Tendencia de mis notas** (línea) → `calificacion` propias por periodo.
- **Mi asistencia** (anillo/heatmap) → `asistencia` propia.

### Ejemplos de vistas de agregación (base para Fable)
```sql
-- Asistencia diaria del colegio (para el heatmap del director)
create view v_asistencia_diaria as
select colegio_id, fecha,
       count(*) filter (where estado='presente')::float / nullif(count(*),0) as pct_presente,
       count(*) as total
from asistencia group by colegio_id, fecha;

-- Cobros por día (tendencia)
create view v_cobros_diarios as
select colegio_id, date(creado_en) as dia, sum(monto) as total
from pago where estado='pagado' group by colegio_id, date(creado_en);

-- Promedio por materia (rendimiento)
create view v_promedio_materia as
select colegio_id, materia_id, round(avg(nota),2) as promedio, count(*) as evaluaciones
from calificacion group by colegio_id, materia_id;
```
> Las vistas heredan la seguridad de las tablas base (RLS): cada usuario solo ve lo que le
> corresponde. Para cálculos por rol (docente/padre/estudiante) filtrar por sus vínculos.

### Estética de los gráficos (coherente con §40)
- Paleta de marca (ámbar sobre crema/tinta), tipografía tabular en números, animación de
  entrada (dibujo/conteo) con propósito, tooltips con el dato real, y **estado vacío** claro
  cuando no hay información.

---

## 43. Pantalla de login y estética "mosaico/valla" (con referencia visual)

Ver mockup: `login-mockup.html`.

### Login
- **Fondo de mosaico "bento"** (estilo pared de monitoreo creativa): tiles asimétricos con
  blooms de color de marca, tiles de pixel-art, líneas de rejilla finas y etiquetas técnicas
  monoespaciadas (S01/C2/coordenadas). Animación sutil (blooms a la deriva).
- **Tarjeta de login legible al frente**: vidrio esmerilado (`backdrop-filter:blur`) sobre un
  **scrim radial** que oscurece el centro → el fondo se ve, pero el texto nunca pierde
  contraste (accesibilidad AA).
- Campos: correo + contraseña, "recordarme", "olvidé contraseña", botón ámbar, **"entrar con
  código de invitación"**, y chips de los 4 roles. Enlace a "registrar colegio".
- (Recordar §21: un solo login → redirige por rol; estudiantes pueden entrar con usuario/PIN.)

### Sección de anuncios estilo "valla publicitaria"
- El panel de noticias/anuncios puede presentarse como una **valla**: una franja ancha con
  ese mismo fondo de mosaico/gradientes detrás, y el anuncio (título + resumen) al frente en
  una tarjeta legible.
- **Regla de legibilidad**: el texto siempre va sobre una capa sólida/scrim; el fondo
  artístico es decorativo, nunca compite con el contenido. Respetar `prefers-reduced-motion`.

### Composición de dashboards: bento, no rejilla uniforme
- Evitar el "mar de tarjetas iguales". Usar **composición bento**: una pieza protagonista
  (ej. el heatmap), tiles de distinto tamaño alrededor, y jerarquía visual clara.
- Mantener la rejilla de 8px y las reglas anti-desborde (§40); variar tamaños **con
  intención**, no al azar.
- Cada rol conserva los mismos componentes base, pero su **pieza protagonista** cambia:
  Director → heatmap/cobros; Docente → asistencia de sus clases; Padre → estado del hijo;
  Estudiante → racha/XP.

---

## 44. Sistema de media "naturaleza → arte" (ASCII / mosaico / isolíneas)

Ver componente vivo: `ascii-nature.html` (procesa `assets/butterfly.mp4` en tiempo real).

Firma visual de SmartPath: tomar **metraje real de naturaleza** (mariposas, plantas,
insectos, animales) y **filtrarlo en vivo** en tres estilos, guiados por una **cuadrícula
abstracta**:
- **ASCII**: cada celda = un carácter según la luminancia (rampa ` .:-=+*o#%@`), color ámbar
  con brillo variable. (También variante verde tipo terminal.)
- **Mosaico (dither)**: dithering Bayer → cuadros de color en cuadrícula.
- **Isolíneas**: bordes entre bandas de luminancia → contornos tipo mapa topográfico.

### Cómo se implementa (real, no simulado)
- `<video>` (oculto) → se dibuja cada frame a un `<canvas>` pequeño (ej. 140×44) →
  `getImageData` → por celda se calcula luminancia → se pinta ASCII/dither/isolínea en el
  canvas visible. rAF, ~24–30 fps. Es el mismo principio del dither WebGL del landing, pero
  aplicado a **video real**.
- Peso: el video vive en `/public` o CDN (no en base de datos). Un clip corto (1–2 MB)
  alcanza; se puede reutilizar en todo el sitio.


### Pared de medios reutilizable (`media-wall.html` / `lattice/lattice.html`)
`lattice/lattice.html` es la versión mejorada (sistema de color completo, 3 escenas: mariposa,
medusa, camaleón). Usar como referencia principal de la pared de medios.
Mosaico bento que mezcla **video crudo + el mismo metraje filtrado (ASCII/dither) + gradientes +
etiquetas técnicas**, sobre cuadrícula. Reutilizable como fondo de: login, encabezados de
sección, estados vacíos, valla de anuncios y pantallas de bienvenida. Siempre con capa
legible cuando hay texto encima.

### Dónde usarlo (no solo login)
- **Fondo del login** y de **pantallas de bienvenida/onboarding**.
- **Encabezados de sección** y **estados vacíos** (en vez de un hueco: una mariposa en ASCII).
- **Loaders / transiciones**.
- **Acentos** en tarjetas o en la valla de anuncios.
- **Avatares/insignias** de gamificación (naturaleza en pixel/ASCII).
Regla: siempre **detrás de una capa legible** cuando haya texto encima (contraste AA).


> Media incluida (libre, licencia Mixkit, uso comercial sin atribución): `assets/nature.mp4`
> (mariposa) y `assets/jellyfish.mp4` (medusa). Fuentes libres: Pexels, Coverr, Mixkit, Pixabay.

### Arte ASCII de naturaleza (catálogo)
Además del video, incluir un set de **ilustraciones ASCII estáticas** (mariposa, flor, abeja,
hoja, colibrí) para decorar estados vacíos, logros y encabezados. Son texto → peso casi nulo.

---

## 45. Noticias como "mini-ventana" dentro del dashboard (estilo YouTube)

Referencia: tarjeta compacta tipo app de video. En los paneles de **padre, docente y
estudiante**, las noticias/comunicados aparecen como una **mini-ventana** embebida:
- **Miniatura** (imagen del comunicado, o un frame en ASCII/mosaico si es del colegio),
  título, fuente (Colegio / MINEDUC), tiempo ("hace 2 h") y menú.
- Chips de filtro arriba (Todo · Colegio · MINEDUC · Eventos), como el "All / Baking /
  Comedy" de la referencia.
- Al tocar: se expande a la noticia completa (o reproduce el video si lo hay).
- Compacta y ordenada; **no** ocupa todo el dashboard — es un widget más del bento.
- Datos: reusa la tabla `noticia` (§5) con `expira_en` (§28). Miniaturas comprimidas/expiran.

---

## 46. Dirección de diseño: NO el típico SaaS (bento lúdico y cálido)

El usuario pide explícitamente **evitar la estructura aburrida de SaaS**. Referencias: apps
de bienestar/meditación (tarjetas suaves, colores por categoría, ilustraciones a línea,
tiles de racha, "mood log" con caritas/estados). Traducción para SmartPath:

- **Composición bento** con tiles de distinto tamaño y **una pieza protagonista** por rol
  (§43), no una rejilla uniforme de tarjetas iguales.
- **Tarjetas muy redondeadas** (radio 18–24), **iconos perfectamente centrados**, mucho aire.
- **Color por categoría** en tiles suaves (lila, verde salvia, ámbar, durazno), como las
  apps de referencia — manteniendo el ámbar como acento principal.
- **Ilustraciones a línea / ASCII de naturaleza** para dar calidez (no clip-art genérico).
- **Micro-interacciones** con propósito (tiles que responden, racha que "late", conteo
  animado, reveal en cascada).
- **Estudiante**: el más lúdico (racha con llama/planta que crece, XP, logros, avatar).
- **Padre/Docente**: cálidos pero legibles; menos juego, misma coherencia.
- **Impecable**: rejilla de 8px, sin desbordes (§40), iconografía consistente (una librería,
  sin emojis), estados vacíos amables con la mascota/ASCII.

> Instrucción para Fable: usa todo tu potencial de diseño y anima cada vista. Aplica los
> principios de sistema de diseño (§40), datos reales en gráficos (§42), la media
> naturaleza→arte (§44) y esta dirección bento cálida. El objetivo es que **no parezca una
> plantilla**: debe sentirse hecho a mano, original y vivo, sin sacrificar orden ni
> legibilidad.

---

## 47. Control de entrada/salida del personal, acuse de pago y SAT (consolidado)

Consolida y completa lo relacionado con personal y cumplimiento fiscal.

### 47.1 Marcaje de entrada y salida del personal (catedráticos y staff)
- El personal **registra su entrada y salida** (hora exacta) desde la app; opción de
  **QR/código** en recepción para marcar sin fricción.
- Calcula **horas trabajadas, tardanzas y ausencias**, y alimenta la **asistencia del
  personal** (§41) y, por ende, la **planilla** (descuentos por inasistencia/tardanza).
- Reporte mensual de marcajes por empleado (heatmap opcional, datos reales).
- Datos: `asistencia_personal.hora_entrada`, `hora_salida`, `metodo` (manual|qr|codigo).
- RLS: el empleado ve solo **sus** marcajes; director/secretaría gestionan todo.

### 47.2 Acuse/constancia de pago recibido (nómina)
- Al pagarle a un empleado, se genera el **recibo de nómina en PDF** (desglose IGSS/ISR/etc.,
  con correlativo).
- El empleado **firma de recibido** en la app (acuse digital) → queda **constancia** de que
  recibió su dinero, con fecha/hora y trazabilidad.
- Sirve como respaldo laboral tanto para el colegio como para el empleado.
- Datos: `acuse_pago_personal` (pago_personal_id, firmado, firmado_en).
- Recordatorio: **SmartPath no mueve el dinero** (lo hace el banco); solo calcula, genera el
  recibo y registra el acuse.

### 47.3 SAT / FEL (Guatemala) — dónde aplica
- **Colegiaturas y suscripciones**: emitir **Factura Electrónica en Línea (FEL)** vía SAT
  (integración con un certificador autorizado). Toda venta se factura.
- **Constancias**: las de solvencia/inscripción (§35) son documentos internos con QR; **no**
  son facturas fiscales — la factura la genera FEL cuando hay un cobro.
- **Planilla**: los cálculos de IGSS/ISR son de la relación laboral (no FEL); el colegio
  reporta ante IGSS/SAT según corresponda. SmartPath entrega el **desglose y reportes** para
  facilitarlo.
- Config por colegio: régimen (pequeño contribuyente / general), % IGSS, tramos ISR,
  certificador FEL, NIT del colegio.
- Fuera de Guatemala: plantilla de factura genérica + impuestos configurables.

> Nota legal: la integración FEL requiere un **certificador autorizado por la SAT** y el NIT
> del colegio. Es un trámite del colegio; SmartPath se conecta, no sustituye ese registro.
