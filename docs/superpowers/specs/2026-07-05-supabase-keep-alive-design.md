# Supabase Keep-Alive — Cegah Auto-Pause Free Plan

**Tanggal**: 2026-07-05
**Status**: Disetujui, menunggu implementasi

## Masalah

Supabase Free Plan men-pause project yang tidak menunjukkan aktivitas database yang cukup selama 7 hari berturut-turut (dikonfirmasi via riset Context7 terhadap dokumentasi resmi Supabase — lihat `apps/docs/content/guides/platform/free-project-pausing.mdx`). Satu-satunya cara yang **dijamin** mencegah pause adalah upgrade ke Pro Plan; project ini tetap di Free Plan, jadi dibutuhkan workaround yang menghasilkan aktivitas database rutin sebelum ambang 7 hari tercapai.

Konteks project: Vite + React SPA, deploy di Vercel (serverless functions di `api/`), database Supabase Postgres, repo di GitHub. Tidak ada workflow GitHub Actions atau `vercel.json` yang sudah ada.

## Pendekatan Terpilih

GitHub Actions scheduled workflow yang menjalankan script Node kecil untuk melakukan query ringan langsung ke Supabase, menggunakan service role key sebagai GitHub Actions secret.

**Alternatif yang dipertimbangkan dan ditolak:**
- **Vercel Cron Jobs** — butuh endpoint API publik baru + perubahan `vercel.json` (kategori "deployment settings" yang perlu approval eksplisit di aturan project), dan jadwal cron di Hobby plan tidak presisi.
- **Uptime monitor eksternal (cron-job.org/UptimeRobot)** — butuh endpoint publik baru yang perlu diproteksi, plus ketergantungan pada kebijakan free-tier pihak ketiga.

Pendekatan terpilih dipilih karena: tidak menambah attack surface (tidak ada endpoint publik baru), tidak menyentuh kode aplikasi/konfigurasi Vercel, dan kredensial sensitif tetap 100% server-side (GitHub Actions secret, tidak pernah ke browser).

## Desain

### Komponen

1. **`scripts/keep-supabase-alive.mjs`** — script Node ESM (mengikuti pola `scripts/copy-fonts.mjs` yang sudah ada: `.mjs` polos, tanpa build TypeScript).
   - Membuat client `@supabase/supabase-js` (dependency yang sudah ada) menggunakan `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` dari environment variable.
   - Menjalankan `supabase.from('pakta_events').select('id').limit(1)`.
   - Service role key dipakai (bukan anon key) agar query tetap sukses terlepas dari kebijakan RLS pada tabel `pakta_events`, tanpa perlu menambah exception RLS baru.
   - Log hasil (jumlah baris/pesan sukses) ke stdout.
   - Jika query mengembalikan error, `console.error` detail error lalu `process.exit(1)`.

2. **`.github/workflows/keep-supabase-alive.yml`** — GitHub Actions workflow.
   - Trigger: `schedule` cron `0 3 * * 1,4` (Senin & Kamis, 03:00 UTC / 10:00 WIB) — jarak maksimum antar-run 4 hari, memberi buffer di bawah ambang 7 hari.
   - Trigger tambahan: `workflow_dispatch` untuk uji manual kapan saja dari tab Actions.
   - Step: checkout repo → setup Node → `npm ci` (pakai `package-lock.json` yang sudah ada, konsisten dengan cara install project) → jalankan `node scripts/keep-supabase-alive.mjs` dengan env `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` diisi dari `secrets.SUPABASE_URL` / `secrets.SUPABASE_SERVICE_ROLE_KEY`.

### Data flow

```
GitHub Actions cron (Senin & Kamis 03:00 UTC)
  → workflow checkout + install deps
  → node scripts/keep-supabase-alive.mjs
      env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (dari GitHub Secrets)
  → @supabase/supabase-js client → SELECT id FROM pakta_events LIMIT 1
  → sukses: log + exit 0
  → gagal: log error + exit 1 → GitHub kirim email notifikasi kegagalan workflow ke pemilik repo
```

### Error handling

- Query gagal (network, auth, tabel tidak ada, dsb.) → script exit code 1 → GitHub Actions menandai run sebagai failed → GitHub secara default mengirim email notifikasi ke pemilik repo. Ini memberi sinyal dini jauh sebelum 7 hari terlewati tanpa aktivitas, alih-alih baru sadar setelah project benar-benar ter-pause.
- Tidak ada retry logic khusus — kegagalan satu run masih tertutup oleh run berikutnya 3-4 hari kemudian selama masalah bersifat sementara; kegagalan berulang akan terlihat dari email notifikasi GitHub yang berulang.

### Keamanan

- `SUPABASE_SERVICE_ROLE_KEY` disimpan sebagai GitHub Actions encrypted secret, di-scope ke repo ini saja. Tidak pernah muncul di kode, commit, log workflow (GitHub otomatis me-redact nilai secret dari log), atau bundle client.
- Tidak ada endpoint HTTP publik baru yang dibuat — mengeliminasi risiko endpoint keep-alive disalahgunakan pihak luar untuk membebani database.
- Tidak ada perubahan pada RLS policy tabel manapun.

### Testing / verifikasi

- Jalankan `node scripts/keep-supabase-alive.mjs` secara lokal dengan env var terisi (`.env.local` yang tidak di-commit) untuk verifikasi query berhasil sebelum push workflow.
- Setelah workflow di-push dan secrets ditambahkan di GitHub, trigger manual sekali via `workflow_dispatch` (tab Actions → "Run workflow") untuk memverifikasi run sukses end-to-end sebelum mengandalkan jadwal cron.
- Tidak perlu unit test — ini script infra satu-kali-pakai berjalan di CI, bukan bagian dari aplikasi yang diuji `vitest`.

## Aksi manual yang dibutuhkan dari user (di luar scope implementasi kode)

Setelah kode di-merge, user perlu menambahkan 2 secrets di **GitHub repo → Settings → Secrets and variables → Actions**:
- `SUPABASE_URL` — sama dengan nilai `VITE_SUPABASE_URL` yang sudah dipakai di Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` — sama dengan nilai yang sudah dipakai di Vercel env (dari Supabase dashboard → Settings → API → service_role key).

Tanpa kedua secrets ini, workflow akan gagal (dan mengirim email notifikasi kegagalan — sesuai desain error handling di atas, jadi kegagalan ini tidak akan senyap).

## Di luar scope

- Tidak mengubah `vercel.json` atau pengaturan deployment Vercel apa pun.
- Tidak menambah endpoint API baru di `api/`.
- Tidak mengubah skema database, RLS policy, atau migration.
- Tidak mengganti strategi jangka panjang (upgrade ke Pro Plan tetap satu-satunya cara yang dijamin resmi oleh Supabase; workaround ini adalah mitigasi untuk tetap di Free Plan).
