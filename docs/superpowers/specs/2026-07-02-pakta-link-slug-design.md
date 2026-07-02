# Slug Custom untuk Link Tanda Tangan Pakta Integritas

**Tanggal:** 2026-07-02
**Status:** Disetujui, siap masuk tahap perencanaan implementasi

## Masalah

User: "pada Link Tanda Tangan unik untuk user/pegawai saat ini link nya tidak
human-readable, terlalu unik. Apakah bisa di buat custom oleh admin?"

Riset kode menemukan bahwa link Pakta Integritas saat ini **per-kegiatan
(event)**, bukan per-pegawai — semua pegawai memakai URL yang sama, lalu
memilih nama masing-masing dari dropdown. Formatnya `#pakta/{eventId}` di
mana `eventId` adalah UUID mentah dari Postgres (`gen_random_uuid()`),
misalnya `#pakta/550e8400-e29b-41d4-a716-446655440000` — tidak terbaca
manusia dan tidak bisa diingat/diketik ulang.

Setelah klarifikasi dengan user, scope yang disepakati: **tetap satu link
per kegiatan** (bukan link individual per pegawai), tapi bagian identifier
di URL bisa diganti admin jadi teks yang mudah dibaca (mis.
`#pakta/pelatihan-juli-2026`).

## Keputusan Desain

### Kapan admin mengatur slug
Slug otomatis dibuat dari nama kegiatan saat kegiatan dibuat (mis.
"Pelatihan Juli 2026" → `pelatihan-juli-2026`), admin bisa mengubahnya
kapan saja dari halaman dashboard kegiatan.

### Slug lama setelah diubah
Begitu admin mengubah slug, slug lama langsung berhenti berfungsi (tidak
ada redirect/alias). Admin bertanggung jawab membagikan ulang link baru
jika sudah pernah dibagikan.

### Kegiatan yang sudah ada (migrasi)
Semua kegiatan yang sudah ada sebelum fitur ini otomatis diberi slug (dari
nama kegiatannya) lewat migration SQL satu kali. Link UUID lama berhenti
berfungsi setelah migration ini dijalankan — lookup publik beralih
sepenuhnya ke kolom `slug`, bukan lagi `id`.

### UX edit slug
Inline di kartu "Link Tanda Tangan" yang sudah ada di `PaktaDashboard.tsx`
(bukan modal terpisah): tombol "Ubah" → input teks di tempat, validasi
real-time, tombol "Simpan".

### Format slug
Huruf kecil, angka, dan tanda hubung (`-`) saja, panjang 3–60 karakter,
tidak boleh diawali/diakhiri tanda hubung, tidak boleh ada tanda hubung
berurutan. Pola regex: `^[a-z0-9]+(-[a-z0-9]+)*$`. Ini keputusan teknis
default (belum secara eksplisit diminta user, tapi dikonfirmasi user saat
presentasi desain — lihat catatan approval).

## Batasan Penting

