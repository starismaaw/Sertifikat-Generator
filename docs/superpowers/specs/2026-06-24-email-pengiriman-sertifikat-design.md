# Desain: Pengiriman Sertifikat Otomatis via Email

**Tanggal:** 2026-06-24
**Status:** Disetujui (desain) — menunggu rencana implementasi
**Branch target:** `feat/email-pengiriman` (dibuat dari `origin/main`)

## 1. Tujuan & Konteks

Menambahkan kemampuan mengirim sertifikat PDF langsung ke email penerima dari
mode **Massal**. Aplikasi saat ini 100% client-side (Vite + React 18, pdf-lib,
Konva, localStorage) tanpa backend. Email penerima diambil dari kolom pada file
Excel/CSV yang diimpor.

**Keputusan kunci yang sudah disepakati:**

- Arsitektur: backend kecil — **Resend** (layanan email) + **Vercel serverless
  function**. Bukan client-side (EmailJS) karena batas ukuran lampiran & volume
  serta konteks resmi pemerintah.
- Sumber email: kolom "email" pada Excel/CSV (mode Massal).
- Alur: **preview & konfirmasi dulu**, baru kirim. Ada status per-baris &
  ringkasan berhasil/gagal.
- Isi email: template **bisa diedit pengguna** di UI (subjek + badan dengan
  placeholder variabel), disimpan per-acara di localStorage.
- PDF dibuat di browser (`renderCertificate()` yang sudah ada), dikirim sebagai
  base64 ke backend yang meneruskan ke Resend. Tidak menduplikasi logika render
  di server.

## 2. Arsitektur & Alur Data

```
Browser (mode Massal)                    Vercel Serverless           Resend
─────────────────────                    ─────────────────           ──────
1. Impor Excel/CSV + mapping (sudah ada)
2. Map kolom "email" (baru)
3. renderCertificate() -> PDF per baris (sudah ada)
4. Tabel preview: nama | email | nomor | status valid
5. Edit template subjek/badan email
6. Klik "Kirim Semua"  ── POST /api/send-certificates ─►
   (batch 5-10 penerima)   { from, subject, body,
                             recipients:[{email,nama,pdfBase64,filename}] }
                                              ── resend.batch.send() ─► email + lampiran
   ◄── { sent:[...], failed:[...] } ─────────
7. Update status per baris: terkirim / gagal + ringkasan
```

Prinsip keamanan: `RESEND_API_KEY` **hanya** di env Vercel, tidak pernah masuk
ke kode browser. Domain pengirim diverifikasi di Resend (mis.
`noreply@<domain-balai>.go.id`).

## 3. Komponen & Perubahan File

### Backend (baru)

- `api/send-certificates.ts` — Vercel serverless function. Menerima POST
  `{ from, subject, body, recipients[] }`, memvalidasi, memanggil
  `resend.batch.send()`, mengembalikan `{ sent[], failed[] }`. Membaca
  `RESEND_API_KEY` dari env. Menambah dependency `resend`.
- Dokumentasi variabel lingkungan (README / docs) — tidak ada `.env` di-commit.

### Frontend (perubahan minimal, ikut pola yang ada)

- `src/lib/emailValidation.ts` (baru) — validasi format email + util status.
  Murni fungsi, mudah diuji.
- `src/lib/emailSender.ts` (baru) — transport: chunk penerima menjadi batch,
  `fetch('/api/send-certificates')`, agregasi hasil, retry ringan untuk yang
  gagal. Tidak ada UI.
- `src/lib/emailTemplate.ts` (baru) — interpolasi placeholder `{nama}`,
  `{nomor}`, dll. + load/save template per-acara (localStorage ber-versi).
- `src/components/generate/ColumnMapper.tsx` — perluasan kecil: memetakan kolom
  email (non-field, opsional).
- `src/components/generate/SendEmailPanel.tsx` (baru) — compound component UI:
  editor template, tabel penerima + status, tombol kirim, progress & ringkasan.
