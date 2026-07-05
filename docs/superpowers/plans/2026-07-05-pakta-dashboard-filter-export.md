# Filter Status + Export Excel/PDF Dashboard Pakta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan filter status (Semua/Sudah/Belum) dan tombol export Excel/PDF ke dashboard admin Pakta (`PaktaDashboard.tsx`), tanpa mengubah fungsi/data production yang sudah ada.

**Architecture:** Logika filter status+pencarian diekstrak jadi fungsi murni `filterSigners` di `src/lib/signerFilter.ts` (supaya bisa di-unit-test tanpa perlu me-render komponen React). Export Excel pakai helper baru `buildXlsx` di `src/lib/download.ts` (sejajar `buildZip` yang sudah ada). Export PDF pakai file baru `src/lib/paktaListPdf.ts` (terpisah dari `pdfRenderer.ts` yang khusus render dokumen per-orang). `PaktaDashboard.tsx` hanya memanggil ketiga fungsi ini dan menambah dua tombol + satu segmented control di UI yang sudah ada.

**Tech Stack:** React 18 + TypeScript, Vitest (`jsdom`), `xlsx` (SheetJS) `^0.18.5`, `pdf-lib` `^1.17.1` — semua sudah jadi dependency, tidak ada instalasi baru.

**Spec:** `docs/superpowers/specs/2026-07-05-pakta-dashboard-filter-export-design.md`

**Catatan revisi kecil dari spec:** Spec awal menaruh logika gabungan filter status+pencarian langsung inline di `PaktaDashboard.tsx` (bagian 2.2). Plan ini mengekstraknya jadi fungsi murni `filterSigners` di `src/lib/signerFilter.ts` (mengikuti pola `matchesSignerQuery` yang sudah ada di file yang sama) — **perilaku identik**, hanya beda lokasi kode, supaya bisa di-unit-test langsung tanpa mocking `usePaktaAdmin`/`QRCode` (tidak ada test file untuk `PaktaDashboard.tsx` di codebase ini, dan komponen itu tidak cocok dites langsung).

---

### Task 1: Fungsi murni `filterSigners` di `src/lib/signerFilter.ts`

**Files:**
- Modify: `src/lib/signerFilter.ts`
- Test: `tests/signerFilter.test.ts`

Isi `src/lib/signerFilter.ts` saat ini (jangan diubah, hanya ditambah di bawahnya):

```ts
export function matchesSignerQuery(nama: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return nama.toLowerCase().includes(q);
}
```

- [ ] **Step 1: Tulis test yang gagal (fungsi belum ada)**

Tambahkan di akhir `tests/signerFilter.test.ts` (setelah `describe('matchesSignerQuery', ...)` yang sudah ada, jangan hapus apa pun yang ada):

```ts
import { filterSigners } from '../src/lib/signerFilter';

interface TestSigner {
  id: string;
  nama: string;
  nip: string;
  status: 'sudah' | 'belum';
}

const SIGNERS: TestSigner[] = [
  { id: '1', nama: 'Ahmad Budiman', nip: '111', status: 'sudah' },
  { id: '2', nama: 'Siti Aminah', nip: '222', status: 'belum' },
  { id: '3', nama: 'Budi Santoso', nip: '333', status: 'belum' },
];

describe('filterSigners', () => {
  it('mengembalikan semua signer saat statusFilter "semua" dan query kosong', () => {
    expect(filterSigners(SIGNERS, 'semua', '')).toEqual(SIGNERS);
  });

  it('memfilter hanya status "sudah"', () => {
    const result = filterSigners(SIGNERS, 'sudah', '');
    expect(result.map(s => s.id)).toEqual(['1']);
  });

  it('memfilter hanya status "belum"', () => {
    const result = filterSigners(SIGNERS, 'belum', '');
    expect(result.map(s => s.id)).toEqual(['2', '3']);
  });

  it('menggabungkan filter status DAN pencarian nama (AND, bukan OR)', () => {
    const result = filterSigners(SIGNERS, 'belum', 'budi');
    expect(result.map(s => s.id)).toEqual(['3']);
  });

  it('mengembalikan array kosong kalau filter status dan pencarian tidak ada yang cocok', () => {
    const result = filterSigners(SIGNERS, 'sudah', 'siti');
    expect(result).toEqual([]);
  });

  it('mencocokkan pencarian terhadap NIP juga, bukan hanya nama', () => {
    const result = filterSigners(SIGNERS, 'semua', '222');
    expect(result.map(s => s.id)).toEqual(['2']);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/signerFilter.test.ts`
