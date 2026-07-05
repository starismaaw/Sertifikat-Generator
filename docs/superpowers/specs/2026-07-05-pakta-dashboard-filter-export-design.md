# Spec: Filter Status + Export Excel/PDF di Dashboard Admin Pakta

**Tanggal:** 2026-07-05
**Status:** Approved
**Scope:** `src/components/pakta-admin/PaktaDashboard.tsx`, `src/lib/download.ts` (tambah helper), file baru `src/lib/paktaListPdf.ts`

---

## 1. Latar Belakang

Dashboard admin (`PaktaDashboard.tsx`) sudah punya statistik jumlah "sudah"/"belum" (baris 141-142) dan search box nama/NIP (`filteredSigners`, baris 143-145), tapi:

- Tidak ada cara memfilter tabel berdasarkan status tanda tangan saja (hanya lihat yang "belum", misalnya, untuk ditindaklanjuti).
- Tidak ada cara mengekspor daftar peserta (rekap) ke Excel atau PDF — yang ada hanya unduh dokumen PDF pakta per-orang (`downloadPdf`) atau bundel ZIP semua PDF yang sudah TTD (`downloadAllPdfs`, baris 147-198). Admin butuh rekap data (bukan dokumen TTD) untuk dilaporkan/diarsipkan.

Codebase sudah punya semua yang dibutuhkan tanpa dependency baru:
- CSS pola segmented control `.sg-segmented`/`.sg-segmented-btn` sudah ada, dipakai di `GenerateView.tsx:47-59` untuk tab "Satuan"/"Massal" (CSS: `apple-design.css:2396-2418`).
- Library `xlsx` (`^0.18.5`) dan `pdf-lib` (`^1.17.1`) sudah ada di `package.json`, sudah dipakai di tempat lain (pdf-lib di `src/lib/pdfRenderer.ts` untuk render sertifikat/pakta per-orang).
- `src/lib/download.ts` sudah punya `downloadBlob(bytes, filename, type)` generik — tinggal dipakai ulang dengan MIME type Excel/PDF, tidak perlu fungsi baru untuk trigger unduhan.

---

## 2. Filter status (segmented control)

### 2.1 State baru

Ditambahkan ke blok `useState` yang sudah ada, setelah `const [query, setQuery] = useState('');` (baris 44):

```ts
type StatusFilter = 'semua' | 'sudah' | 'belum';
const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');
```

`type StatusFilter` dideklarasikan di level modul (sejajar dengan `type BulkDownloadPhase`, baris 10), bukan di dalam komponen.

### 2.2 Perluasan `filteredSigners`

Baris 143-145 saat ini:

```ts
const filteredSigners = signers.filter(s =>
  matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query)
);
```

Diubah jadi AND antara filter status dan pencarian yang sudah ada (bukan diganti — logika pencarian existing dipertahankan persis):

```ts
const filteredSigners = signers.filter(s =>
  (statusFilter === 'semua' || s.status === statusFilter) &&
  (matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query))
);
```

Saat `statusFilter === 'semua'` (default), klausa pertama selalu `true` — hasil identik dengan perilaku sekarang. Tidak ada perubahan perilaku default.

### 2.3 UI segmented control

Ditambahkan tepat sebelum input pencarian (sebelum baris 266 `<input type="text" className="apple-input" ...>`), di dalam blok `signers.length === 0 ? ... : (<> ... </>)` yang sudah ada:

```tsx
<div className="sg-segmented" style={{ marginBottom: 12 }}>
  {(['semua', 'sudah', 'belum'] as const).map(f => (
    <button
      key={f}
      type="button"
      className={`sg-segmented-btn ${statusFilter === f ? 'active' : ''}`}
      aria-pressed={statusFilter === f}
      onClick={() => setStatusFilter(f)}
    >
      {f === 'semua' ? 'Semua' : f === 'sudah' ? 'Sudah' : 'Belum'}
    </button>
  ))}
</div>
```

Catatan: dipakai `aria-pressed` (bukan `role="tab"`/`role="tablist"` seperti di `GenerateView.tsx`) karena widget ini adalah filter toggle atas satu daftar, bukan navigasi antar-tab yang menukar konten sepenuhnya — `aria-pressed` lebih tepat secara semantik untuk kasus ini. Class CSS (visual) tetap sama persis, jadi tampilannya identik dengan pola segmented yang sudah ada di aplikasi.

