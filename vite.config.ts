import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La portada (public/index.html) es un HTML estático que se sirve en "/".
// La aplicación vive en app.html y atiende el resto de rutas. En producción eso
// lo resuelve vercel.json; este plugin hace lo mismo en desarrollo para que
// `pnpm dev` se comporte igual que el sitio desplegado.
function rutasDeAplicacion(): PluginOption {
  return {
    name: 'smartpath-rutas-app',
    configureServer(servidor) {
      servidor.middlewares.use((req, _res, siguiente) => {
        const ruta = (req.url ?? '/').split('?')[0]
        const esNavegacion = (req.headers.accept ?? '').includes('text/html')
        const esArchivo = ruta.includes('.')
        const esInterno = ruta.startsWith('/@') || ruta.startsWith('/src') || ruta.startsWith('/node_modules')
        if (esNavegacion && ruta !== '/' && !esArchivo && !esInterno) {
          req.url = '/app.html'
        }
        siguiente()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rutasDeAplicacion()],
  build: {
    rollupOptions: {
      input: { app: 'app.html' },
    },
  },
})
