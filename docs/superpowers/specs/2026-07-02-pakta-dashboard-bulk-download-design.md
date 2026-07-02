# Spec: Unduh Massal (ZIP) di Dashboard Admin Pakta

**Tanggal:** 2026-07-02
**Status:** Approved
**Scope:** `api/pakta-admin.ts` (action baru `get_bulk_signed_urls`), `src/components/pakta-admin/PaktaDashboard.tsx`

---

## 1. Latar Belakang

Dashboard admin (`PaktaDashboard.tsx`) hanya punya tombol unduh PDF satu-per-satu (`downloadPdf`). Untuk acara dengan banyak peserta (skala aktual: ~150 pegawai), admin butuh cara mengunduh semua PDF yang sudah ditandatangani sekaligus sebagai satu file ZIP.

Kalau diimplementasikan naif (loop client-side memanggil action `get_signed_url` yang sudah ada — satu panggilan per peserta), untuk 150 peserta itu berarti 150 invocation terpisah ke Vercel serverless function. Untuk menghindari beban permintaan berlebih ke Vercel, signed URL untuk SEMUA path dibuat dalam **satu** invocation backend baru (`get_bulk_signed_urls`), bukan dipecah per peserta.

Codebase sudah punya infrastruktur yang bisa langsung dipakai ulang:
- `src/lib/download.ts` — `buildZip()` (JSZip) dan `downloadBlob()`, sudah dipakai fitur generate massal sertifikat.
- Pola state progress bertahap (`phase`, `progress`, `currentName`) di `src/components/generate/GenerateBulk.tsx:36-126` — dipakai sebagai referensi struktur, bukan diimpor langsung (komponen berbeda, domain berbeda).

---

## 2. Backend — action baru `get_bulk_signed_urls`

Tambah case di `api/pakta-admin.ts`, setelah case `get_signed_url` (baris 136-144) dan sebelum `get_template_upload_url` (baris 146):

```ts
case 'get_bulk_signed_urls': {
  const { paths } = body as { paths: string[] };
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'paths wajib diisi' });
  }

  const urls: Record<string, string> = {};
  for (const path of paths) {
    const { data, error } = await sb.storage
      .from('pakta-documents')
      .createSignedUrl(path, 3600);
    if (error || !data) return res.status(500).json({ error: error?.message ?? `Gagal membuat signed URL untuk ${path}` });
    urls[path] = data.signedUrl;
  }
  return res.status(200).json({ urls });
}
```

Loop terjadi di dalam SATU invocation serverless (server-side), bukan N invocation terpisah dari client — ini yang memangkas jumlah permintaan ke Vercel dari 150 jadi 1. Kalau salah satu `createSignedUrl` gagal di tengah loop, seluruh request gagal (500) — tidak ada partial result yang dikembalikan, konsisten dengan penanganan error "stop semua kalau ada yang gagal" di bagian 4.

Action ini otomatis terlindungi password admin (gate `verifyPassword` sudah berjalan sebelum `switch(action)`, sama seperti semua action lain di file ini).

---

## 3. Frontend — tombol dan alur unduh massal

### 3.1 State baru

`type BulkDownloadPhase = 'idle' | 'fetching' | 'zipping';` dideklarasikan di level modul (di luar komponen, di bawah import statement), sejajar dengan `interface Signer`/`interface EventDetail` yang sudah ada.

State React ditambahkan ke blok `useState` yang sudah ada di dalam `PaktaDashboard` (setelah baris `const [query, setQuery] = useState('');`):

```ts
const [bulkPhase, setBulkPhase] = useState<BulkDownloadPhase>('idle');
const [bulkDone, setBulkDone] = useState(0);
const [bulkTotal, setBulkTotal] = useState(0);
const [bulkCurrentName, setBulkCurrentName] = useState('');
```

### 3.2 Tombol

