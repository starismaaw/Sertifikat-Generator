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

// postgrest-js sendiri sudah retry otomatis untuk fetch yang gagal (3x,
// backoff 1s/2s/4s ≈ 7 detik total) sebelum mengembalikan error ke sini —
// riwayat run yang gagal durasinya konsisten ~7 detik, pas dengan retry
// bawaan itu, jadi network blip-nya sempat bertahan lebih lama dari itu.
// Loop di luar ini nambah kesempatan lagi dengan jeda lebih panjang untuk
// blip yang lebih lama dari retry internal tsb.
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 30_000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const { data, error } = await supabase.from('pakta_events').select('id').limit(1)

  if (!error) {
    console.log(
      `keep-supabase-alive: OK — pakta_events query berhasil (${data.length} baris, percobaan ke-${attempt}/${MAX_ATTEMPTS}) pada ${new Date().toISOString()}`
    )
    process.exit(0)
  }

  // error.details memuat penyebab asli (nama/kode error jaringan seperti
  // ENOTFOUND/ECONNRESET/ETIMEDOUT + stack cause) yang sebelumnya hilang
  // karena cuma error.message yang dicatat — message-nya cuma bilang
  // "TypeError: fetch failed" tanpa alasan sebenarnya di baliknya.
  console.error(
    `keep-supabase-alive: percobaan ke-${attempt}/${MAX_ATTEMPTS} gagal — ${error.message}` +
      (error.details ? `\n${error.details}` : '') +
      (error.hint ? `\nHint: ${error.hint}` : '')
  )

  if (attempt < MAX_ATTEMPTS) {
    await sleep(RETRY_DELAY_MS)
  }
}

console.error('keep-supabase-alive: semua percobaan gagal.')
process.exit(1)
