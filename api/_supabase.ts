import { createClient } from '@supabase/supabase-js';

export function makeServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase belum dikonfigurasi di server');
  return createClient(url, key);
}
