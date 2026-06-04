import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const backendPort = process.env.PORT || '3000';

let gitSha = 'local';
try { gitSha = execSync('git rev-parse --short HEAD').toString().trim(); } catch {}

export default defineConfig({
  root: 'src/client',
  publicDir: '../../public',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.COMMIT_SHA?.slice(0, 7) ?? gitSha),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
});
