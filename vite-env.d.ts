/// <reference types="vite/client" />

/** Supabase — copy `.env.example` → `.env` (only `VITE_*` is exposed to the client). */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Base URL for Sound Conversion API (no trailing slash). Default http://localhost:8000 */
  readonly VITE_MUSIC_ENHANCER_URL?: string;
}
