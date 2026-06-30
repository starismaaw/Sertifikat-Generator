# Desain: Pakta Integritas Generator

**Tanggal:** 2026-06-30
**Status:** Disetujui (menunggu review spec tertulis)
**Penulis:** Brainstorming session
**Proyek:** Sertifikat Generator — Balai P3KP Jawa III

---

## 1. Latar Belakang & Tujuan

Aplikasi **Sertifikat Generator** saat ini berjalan lokal (Vite + React + TypeScript,
deploy di Vercel) dengan penyimpanan **localStorage** dan tanpa backend. Aplikasi ini
akan ditambah fitur **Pakta Integritas Generator**: admin membuat dokumen pakta dari
template gambar, lalu **pegawai menandatangani sendiri lewat perangkat masing-masing**
(gores di layar). Karena fitur ini diakses publik oleh pegawai dan butuh sinkron lintas
perangkat, fitur Pakta menggunakan **backend Supabase** (database + storage).

### Tujuan
- Admin dapat membuat acara pakta (tunggal & massal) dari template gambar.
- Pegawai menandatangani via satu link publik, tanpa login, dengan memilih namanya.
- Tanda tangan digores di layar dan disisipkan ke PDF pakta.
- Hasil tersimpan permanen di Supabase; admin memantau status & mengunduh.

### Non-Tujuan (YAGNI)
- Akun/login pegawai, OTP, verifikasi identitas.
- Distribusi link via email otomatis.
- Migrasi fitur Sertifikat ke Supabase (tetap localStorage).
- Penomoran dokumen pakta (pakta tidak bernomor).
- Ekspor rekap Excel, tanda tangan balasan atasan, unggah file gambar ttd.

---

## 2. Keputusan Desain (hasil brainstorming)

| Aspek | Keputusan |
|---|---|
| Akses pegawai | Satu link publik `/ttd/<id-acara>`, pilih nama dari daftar, tanpa login, **terbuka penuh** (tanpa verifikasi) |
| Anti-dobel | Nama yang sudah ttd ditandai ✓ dan **dikunci** (tak bisa ditandatangani ulang/ditimpa) |
| Model dokumen | **Template gambar** — reuse editor sertifikat + jenis field baru "tanda tangan" |
| Mode pembuatan | **Tunggal + Massal** (impor daftar pegawai dari Excel/CSV) |
| Mekanisme ttd | **Gores di layar** (`signature_pad`) → PNG → disisipkan ke PDF |
| Penyimpanan hasil | **PDF final per pegawai** disimpan di Supabase Storage (bukti permanen) |
| Output admin | Dashboard status per acara (sudah/belum, hitungan) + unduh per orang + **ZIP semua** |
| Self-download | Pegawai mengunduh PDF miliknya setelah tanda tangan |
| Backend | Supabase (DB + Storage), **hanya untuk Pakta** |
| Login admin | **Satu sandi bersama** (2 operator), diverifikasi di **server** (`/api`), bukan di browser |

### Risiko yang diterima (didokumentasikan)
Model "terbuka penuh" berarti siapa pun yang memegang link dapat memilih nama pegawai
lain dan menandatangani atas namanya. Risiko penyalahgunaan identitas ini **diterima
secara sadar** oleh pemilik proyek demi kemudahan pemakaian internal berbasis kepercayaan.

---

## 3. Arsitektur

Dua jalur akses yang terpisah secara keamanan:

### 3.1 Jalur Pegawai (publik, tanpa login)
- Browser memuat halaman `/ttd/<id-acara>`.
- Memakai **Supabase anon key** (boleh ada di browser) dengan **RLS** yang membatasi:
  - `SELECT` data acara (`pakta_events`) dan daftar penandatangan (`pakta_signers`).
  - `UPDATE` baris signer **hanya saat status masih 'belum'** (untuk menyimpan ttd).
  - `INSERT` (upload) file PDF ke bucket `pakta-documents`.
- **PDF dibuat di perangkat pegawai** (pdf-lib + sisip PNG tanda tangan), lalu diunggah.

### 3.2 Jalur Admin (dilindungi sandi)
- Semua aksi admin (buat/edit acara, impor pegawai, lihat status, unduh massal) lewat
  **Vercel serverless `/api`**.
- Endpoint memverifikasi **sandi admin** (bandingkan dengan hash di env var server) dan
  memakai **`SUPABASE_SERVICE_ROLE_KEY`** yang **hanya ada di server** (tidak pernah ke
  browser), sesuai aturan proyek.
- Service-role melewati RLS untuk operasi admin penuh.