### 2.4 Pesan kosong yang disesuaikan

Baris 274-276 saat ini:

```tsx
{filteredSigners.length === 0 ? (
  <p className="apple-empty">Tidak ada peserta yang cocok dengan pencarian.</p>
) : (
```

Diubah agar pesan tetap akurat ketika filter status aktif tanpa pencarian teks:

```tsx
{filteredSigners.length === 0 ? (
  <p className="apple-empty">
    {query.trim() === ''
      ? 'Tidak ada peserta dengan status ini.'
      : 'Tidak ada peserta yang cocok dengan pencarian.'}
  </p>
) : (
```

---

## 3. Export — cakupan

Export (Excel dan PDF) **selalu mengambil dari `filteredSigners`**, bukan `signers` mentah — WYSIWYG, mengikuti filter status dan pencarian yang sedang aktif di layar saat tombol diklik. Ini konsisten dengan keputusan yang sudah disetujui: kalau admin sedang filter "Belum" + cari nama tertentu, file yang diunduh hanya berisi baris yang tampak di tabel saat itu.

Tombol export **disabled** saat `filteredSigners.length === 0` (data kosong tidak berguna untuk diekspor).

---

## 4. Export Excel (.xlsx)

### 4.1 Helper baru di `src/lib/download.ts`

Ditambahkan setelah `buildZip` (baris 18), import `XLSX` dari `xlsx`:

```ts
import * as XLSX from 'xlsx';

/** Bangun file .xlsx dari array objek baris (header = key objek pertama). */
export function buildXlsx(rows: Record<string, string>[], sheetName = 'Sheet1'): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Uint8Array;
}
```

`type: 'buffer'` dipakai (bukan `type: 'array'`) — ini pola yang didokumentasikan resmi SheetJS untuk hasil `Uint8Array` yang langsung kompatibel dengan `Blob` di browser (lihat demo resmi "Convert Workbook to Blob" di docs.sheetjs.com/docs/demos/local/file), konsisten dengan yang dibutuhkan `downloadBlob`.

Ditempatkan di `download.ts` (bukan file baru) karena fungsinya setara level abstraksi dengan `buildZip` yang sudah ada di situ — sama-sama "bangun bytes file dari data", dipanggil lalu hasilnya dilempar ke `downloadBlob`.

### 4.2 Fungsi & tombol di `PaktaDashboard.tsx`

Ditempatkan setelah `downloadAllPdfs` (setelah baris 198), sebelum `return (` (baris 200) — sejajar level dengan fungsi aksi lain yang butuh akses ke `filteredSigners`.

```ts
function exportExcel() {
  const rows = filteredSigners.map(s => ({
    Nama: s.nama,
    NIP: s.nip,
    Jabatan: s.jabatan,
    Status: s.status === 'sudah' ? 'Sudah' : 'Belum',
    'Waktu TTD': s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '',
  }));
  const bytes = buildXlsx(rows, 'Pakta');
  downloadBlob(
    bytes,
    `Pakta - ${event.nama}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
```

Import tambahan di bagian atas file (baris 7 saat ini `import { buildZip, downloadBlob } from '../../lib/download';`):

```ts
import { buildXlsx, buildZip, downloadBlob } from '../../lib/download';
```

Tombol ditambahkan di baris tombol aksi yang sudah ada (baris 229-243, setelah tombol "Unduh Semua (ZIP)"):

```tsx
<button
  className="sg-btn sg-btn-outline"
  disabled={filteredSigners.length === 0}
  onClick={exportExcel}
>
  Unduh Excel
