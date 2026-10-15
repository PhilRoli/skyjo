import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || 'dev') },
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/socket.io': { target: 'http://localhost:4400', ws: true } },
  },
});
