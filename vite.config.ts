import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __viteConfigDir = path.dirname(fileURLToPath(import.meta.url));

/** User keeps canonical project + build output on E: — avoid filling C: (dist, vite cache). */
const E_PROJECT = 'E:\\Da-Music-Box-v4-SOURCE-COMPLETE';
const useEDrive = fs.existsSync('E:\\');

function ePath(...parts: string[]): string {
  return path.join(E_PROJECT, ...parts);
}

if (useEDrive) {
  fs.mkdirSync(ePath('dist'), { recursive: true });
  fs.mkdirSync(ePath('.vite-cache'), { recursive: true });
}

export default defineConfig({
  plugins: [react()],
  /** Explicit path so `public/` is always merged into `dist/` (avoid naming a subfolder `assets/` — conflicts with Rollup’s `dist/assets/` output). */
  publicDir: path.resolve(__viteConfigDir, 'public'),
  resolve: {
    alias: { '@': path.resolve(__viteConfigDir, '.') }
  },
  /** Vite cache on E: when project mirror exists — keeps C: free. */
  cacheDir: useEDrive ? ePath('.vite-cache') : path.resolve(__viteConfigDir, 'node_modules/.vite'),
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
    /** Production bundle → E:\Da-Music-Box-v4-SOURCE-COMPLETE\dist when E: mirror is present. */
    outDir: useEDrive ? ePath('dist') : path.resolve(__viteConfigDir, 'dist'),
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: { manualChunks: undefined }
    }
  }
});