</button>
```

Kolom persis sama urutan dengan kolom tabel di layar (Nama, NIP, Jabatan, Status, Waktu TTD), tidak termasuk kolom "Unduh" (itu aksi, bukan data). Format status dan waktu TTD identik dengan yang ditampilkan di tabel (baris 296-301), supaya rekap Excel konsisten dengan apa yang admin lihat.

---

## 5. Export PDF (tabel rekap)

### 5.1 File baru `src/lib/paktaListPdf.ts`

Dipisah dari `pdfRenderer.ts` karena `pdfRenderer.ts` khusus untuk render dokumen sertifikat/pakta per-orang (coupling ke `CertEvent`, `Field`, `FieldValues`, canvas-based text measurement) — tujuan berbeda (satu dokumen per orang vs. satu tabel rekap semua orang), tidak ada logika yang bisa dipakai ulang secara langsung selain import `pdf-lib` itu sendiri.

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface PaktaListRow {
  nama: string;
  nip: string;
  jabatan: string;
  status: string;
  waktuTtd: string;
}

const PAGE_W = 841.89; // A4 landscape
const PAGE_H = 595.28;
const MARGIN = 40;
const COLS = [
  { label: 'Nama', width: 180 },
  { label: 'NIP', width: 110 },
  { label: 'Jabatan', width: 220 },
  { label: 'Status', width: 70 },
  { label: 'Waktu TTD', width: 140 },
] as const;

function drawTableHeader(page: PDFPage, font: PDFFont, y: number): void {
  let x = MARGIN;
  for (const col of COLS) {
    page.drawText(col.label, { x, y, size: 10, font, color: rgb(0, 0, 0) });
    x += col.width;
  }
}

export async function buildPaktaListPdf(
  eventNama: string,
  eventTanggal: string,
  sudahCount: number,
  totalCount: number,
  rows: PaktaListRow[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawHeader(): void {
    page.drawText(eventNama, { x: MARGIN, y, size: 14, font: fontBold });
    y -= 18;
    page.drawText(eventTanggal, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 16;
    page.drawText(`Sudah ${sudahCount} / Total ${totalCount} (Belum ${totalCount - sudahCount})`, {
      x: MARGIN, y, size: 10, font,
    });
    y -= 24;
    drawTableHeader(page, fontBold, y);
    y -= 16;
  }

  drawHeader();

  const rowHeight = 16;
  let pageNum = 1;
  const pageNumbers: number[] = [];

  for (const row of rows) {
    if (y < MARGIN + rowHeight) {
      pageNumbers.push(pageNum);
      page = doc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = PAGE_H - MARGIN;
      drawTableHeader(page, fontBold, y);
      y -= 16;
    }
    let x = MARGIN;
    const values = [row.nama, row.nip, row.jabatan, row.status, row.waktuTtd];
    values.forEach((val, i) => {
      page.drawText(val, { x, y, size: 9, font });
      x += COLS[i].width;
    });
    y -= rowHeight;
  }
  pageNumbers.push(pageNum);

  if (pageNum > 1) {
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Halaman ${i + 1} / ${pages.length}`, {
        x: PAGE_W - MARGIN - 80, y: MARGIN / 2, size: 8, font, color: rgb(0.5, 0.5, 0.5),
      });
    });
  }

  return doc.save();
}
```

Catatan desain:
- `StandardFonts.Helvetica`/`HelveticaBold` saja (tanpa `fontkit`/font custom) — nama pegawai berhuruf Latin standar, tidak butuh font kustom yang dipakai `pdfRenderer.ts` untuk sertifikat bergaya. Ini menghindari fetch font tambahan untuk laporan tabel sederhana.
- Lebar kolom (`COLS`) tetap (fixed width, bukan auto-fit dari isi teks) — pola paling sederhana yang cukup untuk data nama/NIP/jabatan pegawai (jarang melebihi ~30 karakter). Tidak ada word-wrap; teks yang lebih panjang dari lebar kolom akan overflow ke kolom berikutnya secara visual — batasan yang diterima untuk versi pertama, bisa ditingkatkan nanti kalau jadi masalah nyata.
- Page break: baris baru dimulai kalau `y` tersisa kurang dari satu `rowHeight` dari margin bawah; halaman baru mengulang header kolom (tapi bukan judul event) supaya tetap terbaca tanpa scroll balik ke halaman 1.
- Nomor halaman ("Halaman X / Y") hanya digambar kalau lebih dari 1 halaman — laporan satu halaman tidak perlu nomor halaman.

### 5.2 Fungsi & tombol di `PaktaDashboard.tsx`

Ditempatkan setelah `exportExcel` (lihat 4.2):

```ts
async function exportPdf() {
  const rows = filteredSigners.map(s => ({
    nama: s.nama,
    nip: s.nip,
    jabatan: s.jabatan,
    status: s.status === 'sudah' ? 'Sudah' : 'Belum',
    waktuTtd: s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '—',
  }));
  const bytes = await buildPaktaListPdf(event.nama, event.tanggal, sudahCount, totalCount, rows);
  downloadBlob(bytes, `Pakta - ${event.nama}.pdf`, 'application/pdf');
}
```

Import tambahan:
```ts
import { buildPaktaListPdf } from '../../lib/paktaListPdf';
```

Tombol (di sebelah tombol "Unduh Excel" dari 4.2):

```tsx
<button
  className="sg-btn sg-btn-outline"
  disabled={filteredSigners.length === 0}
  onClick={exportPdf}