### 3.3 Alur data saat "Kirim" (pegawai)
1. Pegawai pilih nama → data terisi otomatis dari `pakta_signers`.
2. Pegawai menggores tanda tangan (canvas `signature_pad`).
3. Validasi `isEmpty()`; jika kosong, tolak dengan pesan.
4. `pdfRenderer` membuat PDF: render template + field teks (seperti sertifikat) +
   **sisip PNG tanda tangan** pada koordinat field bertipe `tandaTangan`.
5. Upload PDF ke `pakta-documents/<event_id>/<signer_id>.pdf`.
6. `UPDATE pakta_signers` set `status='sudah'`, `signed_at=now()`, `pdf_path=...`.
7. Tampilkan layar sukses + tombol unduh PDF miliknya.

---

## 4. Model Data

### Tabel `pakta_events`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid (pk) | id acara, dipakai di URL `/ttd/<id>` |
| `nama` | text | nama acara/pakta |
| `tanggal` | date | tanggal acara |
| `template_path` | text | path gambar template di Storage |
| `bg_width` | int | lebar natural template (px) |
| `bg_height` | int | tinggi natural template (px) |
| `fields` | jsonb | layout field (termasuk field `tandaTangan`) |
| `status` | text | 'aktif' \| 'ditutup' |
| `created_at` | timestamptz | default now() |

### Tabel `pakta_signers`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid (pk) | id penandatangan |
| `event_id` | uuid (fk → pakta_events) | acara terkait |
| `nama` | text | nama pegawai (tampil di daftar pilih) |
| `nip` | text | NIP (opsional, untuk pra-isi dokumen) |
| `jabatan` | text | jabatan (opsional, untuk pra-isi dokumen) |
| `data` | jsonb | field tambahan untuk pra-isi (fleksibel) |
| `status` | text | 'belum' \| 'sudah' |
| `signed_at` | timestamptz | waktu tanda tangan (null bila belum) |
| `pdf_path` | text | path PDF bertanda tangan di Storage (null bila belum) |

### Storage Buckets
- `pakta-templates` — gambar template, **1× per acara** (hemat storage).
- `pakta-documents` — PDF bertanda tangan, `<event_id>/<signer_id>.pdf`.

### Kebijakan RLS (intent)
- `pakta_events`: anon `SELECT` diizinkan (perlu untuk render halaman ttd).
- `pakta_signers`: anon `SELECT` diizinkan; anon `UPDATE` diizinkan **hanya dengan
  `USING (status = 'belum')`** sehingga record yang sudah ditandatangani terkunci.
- Bucket `pakta-documents`: anon `INSERT` diizinkan; pembacaan untuk unduh memakai
  **signed URL** dari Storage.
- Operasi admin (semua write penuh, hapus, baca lintas acara) hanya via service-role
  di server.

> Catatan: kapasitas free tier Supabase (1 GB storage, 500 MB DB, 5 GB bandwidth/bulan)
> mencukupi untuk ~150 pegawai (perkiraan ~90 MB), termasuk beberapa acara per tahun.

### Pra-isi Dokumen (saat pegawai memilih namanya)
Admin mengunggah **data seluruh pegawai** (Nama, NIP, Jabatan) ke `pakta_signers`.
Ketika pegawai memilih namanya di halaman `/ttd/<id>`, dokumen pakta langsung terisi
otomatis dari baris signer tersebut:
- Field `nama` → Nama pegawai
- Field `nip` → NIP pegawai
- Field `jabatan` → Jabatan pegawai
- **Area tanda tangan** menampilkan **Nama + NIP** pegawai (field `nama` dan `nip`
  ditempatkan di dekat kotak `tandaTangan`), tepat di atas/di bawah goresan tanda tangan.

Pegawai **tidak mengetik data apa pun** — hanya memilih nama lalu menggores tanda tangan.

---

## 5. Komponen

### 5.1 Reuse (diperluas)
- **`src/types.ts`** — tambah jenis field Pakta ke `FieldTipe`:
  `'nama'`, `'nip'`, `'jabatan'`, `'tandaTangan'` (jenis `'nama'` dan `'tanggal'`
  sudah ada dari fitur sertifikat; `'nip'`, `'jabatan'`, `'tandaTangan'` baru).
- **Editor** (`CertificateEditor`, `EditorCanvas`, `FieldPalette`, `FieldProperties`) —
  dukung field teks `nama`/`nip`/`jabatan` dan field `tandaTangan` (kotak placeholder,
  tanpa teks).
- **`src/lib/pdfRenderer.ts`** — bila ada field `tandaTangan`, sisipkan PNG tanda tangan
  via `embedPng` pada koordinat/ukuran field tersebut.
- **`src/lib/dataImporter.ts`** — impor daftar pegawai (nama/NIP/jabatan) untuk mode massal.
- **`jszip`** — unduh ZIP semua PDF bertanda tangan.