- `src/components/generate/GenerateBulk.tsx` — menyimpan PDF bytes per baris
  (bukan hanya ZIP) dan menampilkan `SendEmailPanel` setelah fase generate.

Pemisahan tanggung jawab: transport (`emailSender`) != validasi
(`emailValidation`) != template (`emailTemplate`) != UI (`SendEmailPanel`).
Masing-masing dapat diuji secara independen.

## 4. Tipe Data (TypeScript)

Discriminated union untuk hasil kirim (narrowing aman, tanpa `any`):

```typescript
// emailSender.ts
interface Recipient { email: string; nama: string; pdfBase64: string; filename: string; }
interface SendRequest { from: string; subject: string; body: string; recipients: Recipient[]; }

type SendResult =
  | { status: 'sent'; email: string; id: string }
  | { status: 'failed'; email: string; error: string };

interface SendSummary { sent: SendResult[]; failed: SendResult[]; }
```

Status preview per-baris memakai union eksplisit, bukan boolean berlapis:

```typescript
type RecipientStatus = 'valid' | 'invalid-email' | 'sending' | 'sent' | 'failed';
```

## 5. Komposisi Komponen (composition-patterns)

- `SendEmailPanel` sebagai **compound component**: provider state kirim dengan
  anak `SendEmailPanel.TemplateEditor`, `SendEmailPanel.RecipientTable`,
  `SendEmailPanel.SendButton`.
- State kirim **diangkat** ke provider (`state-lift-state`) dan dibagikan via
  `useContext` — React 18, **bukan** `forwardRef`/`use()`.
- Gunakan `children`, bukan `renderX` props. Hindari boolean props untuk variasi
  perilaku (`architecture-avoid-boolean-props`).

## 6. Error Handling & Performa

- Kirim per-batch kecil (5-10) via `resend.batch.send`; batch berurutan dengan
  progress di UI, anggota dalam batch diproses paralel di server
  (`async-parallel`). Hindari satu payload raksasa (limit Vercel ~4.5MB).
- Validasi email **di-derive saat render** (`useMemo`,
  `rerender-derived-state`), bukan via `useEffect`.
- Backend: validasi input, **early-exit** jika `recipients` kosong atau melebihi
  batas; jangan pernah membocorkan API key di pesan error. Map error Resend ke
  pesan per-penerima.
- Gagal sebagian tetap dianggap sukses parsial; tabel menandai baris gagal dan
  menyediakan tombol "Kirim Ulang yang Gagal".

## 7. Keamanan (sesuai AGENTS.md)

- `RESEND_API_KEY` hanya di env Vercel; tidak ada `.env*` di-commit.
- Tidak menyentuh Supabase, auth, storage, atau RLS.
- Domain pengirim diverifikasi di Resend.
- Tidak mengubah pengaturan deployment Vercel tanpa persetujuan eksplisit
  (penambahan env var akan dikonfirmasi ke pengguna).

## 8. Penyimpanan Template (client-localstorage-schema)

Template per-acara disimpan ber-versi agar aman dievolusi:

```typescript
interface StoredTemplate { v: 1; subject: string; body: string; }
// key: `emailTemplate:<eventId>`
```

Default template gaya surat resmi Bahasa Indonesia disediakan jika belum ada.

## 9. Testing (Vitest — uji intent, Rule 9)

- `emailValidation` — format valid/invalid, baris tanpa email.
- `emailSender` — chunking benar, agregasi `sent`/`failed`, retry baris gagal.
- `emailTemplate` — interpolasi `{nama}`/`{nomor}` terisi; placeholder tak
  dikenal dibiarkan utuh; load/save versi.
- Backend handler — payload kosong/over-limit ditolak; API key tidak muncul di
  respons.

## 10. Di Luar Lingkup (YAGNI)

- Mode Tunggal (input email manual) — tidak termasuk kali ini.
- Penjadwalan/antrian kirim tertunda.
- Pelacakan open/click (webhook Resend).
- Penyimpanan riwayat pengiriman di server/Supabase.
