/**
 * ============================================================
 * Archivo: src/main.tsx
 * Propósito: Punto de entrada de la app. Inyecta QueryClientProvider
 *            para habilitar React Query en todo el árbol.
 * Notas:
 *  - No añadimos BrowserRouter aquí por si ya lo tienes en App.tsx.
 *  - Ajusta las opciones por defecto de React Query según tu gusto.
 * ============================================================
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Instancia única de QueryClient para toda la app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita refetch agresivo al volver a la pestaña
      refetchOnWindowFocus: false,
      // Reintenta una vez si falla
      retry: 1,
      // Cachea 5 minutos
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/*
        Si instalas Devtools: npm i -D @tanstack/react-query-devtools
        Luego descomenta:
        <ReactQueryDevtools initialIsOpen={false} />
      */}
    </QueryClientProvider>
  </React.StrictMode>
);
