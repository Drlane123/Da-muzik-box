import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Single connection point: frontend ↔ Supabase (Postgres + REST via supabase-js).
 * Override with `.env` (see `.env.example`); fallbacks keep local dev working if unset.
 */
const DEFAULT_URL = 'https://qpfyuqljhthvbcyxwpon.supabase.co';
const DEFAULT_ANON_KEY =
  'sb_publishable_At4xLTooEuNQd96EzGzS6g_4nO20fxn';

function readEnvUrl(): string {
  const v = import.meta.env.VITE_SUPABASE_URL;
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : DEFAULT_URL;
}

function readEnvKey(): string {
  const v = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : DEFAULT_ANON_KEY;
}

export const supabaseUrl = readEnvUrl();
export const supabaseAnonKey = readEnvKey();

/** True when URL/key look usable (anon key is never logged). */
export const isSupabaseConfigured: boolean =
  /^https?:\/\//i.test(supabaseUrl) && supabaseAnonKey.length > 0;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
