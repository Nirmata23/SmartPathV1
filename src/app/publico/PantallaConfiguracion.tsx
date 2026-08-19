// Pantalla de ayuda cuando faltan las variables de entorno. Sin esto la app
// quedaría en blanco y quien clona el repo no sabría por qué.
export function PantallaConfiguracion() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="w-full max-w-lg rounded-3xl border border-borde bg-white p-8 shadow-[0_10px_40px_rgba(12,11,9,.08)]">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg,#e07b00,#f7a927)' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-white stroke-2">
              <path d="M12 3 4 9v11h5v-6h6v6h5V9z" />
            </svg>
          </div>
          <span className="font-display text-2xl">SmartPath</span>
        </div>

        <h1 className="font-display mb-2 text-2xl">Falta un paso de configuración</h1>
        <p className="mb-5 text-sm text-muted">
          La aplicación necesita saber a qué proyecto de Supabase conectarse. Esas llaves no
          viajan en el repositorio por seguridad, así que hay que crearlas una sola vez.
        </p>

        <ol className="mb-5 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 font-mono text-xs font-bold text-amber-d">1</span>
            <span>
              Crea un archivo llamado <code className="rounded bg-cream-2 px-1.5 py-0.5 font-mono text-xs">.env</code> en
              la raíz del proyecto (junto a <code className="rounded bg-cream-2 px-1.5 py-0.5 font-mono text-xs">package.json</code>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 font-mono text-xs font-bold text-amber-d">2</span>
            <span>Pega dentro estas dos líneas, con los datos de tu proyecto:</span>
          </li>
        </ol>

        <pre className="mb-5 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-cream">
{`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...`}
        </pre>

        <ol className="mb-5 space-y-3 text-sm" start={3}>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 font-mono text-xs font-bold text-amber-d">3</span>
            <span>
              Los valores están en tu panel de Supabase, en{' '}
              <b>Project Settings → API Keys</b> (usa la llave <b>publishable</b>, nunca la <b>service_role</b>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/15 font-mono text-xs font-bold text-amber-d">4</span>
            <span>
              Reinicia el servidor: detén el proceso y corre{' '}
              <code className="rounded bg-cream-2 px-1.5 py-0.5 font-mono text-xs">pnpm dev</code> otra vez.
            </span>
          </li>
        </ol>

        <p className="text-xs text-muted-2">
          Si despliegas en Vercel o Cloudflare Pages, en vez del archivo agrega esas dos
          variables en el panel de tu proveedor.
        </p>
      </div>
    </div>
  )
}