Ditambahkan di baris tombol aksi yang sudah ada (`Impor Pegawai`/`Refresh`, baris 129-136), disabled kalau `sudahCount === 0` atau `bulkPhase !== 'idle'`:

```tsx
<button
  className="sg-btn sg-btn-outline"
  disabled={sudahCount === 0 || bulkPhase !== 'idle'}
  onClick={downloadAllPdfs}
>
  {bulkPhase === 'idle' ? 'Unduh Semua (ZIP)' : '…'}
</button>
```

### 3.3 Fungsi `downloadAllPdfs`

Ditempatkan SETELAH `const filteredSigners = ...` (baris 96-98) dan SEBELUM `return (` (baris 100) — bukan di dekat `resetSigner`/`downloadPdf` (yang ditempatkan lebih awal, sebelum blok early-return `if (loading || !event) return ...` di baris 91). Ini penting karena fungsi ini butuh akses ke `signers` (daftar mentah, dihitung di baris 93), yang belum ada nilainya di titik `resetSigner` didefinisikan.

`const BULK_CONCURRENCY = 5;` dideklarasikan di level modul (sejajar dengan `interface Signer`, bukan di dalam komponen atau di dalam fungsi) — nilai konstan yang sama untuk semua render, tidak perlu dibuat ulang tiap kali fungsi dipanggil.

```ts
async function downloadAllPdfs() {
  if (!event) return;
  const signed = signers.filter(s => s.status === 'sudah' && s.pdf_path);
  if (signed.length === 0) return;

  setBulkPhase('fetching');
  setBulkDone(0);
  setBulkTotal(signed.length);
  setBulkCurrentName('');

  try {
    const paths = signed.map(s => s.pdf_path as string);
    const { urls } = await callAdmin<{ urls: Record<string, string> }>('get_bulk_signed_urls', { paths });

    const files: { name: string; bytes: Uint8Array }[] = new Array(signed.length);
    let doneCount = 0;

    async function fetchOne(index: number) {
      const s = signed[index];
      setBulkCurrentName(s.nama);
      const url = urls[s.pdf_path as string];
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Gagal mengunduh PDF ${s.nama}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      files[index] = { name: `pakta-${s.nama.replace(/\s+/g, '_')}.pdf`, bytes };
      doneCount++;
      setBulkDone(doneCount);
    }

    let cursor = 0;
    async function worker() {
      while (cursor < signed.length) {
        const index = cursor++;
        await fetchOne(index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, signed.length) }, worker));

    setBulkPhase('zipping');
    setBulkCurrentName('');
    const zip = await buildZip(files);

    downloadBlob(zip, `Pakta - ${event.nama}.zip`, 'application/zip');
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setBulkPhase('idle');
    setBulkDone(0);
    setBulkTotal(0);
    setBulkCurrentName('');
  }
}
```

Import tambahan di bagian atas file:
```ts
import { buildZip, downloadBlob } from '../../lib/download';
```

Catatan desain:
- `BULK_CONCURRENCY = 5` — mengambil 5 PDF sekaligus dari Supabase Storage per waktu, bukan 150 permintaan simultan (bisa dianggap membanjiri koneksi) dan bukan strict satu-per-satu (lambat untuk 150 file). Worker pool sederhana (`cursor` yang di-increment oleh N worker paralel) tanpa dependency baru.
- `files` diisi berdasarkan `index`, bukan `push()`, supaya urutan hasil ZIP tetap konsisten dengan urutan `signed` walau proses fetch-nya paralel dan bisa selesai tidak berurutan.
- Filename per-file dalam ZIP (`pakta-${nama}.pdf`) identik dengan konvensi `downloadPdf` yang sudah ada (baris 61) — konsisten.
- Filename ZIP (`Pakta - ${event.nama}.zip`) meniru pola `Sertifikat - ${event.nama}.zip` dari `GenerateBulk.tsx:139` — konsisten dengan konvensi penamaan file unduhan massal lain di aplikasi ini.
- Error apa pun (signed URL gagal, fetch gagal, zip gagal) menghentikan seluruh proses dan menampilkan `alert()` — tidak ada ZIP parsial yang diunduh.
- `finally` selalu mengembalikan `bulkPhase` ke `'idle'`, baik sukses maupun gagal.