### 5.2 Komponen Baru
- **`src/lib/supabaseClient.ts`** — Supabase client (anon key) untuk jalur publik.
- **`src/lib/paktaStore.ts`** — abstraksi akses data Pakta: jalur publik (anon) & jalur
  admin (panggil `/api`).
- **`api/pakta-admin.ts`** — endpoint admin terlindungi sandi (buat/list/detail acara,
  impor signer, lihat status, buat signed URL unduh, unduh ZIP) memakai service-role.
- **UI Admin Pakta:**
  - Daftar acara pakta (mirip `EventList`).
  - Editor pakta (reuse editor sertifikat).
  - Form/impor daftar pegawai (mode tunggal & massal).
  - Dashboard status acara: hitungan "x/y sudah", tabel pegawai (status, waktu),
    unduh per orang + ZIP semua, tampilkan **link publik + QR code**.
- **UI Publik Pakta:**
  - Halaman `/ttd/:id`: pilih/cari nama → pratinjau pakta terisi → canvas tanda tangan
    (`react-signature-pad-wrapper`) → Kirim → layar sukses + unduh.
- **Routing:** perluas `AppRouter`. Halaman tanda tangan adalah **rute publik tersendiri**
  yang dirender tanpa shell admin (tanpa topbar/breadcrumb admin).

### 5.3 Dependensi Baru
- `@supabase/supabase-js` — client database & storage.
- `react-signature-pad-wrapper` — canvas tanda tangan (touch/HiDPI friendly).
- `qrcode` — render QR code untuk link publik.

### 5.4 Variabel Lingkungan (Vercel, tidak di-commit)
- `VITE_SUPABASE_URL` — URL proyek Supabase (boleh publik).
- `VITE_SUPABASE_ANON_KEY` — anon key (boleh publik, dibatasi RLS).
- `SUPABASE_SERVICE_ROLE_KEY` — **rahasia, hanya server `/api`**.
- `PAKTA_ADMIN_PASSWORD_HASH` — hash sandi admin untuk verifikasi server.

---

## 6. Penanganan Error

### Jalur Publik
- Acara tidak ditemukan / `status='ditutup'` → halaman pesan ramah, tak bisa ttd.
- Nama sudah ttd → ditampilkan ✓ dan dinonaktifkan di daftar pilih.
- Tanda tangan kosong (`isEmpty()`) → tolak kirim dengan pesan.
- Gagal upload / jaringan → tampilkan error + tombol coba lagi; ttd tidak hilang.
- Semua pesan dalam **Bahasa Indonesia, gaya resmi**, konsisten dengan aplikasi.

### Jalur Admin
- Sandi salah → 401 dari `/api`, pesan jelas, tanpa membocorkan detail.
- Validasi impor (reuse): baris kosong, kolom belum dipetakan.
- Kuota storage / kegagalan Supabase → pesan + saran tindakan.

---

## 7. Strategi Testing (vitest, sudah terpasang)

Tes memverifikasi **maksud bisnis**, bukan sekadar perilaku:
- `pdfRenderer`: PNG tanda tangan tersisip pada koordinat & ukuran field `tandaTangan`
  yang benar (gagal bila penempatan salah).
- Transisi status signer: signer berstatus 'sudah' **tidak boleh** bisa ditandatangani
  ulang (mengunci bukti).
- Mapping impor daftar pegawai → field signer benar.
- Pra-isi dokumen: memilih nama mengisi field `nama`/`nip`/`jabatan` dan area tanda
  tangan dengan data signer yang benar (gagal bila salah pegawai/salah pemetaan).
- Resolusi acara dari id (termasuk acara tidak ditemukan / ditutup).

Manual: uji end-to-end di **HP nyata** dengan satu pegawai contoh (pilih nama → gores →
kirim → unduh; admin melihat status berubah & mengunduh ZIP).

---

## 8. Urutan Implementasi (garis besar)

1. Setup Supabase: proyek, tabel, RLS, bucket, env var.
2. `supabaseClient.ts` + `paktaStore.ts` (jalur publik).
3. Perluas `types.ts` + editor + `pdfRenderer.ts` untuk field `tandaTangan`.
4. `api/pakta-admin.ts` (verifikasi sandi + service-role) + jalur admin di `paktaStore.ts`.
5. UI admin: daftar acara, editor pakta, impor pegawai, dashboard + QR.
6. UI publik `/ttd/:id`: pilih nama → pratinjau → canvas ttd → kirim → unduh.
7. Tes unit + uji manual end-to-end di HP.

(Rincian langkah dibuat pada tahap *writing-plans*.)
