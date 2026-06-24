# Sertifikat Generator | Certificate Generator

Aplikasi web untuk membuat dan mengelola sertifikat secara massal.
A web application for creating and managing certificates in bulk.

## Deskripsi Singkat | Overview

Sertifikat Generator memungkinkan Anda untuk:
- **Mode Tunggal**: Membuat sertifikat individual dengan upload latar belakang PNG/JPG dan penempatan field secara manual
- **Mode Massal**: Mengimpor data dari Excel/CSV dan menghasilkan sertifikat dalam format ZIP

Fitur utama:
- Pengedit visual drag-drop untuk penempatan field
- Pola penomoran yang dapat dikonfigurasi per acara (sequence tracking)
- Validasi otomatis baris kosong dan kolom yang tidak dipetakan
- Deteksi dan pembatasan ukuran file PNG/JPG
- Konversi PDF dengan teks vektor di atas latar belakang
- Penyimpanan data lokal (localStorage) — data tidak tersimpan di server

---

Certificate Generator lets you:
- **Single Mode**: Create individual certificates with PNG/JPG background upload and manual field placement
- **Bulk Mode**: Import data from Excel/CSV and generate certificates as a ZIP file

Key features:
- Visual drag-drop editor for field placement
- Configurable numbering patterns per event (sequence tracking)
- Automatic validation of empty rows and unmapped columns
- PNG/JPG file size detection and limits
- PDF conversion with vector text over background
- Local data storage (localStorage) — no server-side storage

---

## Instalasi | Installation

```bash
npm install
```

## Pengiriman Email | Email Delivery (Resend + Vercel)

Fitur kirim sertifikat via email membutuhkan dua variabel lingkungan di Vercel
(Project Settings → Environment Variables) — JANGAN commit ke repo:

- `RESEND_API_KEY` — API key dari https://resend.com
- `RESEND_FROM` — alamat pengirim pada domain yang sudah diverifikasi di Resend,
  mis. `noreply@<domain-balai>.go.id`

### Uji Lokal | Local Testing

Serverless function (`/api`) tidak berjalan di `vite dev`. Untuk uji end-to-end:

```bash
npm i -g vercel
vercel dev
```

Buat file `.env.local` (sudah di-ignore git) berisi `RESEND_API_KEY` dan
`RESEND_FROM` untuk pengujian lokal.

Create a `.env.local` file (already git-ignored) containing `RESEND_API_KEY` and
`RESEND_FROM` for local testing.

---

## Pengembangan | Development

```bash
npm run dev
```

Buka browser di `http://localhost:5173` (atau URL yang ditampilkan di terminal).

Open your browser to `http://localhost:5173` (or the URL shown in your terminal).

## Testing

```bash
npm run test
```

Menjalankan full test suite (18 tests across 5 test files).
Runs the full test suite (18 tests across 5 test files).

## Build untuk Produksi | Production Build

```bash
npm run build
```

File aplikasi akan dihasilkan di folder `dist/`. Siap untuk deployment.
Application files will be generated in the `dist/` folder. Ready for deployment.

## Preview Build Lokal | Local Build Preview

```bash
npm run preview
```

Melihat hasil build sebelum deployment.
Preview the build output before deployment.

---

## Catatan Penting | Important Notes

### Data Storage
Semua data aplikasi disimpan di **localStorage browser lokal** — tidak ada server atau database. Ini berarti:
- Data tersimpan per-browser (Chrome, Firefox, Safari, dll. adalah storage terpisah)
- Data tidak tersinkronisasi antar komputer
- Membersihkan cache browser akan menghapus semua data

All application data is stored in **your browser's localStorage** — no server or database. This means:
- Data is stored per-browser (Chrome, Firefox, Safari, etc. have separate storage)
- Data does not sync across computers
- Clearing browser cache will erase all data

### Future Upgrade Path

Aplikasi dirancang untuk mudah ditingkatkan ke arsitektur backend+database:
- Event persistence digabungkan di `EventStore` (mudah diganti dengan API call)
- Fitur login, email delivery, dan QR code verification dapat ditambahkan nanti
- Struktur kode memisahkan data layer dari UI layer untuk kemudahan migrasi

The application is designed to easily upgrade to a backend+database architecture:
- Event persistence is encapsulated in `EventStore` (easily replaced with API calls)
- Login, email delivery, and QR code verification features can be added later
- Code structure separates data layer from UI layer for migration ease

---

## Struktur Folder | Folder Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── lib/            # Utilities (PDF rendering, data import, value resolution)
├── types.ts        # TypeScript type definitions
└── App.tsx         # Main application entry point

tests/             # Test suites
dist/              # Production build output (created by `npm run build`)
```

---

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool
- **Vitest** — Test runner
- **jsPDF** — PDF generation
- **JSZip** — ZIP file creation
