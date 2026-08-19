import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/index.css'
import { AuthProvider } from './features/auth/AuthProvider'
import { hayConfiguracion } from './lib/supabase'
import { PantallaConfiguracion } from './app/publico/PantallaConfiguracion'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

// Sin llaves de Supabase mostramos instrucciones en vez de una pantalla vacía.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {hayConfiguracion ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <PantallaConfiguracion />
    )}
  </StrictMode>,
)
