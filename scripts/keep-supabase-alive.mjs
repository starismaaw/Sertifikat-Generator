// scripts/keep-supabase-alive.mjs
// Ping Supabase secara berkala supaya project Free Plan tidak di-pause
// karena 7 hari tanpa aktivitas database. Dijalankan oleh GitHub Actions
// (.github/workflows/keep-supabase-alive.yml), bukan bagian dari aplikasi.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'keep-supabase-alive: env var SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY belum di-set'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase.from('pakta_events').select('id').limit(1)

if (error) {
  console.error('keep-supabase-alive: query gagal —', error.message)
  process.exit(1)
}

console.log(
  `keep-supabase-alive: OK — pakta_events query berhasil (${data.length} baris) pada ${new Date().toISOString()}`
)
