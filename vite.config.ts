import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/socket.io': { target: 'http://localhost:4300', ws: true } },
  },
});
