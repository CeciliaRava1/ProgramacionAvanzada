import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En Docker se escucha en 0.0.0.0 dentro del contenedor; compose publica el puerto solo en 127.0.0.1.
    host: process.env.VITE_HOST ?? '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Docker Desktop (Windows) no propaga eventos de archivos a los contenedores: se consulta por polling.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
});
