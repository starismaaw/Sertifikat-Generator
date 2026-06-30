import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Kembalikan Supabase client (anon key). Singleton per session browser. */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url) throw new Error('VITE_SUPABASE_URL belum dikonfigurasi');
  if (!key) throw new Error('VITE_SUPABASE_ANON_KEY belum dikonfigurasi');

  _client = createClient(url, key);
  return _client;
}

/** Reset singleton — hanya untuk tes. */
export function _resetClientForTests(): void {
  _client = null;
}