**Perubahan ini menyentuh skema database Supabase produksi** (tabel
`pakta_events` dapat kolom baru + constraint + backfill data). Sesuai
aturan proyek (`AGENTS.md`): migration SQL ditulis sebagai file di
`supabase/migrations/`, TIDAK dijalankan otomatis oleh agent — mengikuti
pola migration `0001_pakta_init.sql` yang sudah ada ("Jalankan sekali di
Supabase SQL Editor"). User yang menjalankan migration ini secara manual
di Supabase SQL Editor produksi, dengan approval eksplisit.

## Perubahan Teknis

### 1. Migration: `supabase/migrations/0002_pakta_event_slug.sql`

Tiga langkah dalam satu file:

1. `ALTER TABLE pakta_events ADD COLUMN slug text;` (nullable dulu).
2. Backfill: untuk tiap baris yang ada, hitung slug dasar dari `nama`
   (`lower(regexp_replace(nama, '[^a-z0-9]+', '-', 'g'))`, trim tanda hubung
   di awal/akhir), lalu tambah akhiran `-2`, `-3`, dst untuk baris dengan
   slug dasar yang sama (pakai `row_number() over (partition by base_slug
   order by created_at)`).
3. `ALTER TABLE pakta_events ALTER COLUMN slug SET NOT NULL;` + `ADD
   CONSTRAINT pakta_events_slug_unique UNIQUE (slug);` + `ADD CONSTRAINT
   pakta_events_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND
   length(slug) BETWEEN 3 AND 60);`

### 2. Utilitas baru: `src/lib/slug.ts`

Fungsi `slugify(text: string): string` — lowercase, ganti karakter selain
`a-z0-9` dengan `-`, collapse tanda hubung berurutan, trim tanda hubung di
awal/akhir, potong ke maksimum 60 karakter. Dipakai di sisi server
(`api/pakta-admin.ts`) saat membuat kegiatan baru.

### 3. `api/pakta-admin.ts`

- **`create_event`**: setelah validasi `nama`/`tanggal` yang sudah ada,
  hitung `slugify(nama)`, coba `insert` — kalau kena unique-violation
  (kode Postgres `23505`), tambah akhiran `-2`, `-3`, dst dan coba lagi
  (maks. ~30 percobaan sebelum menyerah dengan error jelas). Ini
  menghindari race condition dibanding cek-lebih-dulu-baru-insert.
- **`update_event`**: action generik ini sudah ada dan sudah cukup untuk
  menerima `{ id, slug }`. Tambahkan pemetaan error: kalau `error.code ===
  '23505'` pada update, kembalikan pesan `"Slug ini sudah dipakai kegiatan
  lain"` (bukan pesan mentah Postgres). Validasi format slug juga
  dilakukan di sisi server sebelum update (defense in depth, selain
  constraint DB).
- **`get_event`**: tidak perlu diubah — sudah `select('*', ...)` sehingga
  kolom `slug` otomatis ikut terbawa setelah migration jalan.

### 4. `src/lib/paktaStore.ts`

- `getAcaraPakta(id: string)` diubah jadi `getAcaraByLink(slug: string)` —
  query `.eq('slug', slug)` menggantikan `.eq('id', id)`. Return value
  tetap menyertakan `eventId: data.id` (UUID asli), karena
  `pakta_signers` dan operasi lain di dalam alur tanda tangan tetap
  memakai UUID asli secara internal — hanya lookup awal by-slug yang
  berubah.

### 5. `src/components/pakta-signer/PaktaSignPage.tsx`

- Prop `eventId` yang diterima dari router sekarang berisi **slug**
  (bukan UUID) — nilai mentah dari `#pakta/{slug}`.
- `getAcaraByLink(slug)` dipanggil dulu; setelah dapat hasil (yang berisi
  `eventId` = UUID asli), baru `listSigners(template.eventId)` dipanggil.
  Ini mengubah `Promise.all([...])` yang sekarang paralel jadi berurutan
  (harus resolve slug dulu sebelum tahu UUID asli untuk query signer) —
  trade-off kecil, jumlah data di alur ini kecil sehingga tidak berdampak
  terasa ke performa.
- Kalau slug tidak ditemukan (termasuk kalau seseorang masih pakai link
  UUID lama), tetap masuk state `notFound` yang sudah ada — tidak perlu
  logika baru untuk kasus ini, cukup konsekuensi alami dari lookup by-slug
  yang gagal.

### 6. `src/components/pakta-admin/PaktaDashboard.tsx`

- `EventDetail` interface ditambah field `slug: string`.
- `publicUrl` dihitung dari `event.slug`, bukan lagi `eventId` mentah —
  perlu pindah dari konstanta di awal komponen ke turunan dari `event`
  setelah `load()` selesai (karena slug baru diketahui setelah fetch,
  tidak seperti `eventId` yang sudah ada dari props).
- Kartu "Link Tanda Tangan" (baris ~296-313 saat ini) ditambah UI edit
  inline: tombol "Ubah" → jadi `<input>` terisi slug saat ini, validasi
  client-side pola yang sama dengan constraint DB, tombol "Simpan"
  memanggil `callAdmin('update_event', { id: eventId, slug: newSlug })`.
  Setelah sukses: update state lokal `event.slug`, regenerasi QR code
  (`QRCode.toDataURL` dengan `publicUrl` baru).
- Error dari server (slug sudah dipakai / format salah) ditampilkan di
  dekat input, tidak memblokir UI lain di dashboard.

### 7. `src/components/AppRouter.tsx`

- Tidak ada perubahan struktural pada `parseHash`/`navigate` — segmen
  setelah `pakta/` tetap ditangkap sebagai string bebas (`id`), yang
  sekarang secara semantik berisi slug untuk view `pakta-signer`. Tidak
  perlu mengubah nama field `eventId` di `View` type untuk menghindari
  cross-cutting rename yang tidak perlu — cukup didokumentasikan lewat
  komentar bahwa untuk `pakta-signer`, nilai ini adalah slug publik, bukan
  UUID.

## Non-Tujuan / Di Luar Cakupan

- Tidak membuat link individual per pegawai (opsi yang sempat
  dipertimbangkan, ditolak user — tetap satu link per kegiatan).
- Tidak ada redirect/alias dari slug lama ke slug baru setelah diubah.
- Tidak mengubah navigasi admin-internal (`pakta-editor`, `pakta-dashboard`
  tetap pakai UUID asli lewat `event.id` — hanya link publik yang
  terdampak).
- Tidak menjalankan migration SQL terhadap database produksi — itu
  tindakan manual user di luar sesi agent ini.

## Verifikasi

1. Unit test `slugify()`: kasus spasi, karakter aneh/simbol, huruf besar,
   string kosong/hanya simbol, string sangat panjang (dipotong ke 60
   karakter).
2. Unit test `getAcaraByLink(slug)`: ditemukan by slug, tidak ditemukan
   kalau slug salah/tidak ada, tidak ditemukan kalau status `ditutup`
   (perilaku existing `getAcaraPakta` yang harus tetap sama).
3. Test API `create_event`: slug otomatis dari nama; dua kegiatan dengan
   nama identik menghasilkan slug `-2`, `-3`, dst.
4. Test API `update_event` dengan slug: sukses ganti slug; gagal dengan
   pesan jelas kalau slug sudah dipakai kegiatan lain; gagal kalau format
   tidak valid.
5. Verifikasi manual browser: buka dashboard kegiatan → ubah slug lewat UI
   inline → link & QR code di kartu berubah → buka link baru di tab
   publik → berhasil masuk halaman pilih nama → buka link lama (slug
   sebelumnya) → tampil halaman "tidak ditemukan".