### 3.4 Tampilan progress

Ditambahkan tepat di bawah baris tombol aksi (setelah baris 136), hanya muncul saat `bulkPhase !== 'idle'`:

```tsx
{bulkPhase !== 'idle' && (
  <div className="apple-progress" style={{ marginBottom: 16 }}>
    <div className="apple-progress-phase">
      {bulkPhase === 'fetching'
        ? `Mengunduh ${bulkDone} dari ${bulkTotal}${bulkCurrentName ? ` · ${bulkCurrentName}` : ''}`
        : 'Mengemas ZIP…'}
    </div>
    <div className="apple-progress-track">
      <div
        className={`apple-progress-fill ${bulkPhase === 'zipping' ? 'indeterminate' : ''}`}
        style={bulkPhase === 'fetching' ? { width: `${Math.round((bulkDone / bulkTotal) * 100)}%` } : undefined}
      />
    </div>
  </div>
)}
```

Reuse class `.apple-progress`/`.apple-progress-phase`/`.apple-progress-track`/`.apple-progress-fill` yang sudah ada (dipakai juga di fitur progress submit tanda tangan) — tidak ada CSS baru. Fase `fetching` pakai persentase asli (total sudah diketahui di awal dari `bulkTotal`), fase `zipping` pakai `indeterminate` (durasi kompresi tidak bisa diprediksi presisi, mirip pola `GenerateBulk.tsx` yang juga pakai fase terpisah untuk compressing).

---

## 4. Hal yang Tidak Berubah

- `downloadPdf`, `resetSigner`, `copyLink`, search (`filteredSigners`/`matchesSignerQuery`), statistik kartu — tidak berubah.
- Action admin lain di `api/pakta-admin.ts` (`list_events`, `create_event`, `update_event`, `get_event`, `import_signers`, `delete_event`, `get_signed_url`, `get_template_upload_url`) — tidak berubah.
- `src/lib/download.ts` (`buildZip`, `downloadBlob`) — dipakai apa adanya, tidak dimodifikasi.
- `GenerateBulk.tsx` dan alur generate sertifikat — tidak disentuh, hanya dijadikan referensi pola.
- Halaman publik `PaktaSignPage.tsx` — tidak disentuh.

---

## 5. Verifikasi

- Buka dashboard acara dengan sebagian peserta berstatus "sudah" → tombol "Unduh Semua (ZIP)" aktif. Acara tanpa peserta "sudah" sama sekali → tombol disabled.
- Klik tombol → progress bar muncul, angka "Mengunduh X dari Y" naik sampai Y, nama berjalan berganti-ganti, lalu berubah ke "Mengemas ZIP…" (indeterminate), lalu file ZIP terunduh otomatis.
- Buka ZIP hasil unduhan → berisi N file PDF (N = jumlah peserta berstatus "sudah"), masing-masing bernama `pakta-<nama>.pdf`, isinya identik dengan hasil unduhan satuan `downloadPdf` untuk peserta yang sama.
- Simulasikan satu signed URL gagal dibuat (mock backend mengembalikan error) → seluruh proses berhenti, `alert()` muncul, tidak ada file terunduh, tombol kembali aktif (`bulkPhase` balik ke `'idle'`).
- Cek jaringan (network tab) saat proses berjalan → hanya SATU permintaan ke `/api/pakta-admin` dengan action `get_bulk_signed_urls` (bukan N permintaan terpisah), diikuti permintaan langsung ke Supabase Storage untuk tiap file (maksimal 5 permintaan storage berjalan bersamaan di satu waktu).
- Build + test existing tidak regresi (`npm run build`, `npx vitest run`).
