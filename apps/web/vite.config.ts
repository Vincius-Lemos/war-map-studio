import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      /* index.html: interface. map-test.html: página de teste do motor de mapa (apps/web/src/map). */
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        mapTest: fileURLToPath(new URL('./map-test.html', import.meta.url)),
      },
    },
  },
});
