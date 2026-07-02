# Unduh Massal (ZIP) Dashboard Admin Pakta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah tombol "Unduh Semua (ZIP)" di dashboard admin pakta yang mengunduh semua PDF peserta berstatus "sudah" sebagai satu file ZIP, dengan progress bar dan tanpa membanjiri Vercel/Supabase untuk acara berskala besar (~150 peserta).

**Architecture:** Backend action baru `get_bulk_signed_urls` yang membuat SEMUA signed URL dalam satu invocation serverless (bukan N panggilan terpisah). Frontend memanggil action itu sekali, lalu mengambil byte tiap PDF dengan worker pool concurrency-terbatas (5 sekaligus), menampilkan progress bertahap (reuse `.apple-progress` yang sudah ada), lalu membundel dengan `buildZip`/`downloadBlob` yang sudah ada di `src/lib/download.ts`.

**Tech Stack:** Vercel serverless function (TypeScript), React (TSX), JSZip (via `buildZip` yang sudah ada), Vitest untuk TDD backend (pola mocking Supabase yang sudah ada di `tests/paktaAdmin.test.ts`).

---

### Task 1: Backend — action `get_bulk_signed_urls`

**Files:**
- Modify: `api/pakta-admin.ts`
- Test: `tests/paktaAdmin.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan test berikut di `tests/paktaAdmin.test.ts`, setelah blok `it('reset_signer menolak bila id tidak ada', ...)`, sebelum penutup `});` dari `describe('pakta-admin handler', ...)`:

```typescript
  // WHY: unduh massal butuh semua signed URL dalam SATU panggilan backend
  // (bukan N panggilan terpisah) supaya tidak membanjiri Vercel untuk acara
  // besar (skala ~150 peserta).
  it('get_bulk_signed_urls mengembalikan signed URL untuk semua path dalam satu panggilan', async () => {
    const createSignedUrlMock = vi.fn()
      .mockResolvedValueOnce({ data: { signedUrl: 'https://storage.test/s1.pdf?token=aaa' }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://storage.test/s2.pdf?token=bbb' }, error: null });
    const storageFromMock = vi.fn().mockReturnValue({ createSignedUrl: createSignedUrlMock });

    createClientMock.mockReturnValue({ from: fromAdminMock, storage: { from: storageFromMock } });

    const res = mockRes();
    await handler(mockReq({ action: 'get_bulk_signed_urls', paths: ['ev1/s1.pdf', 'ev1/s2.pdf'] }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.urls).toEqual({
      'ev1/s1.pdf': 'https://storage.test/s1.pdf?token=aaa',
      'ev1/s2.pdf': 'https://storage.test/s2.pdf?token=bbb',
    });
    expect(storageFromMock).toHaveBeenCalledWith('pakta-documents');
    expect(createSignedUrlMock).toHaveBeenCalledTimes(2);
  });

  // WHY: kalau salah satu path gagal dibuatkan signed URL, jangan kembalikan
  // hasil parsial yang membingungkan — gagalkan seluruh request.
  it('get_bulk_signed_urls mengembalikan 500 kalau salah satu path gagal', async () => {
    const createSignedUrlMock = vi.fn()
      .mockResolvedValueOnce({ data: { signedUrl: 'https://storage.test/s1.pdf?token=aaa' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'File tidak ditemukan' } });
    const storageFromMock = vi.fn().mockReturnValue({ createSignedUrl: createSignedUrlMock });

    createClientMock.mockReturnValue({ from: fromAdminMock, storage: { from: storageFromMock } });

    const res = mockRes();
    await handler(mockReq({ action: 'get_bulk_signed_urls', paths: ['ev1/s1.pdf', 'ev1/s2.pdf'] }), res);

    expect(res.statusCode).toBe(500);
  });

  // WHY: paths kosong/tidak ada berarti tidak ada yang perlu diunduh —
  // tolak sebelum menyentuh Supabase.
  it('get_bulk_signed_urls menolak bila paths kosong', async () => {
    fromAdminMock.mockReturnValue({});
    const res = mockRes();
    await handler(mockReq({ action: 'get_bulk_signed_urls', paths: [] }), res);
    expect(res.statusCode).toBe(400);
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/paktaAdmin.test.ts -t "get_bulk_signed_urls"`
Expected: FAIL — 3 test gagal dengan `res.statusCode` bernilai `400`, pesan `Action tidak dikenal: get_bulk_signed_urls`, karena case belum ada di `api/pakta-admin.ts`.

- [ ] **Step 3: Tambah case `get_bulk_signed_urls` di `api/pakta-admin.ts`**

Tambahkan case baru setelah case `get_signed_url` (baris 158-166) dan sebelum case `get_template_upload_url` (baris 168):

```typescript
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

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run tests/paktaAdmin.test.ts`
Expected: PASS — semua test di file ini lolos, termasuk 3 test baru.

- [ ] **Step 5: Jalankan full suite**

Run: `npx vitest run`
Expected: PASS — 86 + 3 = 89 test lolos (86 baseline sebelum plan ini + 3 baru).

- [ ] **Step 6: Commit**

```bash
git add api/pakta-admin.ts tests/paktaAdmin.test.ts
git commit -m "feat(pakta-admin): tambah action get_bulk_signed_urls untuk unduh massal"
```

---

### Task 2: Frontend — tombol dan alur unduh massal

**Files:**
- Modify: `src/components/pakta-admin/PaktaDashboard.tsx`

Tidak ada test otomatis untuk task ini — codebase ini belum punya precedent test komponen React permanen. Verifikasi: build clean + full suite existing tidak regresi (Task 3 di plan ini melakukan verifikasi perilaku manual).

- [ ] **Step 1: Tambah import `buildZip`/`downloadBlob` dan tipe `BulkDownloadPhase`**

Ubah bagian atas file dari:

```typescript
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';
import { matchesSignerQuery } from '../../lib/signerFilter';

interface Signer {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  status: 'belum' | 'sudah';
  signed_at: string | null;
  pdf_path: string | null;
}
```

menjadi:

```typescript
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';
import { matchesSignerQuery } from '../../lib/signerFilter';
import { buildZip, downloadBlob } from '../../lib/download';

type BulkDownloadPhase = 'idle' | 'fetching' | 'zipping';
const BULK_CONCURRENCY = 5;

interface Signer {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  status: 'belum' | 'sudah';
  signed_at: string | null;
  pdf_path: string | null;
}
```

- [ ] **Step 2: Tambah state bulk download**

Ubah blok state di awal komponen dari:

```typescript
  const { callAdmin } = usePaktaAdmin();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
```

menjadi:

```typescript
  const { callAdmin } = usePaktaAdmin();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [bulkPhase, setBulkPhase] = useState<BulkDownloadPhase>('idle');
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrentName, setBulkCurrentName] = useState('');
```

- [ ] **Step 3: Tambah fungsi `downloadAllPdfs`**

Ditempatkan SETELAH `const filteredSigners = ...` dan SEBELUM `return (`. Ubah:

```typescript
  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;
  const filteredSigners = signers.filter(s =>
    matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query)
  );

  return (
```

menjadi:

```typescript
  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;
  const filteredSigners = signers.filter(s =>
    matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query)
  );

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

  return (
```

- [ ] **Step 4: Tambah tombol dan tampilan progress**

Ubah blok "Tombol aksi" dari:

```tsx
          {/* Tombol aksi */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setShowImport(true)}>
              Impor Pegawai
            </button>
            <button className="sg-btn sg-btn-outline" onClick={load}>
              Refresh
            </button>
          </div>
```

menjadi:

```tsx
          {/* Tombol aksi */}
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

- [ ] **Step 5: Build & jalankan test suite penuh**

Run: `npm run build && npx vitest run`
Expected: build 0 error; 89/89 test lolos (tidak ada test baru dari task ini, sesuai catatan Tech Stack).

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx
git commit -m "feat(pakta-admin): tambah unduh massal ZIP di dashboard"
```

---

### Task 3: Verifikasi manual (unduh massal)

**Files:** tidak ada file yang diubah — task ini murni verifikasi, dilakukan controller.

Sesi-sesi sebelumnya (fitur pencarian nama, progress submit, reset+search dashboard) memakai pola yang sama: render test `@testing-library/react` sementara yang di-mock, dijalankan sekali oleh controller, lalu dihapus (tidak masuk commit manapun). Task ini memakai pendekatan yang sama, ditambah verifikasi khusus bahwa hanya SATU panggilan `get_bulk_signed_urls` terjadi (bukan N panggilan terpisah) — ini poin utama yang memotivasi desain ini.

- [ ] **Step 1: Tulis render test sementara (TIDAK dikomit, dihapus setelah dipakai)**

Buat file sementara `tests/zzz-manual-verify-bulk-download.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaktaDashboard } from '../src/components/pakta-admin/PaktaDashboard';

const callAdminMock = vi.fn();

vi.mock('../src/contexts/PaktaAdminContext', () => ({
  usePaktaAdmin: () => ({ callAdmin: callAdminMock }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,stub') },
}));

vi.mock('../src/components/pakta-admin/ImportSignersModal', () => ({
  ImportSignersModal: () => null,
}));

const baseEvent = {
  id: 'ev1',
  nama: 'Pakta Uji Coba',
  tanggal: '2026-07-02',
  status: 'aktif' as const,
  pakta_signers: [
    { id: 's1', nama: 'Ahmad Budiman', nip: '198501012010011001', jabatan: 'Staf', status: 'sudah' as const, signed_at: '2026-07-01T00:00:00Z', pdf_path: 'ev1/s1.pdf' },
    { id: 's2', nama: 'Siti Aminah', nip: '198502022010011002', jabatan: 'Staf', status: 'sudah' as const, signed_at: '2026-07-01T00:00:00Z', pdf_path: 'ev1/s2.pdf' },
    { id: 's3', nama: 'Budi Santoso', nip: '198503032010011003', jabatan: 'Staf', status: 'belum' as const, signed_at: null, pdf_path: null },
  ],
};

global.fetch = vi.fn(async (url: string) => {
  if (typeof url === 'string' && url.includes('/ev1/s1.pdf')) {
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Response;
  }
  if (typeof url === 'string' && url.includes('/ev1/s2.pdf')) {
    return { ok: true, arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer } as Response;
  }
  throw new Error(`unexpected fetch ${url}`);
}) as unknown as typeof fetch;

// jsdom tidak mengimplementasikan createObjectURL/revokeObjectURL — stub keduanya
// supaya downloadBlob() di src/lib/download.ts tidak melempar error.
URL.createObjectURL = URL.createObjectURL ?? (() => '');
URL.revokeObjectURL = URL.revokeObjectURL ?? (() => {});

describe('PaktaDashboard unduh massal (manual verification, NOT part of plan test suite - delete after use)', () => {
  it('memanggil get_bulk_signed_urls SATU kali (bukan per-signer), lalu mengunduh ZIP', async () => {
    let bulkCallCount = 0;
    callAdminMock.mockImplementation(async (action: string, args: any) => {
      if (action === 'get_event') return { event: baseEvent };
      if (action === 'get_bulk_signed_urls') {
        bulkCallCount++;
        expect(args.paths).toEqual(['ev1/s1.pdf', 'ev1/s2.pdf']); // hanya yang status "sudah"
        return { urls: { 'ev1/s1.pdf': 'https://storage.test/ev1/s1.pdf?x', 'ev1/s2.pdf': 'https://storage.test/ev1/s2.pdf?x' } };
      }
      throw new Error(`unexpected action ${action}`);
    });

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stub');

    render(<PaktaDashboard eventId="ev1" />);
    await screen.findByText('Ahmad Budiman');

    const button = screen.getByText('Unduh Semua (ZIP)');
    fireEvent.click(button);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    expect(bulkCallCount).toBe(1); // SATU panggilan, bukan per-signer
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/zip');
  });

  it('tombol disabled kalau tidak ada peserta berstatus sudah', async () => {
    callAdminMock.mockImplementation(async (action: string) => {
      if (action === 'get_event') return {
        event: { ...baseEvent, pakta_signers: baseEvent.pakta_signers.map(s => ({ ...s, status: 'belum' as const, pdf_path: null })) },
      };
      throw new Error(`unexpected action ${action}`);
    });

    render(<PaktaDashboard eventId="ev1" />);
    await screen.findByText('Ahmad Budiman');

    const button = screen.getByText('Unduh Semua (ZIP)') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test sementara**

Run: `npx vitest run tests/zzz-manual-verify-bulk-download.test.tsx`
Expected: PASS, 2/2. Kalau gagal karena detail lain dari Task 1/2 yang tidak terduga dari plan ini, baca kode yang baru saja ditulis untuk menyesuaikan mock — tujuannya murni memverifikasi UI unduh massal yang ditambahkan plan ini.

- [ ] **Step 3: Konfirmasi tidak ada regresi, lalu hapus file sementara**

```bash
npx vitest run
rm tests/zzz-manual-verify-bulk-download.test.tsx
git status --short
```

Expected: full suite tetap 89/89 (file sementara tidak menambah hitungan permanen), `git status --short` bersih dari file test sementara tersebut.

- [ ] **Step 4: Laporkan hasil**

Tulis catatan singkat: konfirmasi `get_bulk_signed_urls` benar-benar dipanggil SATU kali (bukan N kali) untuk N peserta, konfirmasi tombol disabled saat tidak ada peserta "sudah", dan catat sebagai known-limitation bagian mana yang tidak bisa diverifikasi murni lewat test ter-mock (mis. concurrency 5 sungguhan terhadap 150 file nyata, atau performa jaringan sungguhan terhadap Supabase Storage — itu di luar jangkauan test unit/komponen, hanya bisa dipastikan lewat pemakaian nyata oleh user).

---

## Ringkasan Cakupan Spec

- Backend satu-invocation `get_bulk_signed_urls` (mengatasi concern limit Vercel untuk 150 peserta) → Task 1 (TDD, 3 test: sukses, satu path gagal, paths kosong)
- Tombol "Unduh Semua (ZIP)", disabled kalau `sudahCount === 0` → Task 2 Step 4 + Task 3 (verifikasi disabled state)
- Concurrency terbatas (5) saat fetch byte PDF → Task 2 Step 3 (`worker()`/`cursor`) — tidak ada test otomatis untuk concurrency asli (di luar jangkauan test komponen), didokumentasikan sebagai known-limitation di Task 3
- Progress bertahap (fetching dengan persentase asli, zipping indeterminate) → Task 2 Step 4 (reuse `.apple-progress`) + Task 3 (verifikasi via `bulkPhase`/tombol disabled saat berjalan)
- Nama file ZIP (`Pakta - <nama acara>.zip`) dan nama file per-PDF (`pakta-<nama>.pdf`, konsisten dengan `downloadPdf`) → Task 2 Step 3
- Error apa pun menghentikan seluruh proses, tidak ada ZIP parsial → Task 2 Step 3 (`try/catch` membungkus seluruh alur, `alert()` pada error)
- Hal yang tidak berubah (`downloadPdf`, `resetSigner`, `copyLink`, search, action admin lain, `src/lib/download.ts`, `GenerateBulk.tsx`, `PaktaSignPage.tsx`) → tidak disentuh oleh task manapun di plan ini, sesuai spec bagian 4
