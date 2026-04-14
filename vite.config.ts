import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  /** Explicit path so `public/` is always merged into `dist/` (avoid naming a subfolder `assets/` — conflicts with Rollup’s `dist/assets/` output). */
  publicDir: path.resolve(__dirname, 'public'),
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') }
  },
  /**
   * `host: true` listens on all interfaces so both http://localhost:5173 and http://127.0.0.1:5173
   * work (Windows / Simple Browser / IPv6 quirks).
   */
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
  build: {
    minify: 'esbuild',
    rollupOptions: {
      output: { manualChunks: undefined }
    }
  }
});