Expected: FAIL — `filterSigners is not a function` atau error import serupa (fungsi belum diekspor dari `src/lib/signerFilter.ts`).

- [ ] **Step 3: Implementasikan `filterSigners`**

Tambahkan di akhir `src/lib/signerFilter.ts` (setelah `matchesSignerQuery`, tidak mengubah fungsi yang sudah ada):

```ts
export type StatusFilter = 'semua' | 'sudah' | 'belum';

interface FilterableSigner {
  nama: string;
  nip: string;
  status: string;
}

export function filterSigners<T extends FilterableSigner>(
  signers: T[],
  statusFilter: StatusFilter,
  query: string,
): T[] {
  return signers.filter(s =>
    (statusFilter === 'semua' || s.status === statusFilter) &&
    (matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query))
  );
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/signerFilter.test.ts`
Expected: PASS — semua 11 test (5 lama + 6 baru) lulus.

- [ ] **Step 5: Commit**

```bash
git add src/lib/signerFilter.ts tests/signerFilter.test.ts
git commit -m "feat(pakta): tambah filterSigners (status + pencarian) di signerFilter.ts"
```

---

### Task 2: Segmented control filter status di `PaktaDashboard.tsx`

**Files:**
- Modify: `src/components/pakta-admin/PaktaDashboard.tsx`

Tidak ada test otomatis untuk task ini — `PaktaDashboard.tsx` tidak punya test file di codebase ini (butuh mocking `usePaktaAdmin`, `QRCode.toDataURL`, dll., di luar scope perubahan ini). Verifikasi dilakukan manual di Task 6 sesuai bagian 7 spec, plus `npm run build` untuk cek type-check lulus.

- [ ] **Step 1: Ganti import `matchesSignerQuery` jadi `filterSigners`**

Baris 6 saat ini:
```ts
import { matchesSignerQuery } from '../../lib/signerFilter';
```

Ganti jadi:
```ts
import { filterSigners, type StatusFilter } from '../../lib/signerFilter';
```

- [ ] **Step 2: Tambah state `statusFilter`**

Baris 44 saat ini:
```ts
  const [query, setQuery] = useState('');
```

Tambahkan tepat setelahnya:
```ts
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');
```

- [ ] **Step 3: Ganti komputasi `filteredSigners`**

Baris 143-145 saat ini:
```ts
  const filteredSigners = signers.filter(s =>
    matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query)
  );
```

Ganti jadi:
```ts
  const filteredSigners = filterSigners(signers, statusFilter, query);
```

- [ ] **Step 4: Tambah UI segmented control + perbaiki pesan kosong**

Baris 264-276 saat ini:
```tsx
            <>
              <input
                type="text"
                className="apple-input"
                placeholder="Cari nama atau NIP…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              {filteredSigners.length === 0 ? (
                <p className="apple-empty">Tidak ada peserta yang cocok dengan pencarian.</p>
              ) : (
```

Ganti jadi:
```tsx
            <>
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
              <input
                type="text"
                className="apple-input"
                placeholder="Cari nama atau NIP…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              {filteredSigners.length === 0 ? (
                <p className="apple-empty">
                  {query.trim() === ''
                    ? 'Tidak ada peserta dengan status ini.'
                    : 'Tidak ada peserta yang cocok dengan pencarian.'}
                </p>
              ) : (
```

