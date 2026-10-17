import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || 'dev') },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('socket.io') || id.includes('engine.io')) return 'socket';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('react')) return 'react';
        },
      },
    },
  },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/socket.io': { target: 'http://localhost:4400', ws: true } },
  },
});