>
  Unduh PDF
</button>
```

`downloadBlob` dipanggil dengan `type` default (`'application/pdf'`, lihat `download.ts:3`) — tidak perlu argumen ke-3 secara eksplisit, tapi ditulis eksplisit di atas untuk konsistensi dengan pemanggilan `downloadBlob` lain di file yang sama (baris 189, 128 pada `exportExcel`) yang semuanya eksplisit menyebut MIME type.

---

## 6. Hal yang Tidak Berubah

- `downloadPdf`, `resetSigner`, `downloadAllPdfs`, `load`, `copyLink`, edit-slug (`startEditSlug`/`saveSlug`) — tidak diubah sama sekali.
- Statistik kartu "sudah/total" dan "belum" (baris 141-142, 215-226) — tidak berubah, tetap dihitung dari `signers` mentah (bukan `filteredSigners`), supaya angka statistik tidak ikut berubah saat admin memfilter tabel.
- API `api/pakta-admin.ts` — tidak ada perubahan endpoint/action. Semua data export diproses murni di client dari data yang sudah dimuat (`event.pakta_signers`), tidak ada request baru ke server.
- `src/lib/pdfRenderer.ts` — tidak disentuh sama sekali (dipakai apa adanya untuk render dokumen pakta per-orang).
- `matchesSignerQuery` di `src/lib/signerFilter.ts` — tidak diubah, hanya dipakai ulang persis seperti sekarang di dalam `filteredSigners` yang diperluas.
- Halaman publik `PaktaSignPage.tsx` dan seluruh alur tanda tangan — tidak disentuh.

---

## 7. Verifikasi

- Buka dashboard event dengan campuran signer "sudah" dan "belum" → 3 tombol filter muncul (Semua/Sudah/Belum), default "Semua" aktif, tabel tampil identik dengan perilaku sebelum perubahan.
- Klik "Sudah" → tabel hanya tampilkan signer berstatus sudah; klik "Belum" → hanya yang belum; klik "Semua" → kembali ke semua. Kombinasikan dengan mengetik di search box → hasil gabungan (AND) sesuai ekspektasi.
- Filter ke kombinasi yang menghasilkan 0 baris → pesan kosong yang sesuai muncul ("Tidak ada peserta dengan status ini." kalau search kosong, atau pesan pencarian kalau search terisi).
- Klik "Unduh Excel" pada beberapa kondisi filter berbeda → file `.xlsx` terunduh, buka di Excel/Sheets, verifikasi kolom (Nama, NIP, Jabatan, Status, Waktu TTD) dan jumlah baris cocok persis dengan `filteredSigners` yang tampil saat tombol diklik.
- Klik "Unduh PDF" → file `.pdf` terunduh, buka, verifikasi judul event + ringkasan sudah/belum + tabel data cocok dengan `filteredSigners` saat itu. Uji dengan event yang punya banyak signer (>30) untuk memverifikasi page-break dan nomor halaman muncul dengan benar dan header kolom terulang di tiap halaman.
- Tombol "Unduh Excel"/"Unduh PDF" disabled saat hasil filter kosong.
- Pastikan `downloadPdf` (unduh PDF satuan), `resetSigner`, `downloadAllPdfs` (ZIP), statistik kartu, dan edit-slug tetap berfungsi identik seperti sebelum perubahan (regresi manual + `npm run build`, `npm run test`).