- [ ] **Step 5: Build untuk cek type-check + jalankan seluruh test suite (regresi)**

Run: `npm run build`
Expected: Build sukses, tidak ada TypeScript error (khususnya `StatusFilter` dan `filterSigners` ter-resolve dengan benar).

Run: `npm run test`
Expected: Semua test lulus (termasuk `signerFilter.test.ts` dari Task 1), tidak ada regresi di test lain.

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx
git commit -m "feat(pakta): tambah filter status Semua/Sudah/Belum di dashboard admin"
```

---

### Task 3: Helper `buildXlsx` di `src/lib/download.ts`

**Files:**
- Modify: `src/lib/download.ts`
- Test: Create `tests/download.test.ts`

Isi `src/lib/download.ts` saat ini (jangan diubah, hanya ditambah):

```ts
import JSZip from 'jszip';

export function downloadBlob(bytes: Uint8Array, filename: string, type = 'application/pdf'): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bundle multiple PDFs into a single ZIP and return its bytes. */
export async function buildZip(files: { name: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.bytes);
  return zip.generateAsync({ type: 'uint8array' });
}
```

- [ ] **Step 1: Tulis test yang gagal**

Buat file baru `tests/download.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildXlsx } from '../src/lib/download';

describe('buildXlsx', () => {
  it('menghasilkan file xlsx dengan baris dan kolom yang sesuai', () => {
    const rows = [
      { Nama: 'Ahmad Budiman', NIP: '111', Status: 'Sudah' },
      { Nama: 'Siti Aminah', NIP: '222', Status: 'Belum' },
    ];
    const bytes = buildXlsx(rows, 'Pakta');
    const wb = XLSX.read(bytes);
    expect(wb.SheetNames).toEqual(['Pakta']);
    const parsed = XLSX.utils.sheet_to_json(wb.Sheets['Pakta']);
    expect(parsed).toEqual(rows);
  });

  it('menghasilkan sheet tanpa baris data kalau rows kosong', () => {
    const bytes = buildXlsx([], 'Pakta');
    const wb = XLSX.read(bytes);
    const parsed = XLSX.utils.sheet_to_json(wb.Sheets['Pakta']);
    expect(parsed).toEqual([]);
  });

  it('memakai nama sheet default "Sheet1" kalau tidak diberikan', () => {
    const bytes = buildXlsx([{ A: '1' }]);
    const wb = XLSX.read(bytes);
    expect(wb.SheetNames).toEqual(['Sheet1']);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/download.test.ts`
Expected: FAIL — `buildXlsx is not a function` (belum diekspor dari `src/lib/download.ts`).

- [ ] **Step 3: Implementasikan `buildXlsx`**

Tambahkan di `src/lib/download.ts`, import di baris paling atas dan fungsi baru setelah `buildZip`:

```ts
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

// ... downloadBlob dan buildZip tetap sama persis, tidak diubah ...

/** Bangun file .xlsx dari array objek baris (header = key objek pertama). */
export function buildXlsx(rows: Record<string, string>[], sheetName = 'Sheet1'): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Uint8Array;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/download.test.ts`
Expected: PASS — semua 3 test lulus.

- [ ] **Step 5: Jalankan seluruh test suite (regresi)**

Run: `npm run test`
Expected: Semua test lulus, tidak ada regresi (khususnya test lain yang mengimpor dari `src/lib/download.ts`, kalau ada).

- [ ] **Step 6: Commit**

```bash
git add src/lib/download.ts tests/download.test.ts
git commit -m "feat(pakta): tambah buildXlsx di download.ts untuk export Excel"
```

---

### Task 4: File baru `src/lib/paktaListPdf.ts` (export PDF rekap)

**Files:**
- Create: `src/lib/paktaListPdf.ts`
- Test: Create `tests/paktaListPdf.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Buat file baru `tests/paktaListPdf.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { buildPaktaListPdf, type PaktaListRow } from '../src/lib/paktaListPdf';

/** Decode page content stream(s) to string (pola sama seperti tests/pdfRenderer.test.ts). */
async function pageContentText(doc: PDFDocument, pageIndex = 0): Promise<string> {
  const page = doc.getPage(pageIndex);
  const contentsRef = page.node.get(PDFName.of('Contents'));
  const parts: string[] = [];

  const decode = (ref: PDFRef) => {
    const obj = doc.context.lookup(ref);
    if (obj instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(obj).decode();
      parts.push(new TextDecoder().decode(decoded));
    }
  };

  if (contentsRef instanceof PDFRef) {
    decode(contentsRef);
  } else if (contentsRef instanceof PDFArray) {
    for (const item of contentsRef.asArray()) {
      if (item instanceof PDFRef) decode(item);
    }
  }
  return parts.join('\n');
}

/** Hitung jumlah token operator PDF tertentu (mis. 'Tj' untuk teks) di content stream. */
function countTokens(content: string, token: string): number {
  return content.split(/\s+/).filter(t => t === token).length;
}

function makeRows(n: number): PaktaListRow[] {
  return Array.from({ length: n }, (_, i) => ({
    nama: `Pegawai ${i + 1}`,
    nip: `NIP${i + 1}`,
    jabatan: 'Staf',
    status: i % 2 === 0 ? 'Sudah' : 'Belum',
    waktuTtd: i % 2 === 0 ? '01/01/2026 10.00.00' : '—',
  }));
}

describe('buildPaktaListPdf', () => {
  it('menghasilkan satu halaman A4 landscape untuk data sedikit', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 1, 2, makeRows(2));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(842);
    expect(Math.round(page.getHeight())).toBe(595);
  });

  it('menggambar header (judul+tanggal+ringkasan+5 kolom) dan satu baris teks per kolom per baris data', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 1, 2, makeRows(2));
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc, 0);
    // header: judul + tanggal + ringkasan + 5 label kolom = 8 Tj
    // 2 baris data x 5 kolom = 10 Tj
    expect(countTokens(content, 'Tj')).toBe(18);
  });

  it('membuat halaman baru (page break) kalau baris melebihi satu halaman', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 20, 40, makeRows(40));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('mengulang header kolom di halaman kedua saat page break terjadi', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 20, 40, makeRows(40));
    const doc = await PDFDocument.load(bytes);
    const contentPage2 = await pageContentText(doc, 1);
    // minimal 5 Tj untuk label kolom yang diulang di halaman baru
    expect(countTokens(contentPage2, 'Tj')).toBeGreaterThanOrEqual(5);
  });

  it('bytes yang dihasilkan tidak kosong', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 1, 2, makeRows(2));
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/paktaListPdf.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/paktaListPdf'` (file belum ada).

- [ ] **Step 3: Implementasikan `src/lib/paktaListPdf.ts`**

Buat file baru:

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface PaktaListRow {
  nama: string;
  nip: string;
  jabatan: string;
  status: string;
  waktuTtd: string;
}

const PAGE_W = 841.89; // A4 landscape (pt)
const PAGE_H = 595.28;
const MARGIN = 40;
const ROW_HEIGHT = 16;

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

/** Bangun laporan PDF rekap tabel signer (A4 landscape, auto page-break). */
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
    y -= ROW_HEIGHT;
  }

  drawHeader();

  let pageNum = 1;

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = PAGE_H - MARGIN;
      drawTableHeader(page, fontBold, y);
      y -= ROW_HEIGHT;
    }
    let x = MARGIN;
    const values = [row.nama, row.nip, row.jabatan, row.status, row.waktuTtd];
    values.forEach((val, i) => {
      page.drawText(val, { x, y, size: 9, font });
      x += COLS[i].width;
    });
    y -= ROW_HEIGHT;
  }

  if (pageNum > 1) {
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Halaman ${i + 1} / ${pages.length}`, {
        x: PAGE_W - MARGIN - 80,
        y: MARGIN / 2,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    });
  }

  return doc.save();
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/paktaListPdf.test.ts`
Expected: PASS — semua 5 test lulus.

- [ ] **Step 5: Jalankan seluruh test suite (regresi)**

Run: `npm run test`
Expected: Semua test lulus, tidak ada regresi.

- [ ] **Step 6: Commit**

```bash
git add src/lib/paktaListPdf.ts tests/paktaListPdf.test.ts
git commit -m "feat(pakta): tambah paktaListPdf.ts untuk export PDF rekap tabel signer"
```

---

### Task 5: Wire tombol "Unduh Excel" & "Unduh PDF" di `PaktaDashboard.tsx`

**Files:**
- Modify: `src/components/pakta-admin/PaktaDashboard.tsx`

Tidak ada test otomatis untuk task ini (alasan sama seperti Task 2 — `PaktaDashboard.tsx` tidak punya test harness). `buildXlsx` dan `buildPaktaListPdf` yang dipanggil di sini sudah lulus unit test di Task 3 dan 4; task ini murni pengkabelan (wiring) ke tombol UI. Verifikasi manual di Task 6.

- [ ] **Step 1: Tambah import**

Baris 7 saat ini:
```ts
import { buildZip, downloadBlob } from '../../lib/download';
```

Ganti jadi:
```ts
import { buildXlsx, buildZip, downloadBlob } from '../../lib/download';
import { buildPaktaListPdf } from '../../lib/paktaListPdf';
```

- [ ] **Step 2: Tambah fungsi `exportExcel` dan `exportPdf`**

Cari fungsi `downloadAllPdfs` (hasil Task 2 mengubah nomor baris, jadi cari berdasarkan teks, bukan nomor baris pasti) — tambahkan `exportExcel` dan `exportPdf` tepat setelah penutup `}` fungsi `downloadAllPdfs`, sebelum `return (`:

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

- [ ] **Step 3: Tambah dua tombol di toolbar aksi**

Cari blok tombol aksi (berisi "Impor Pegawai", "Refresh", "Unduh Semua (ZIP)"):

```tsx
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setShowImport(true)}>
              Impor Pegawai
            </button>
            <button className="sg-btn sg-btn-outline" onClick={load}>
              Refresh
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={sudahCount === 0 || bulkPhase !== 'idle'}
              onClick={downloadAllPdfs}
            >
              {bulkPhase === 'idle' ? 'Unduh Semua (ZIP)' : '…'}
            </button>
          </div>
```

Tambahkan dua tombol baru tepat sebelum `</div>` penutup blok ini:

```tsx
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setShowImport(true)}>
              Impor Pegawai
            </button>
            <button className="sg-btn sg-btn-outline" onClick={load}>
              Refresh
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={sudahCount === 0 || bulkPhase !== 'idle'}
              onClick={downloadAllPdfs}
            >
              {bulkPhase === 'idle' ? 'Unduh Semua (ZIP)' : '…'}
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={filteredSigners.length === 0}
              onClick={exportExcel}
            >
              Unduh Excel
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={filteredSigners.length === 0}
              onClick={exportPdf}
            >
              Unduh PDF
            </button>
          </div>
```

- [ ] **Step 4: Build + jalankan seluruh test suite**

Run: `npm run build`
Expected: Build sukses, tidak ada TypeScript error.

Run: `npm run test`
Expected: Semua test lulus (22+ file test, termasuk 3 file baru dari Task 1/3/4), tidak ada regresi.

- [ ] **Step 5: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx
git commit -m "feat(pakta): tambah tombol Unduh Excel dan Unduh PDF di dashboard admin"
```

---

### Task 6: Verifikasi manual end-to-end (browser)

**Files:** Tidak ada file yang diubah — task ini murni verifikasi, sesuai bagian 7 spec dan Rule 4 ("Never mark a task complete without proving it works").

- [ ] **Step 1: Jalankan dev server dan buka dashboard event Pakta yang punya campuran signer "sudah"/"belum"**

Run: `npm run dev`, buka halaman admin Pakta → pilih satu event dengan data campuran.

Expected: 3 tombol filter (Semua/Sudah/Belum) muncul di atas search box, default "Semua" aktif (highlight), tabel tampil sama seperti sebelum perubahan (regresi visual nihil).

- [ ] **Step 2: Uji filter status + kombinasi dengan pencarian**

Klik "Sudah" → tabel hanya tampilkan signer status sudah.
Klik "Belum" → hanya yang belum.
Klik "Semua" → kembali ke semua.
Kombinasikan filter "Belum" + ketik nama di search box → hasil gabungan (AND) sesuai ekspektasi.
Filter ke kombinasi yang menghasilkan 0 baris → pesan kosong yang sesuai muncul ("Tidak ada peserta dengan status ini." kalau search kosong, atau pesan pencarian kalau search terisi).

Expected: Semua kombinasi berperilaku seperti dijelaskan di atas.

- [ ] **Step 3: Uji export Excel**

Klik "Unduh Excel" pada beberapa kondisi filter berbeda (mis. "Semua" tanpa search, lalu "Belum" + search nama tertentu).

Expected: File `.xlsx` terunduh dengan nama `Pakta - <nama event>.xlsx`. Buka di Excel/Google Sheets/LibreOffice — kolom Nama/NIP/Jabatan/Status/Waktu TTD ada, jumlah baris cocok persis dengan jumlah baris yang tampil di tabel saat tombol diklik.

- [ ] **Step 4: Uji export PDF (termasuk page-break)**

Klik "Unduh PDF" pada event dengan sedikit peserta (<20) → verifikasi 1 halaman, judul event + tanggal + ringkasan sudah/belum + tabel data muncul, tidak ada nomor halaman.

Kalau ada event dengan peserta banyak (>30) tersedia, uji juga di sana → verifikasi page-break terjadi, header kolom terulang di halaman baru, nomor halaman ("Halaman X / Y") muncul di tiap halaman.

Expected: Sesuai deskripsi di atas, data di PDF cocok dengan `filteredSigners` yang tampil saat tombol diklik.

- [ ] **Step 5: Regresi fitur existing (WAJIB — proyek ini sudah production)**

Verifikasi manual, di event yang sama:
- Unduh PDF satuan (tombol "PDF" per baris) → berhasil, isi PDF benar.
- Reset signer (tombol "Reset") → berhasil, status berubah ke "belum", PDF terhapus.
- Unduh Semua (ZIP) → berhasil, isi ZIP sesuai signer berstatus "sudah".
- Edit slug (tombol "Ubah") → berhasil simpan, QR code ter-update.
- Impor Pegawai → modal muncul, impor berhasil.

Expected: Semua fitur existing ini berperilaku identik dengan sebelum perubahan — tidak ada regresi.

- [ ] **Step 6: Final check — build, test, lint**

Run: `npm run build`
Expected: PASS, tanpa error.

Run: `npm run test`
Expected: PASS, semua file test (termasuk 3 file baru: `signerFilter.test.ts` bagian `filterSigners`, `download.test.ts`, `paktaListPdf.test.ts`).

Run: `npm run lint` (kalau ada — per riwayat proyek, saat ini TIDAK ada script `lint` di `package.json`; kalau begitu, laporkan sebagai "tidak ada script lint (pre-existing)", jangan diklaim "lint bersih").

- [ ] **Step 7: Update `docs/agent-handoff.md`**

Ikuti format Handoff di `AGENTS.md` — isi Branch, Task, Status (selesai, build/test PASS, belum commit-push kalau belum diminta push), Files Changed (semua file dari Task 1-5), Commands Run, Validation, Known Issues (kalau ada, mis. "tidak ada script lint"), Next Step (mis. "user review lalu push kalau disetujui").
