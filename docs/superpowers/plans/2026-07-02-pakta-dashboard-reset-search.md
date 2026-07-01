# Reset Tanda Tangan + Search Dashboard Admin Pakta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah kemampuan admin untuk mereset tanda tangan seorang peserta (supaya bisa TTD ulang) dan mencari peserta di tabel dashboard acara pakta integritas.

**Architecture:** Backend action baru `reset_signer` di `api/pakta-admin.ts` (hapus PDF lama dari storage + reset status/signed_at/pdf_path di database), lalu dua perubahan independen di `PaktaDashboard.tsx`: tombol "Reset" di kolom Unduh, dan search input yang memfilter tabel via `matchesSignerQuery` yang sudah ada.

**Tech Stack:** Vercel serverless function (TypeScript) untuk backend, React (TSX) untuk frontend, Vitest untuk backend TDD (pola mocking Supabase yang sudah ada di `tests/paktaAdmin.test.ts`).

---

### Task 1: Backend — action `reset_signer`

**Files:**
- Modify: `api/pakta-admin.ts`
- Test: `tests/paktaAdmin.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan test berikut di `tests/paktaAdmin.test.ts`, setelah blok `it('delete_event menolak bila id tidak ada', ...)` (baris 192-198), sebelum penutup `});` dari `describe('pakta-admin handler', ...)`:

```typescript
  // WHY: reset tanda tangan harus menghapus PDF lama dari storage lalu
  // mengembalikan status peserta ke 'belum' supaya bisa TTD ulang.
  it('reset_signer menghapus PDF storage lalu reset status ke belum', async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    const storageFromMock = vi.fn().mockReturnValue({ remove: removeMock });

    fromAdminMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { pdf_path: 'docs/ev1/s1.pdf' }, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

    createClientMock.mockReturnValue({ from: fromAdminMock, storage: { from: storageFromMock } });

    const res = mockRes();
    await handler(mockReq({ action: 'reset_signer', id: 's1' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(storageFromMock).toHaveBeenCalledWith('pakta-documents');
    expect(removeMock).toHaveBeenCalledWith(['docs/ev1/s1.pdf']);
  });

  // WHY: kalau peserta belum pernah punya PDF (belum TTD), tidak boleh ada
  // panggilan hapus storage yang sia-sia.
  it('reset_signer tidak memanggil storage remove kalau belum ada pdf_path', async () => {
    const removeMock = vi.fn().mockResolvedValue({ error: null });
    const storageFromMock = vi.fn().mockReturnValue({ remove: removeMock });

    fromAdminMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { pdf_path: null }, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

    createClientMock.mockReturnValue({ from: fromAdminMock, storage: { from: storageFromMock } });

    const res = mockRes();
    await handler(mockReq({ action: 'reset_signer', id: 's2' }), res);

    expect(res.statusCode).toBe(200);
    expect(removeMock).not.toHaveBeenCalled();
  });

  // WHY: id peserta wajib diisi agar tidak mereset tanpa target.
  it('reset_signer menolak bila id tidak ada', async () => {
    fromAdminMock.mockReturnValue({});
    const res = mockRes();
    await handler(mockReq({ action: 'reset_signer' }), res);
    expect(res.statusCode).toBe(400);
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/paktaAdmin.test.ts -t "reset_signer"`
Expected: FAIL — 3 test gagal dengan `res.statusCode` bernilai `400` (bukan `200`), pesan `Action tidak dikenal: reset_signer`, karena case `reset_signer` belum ada di `api/pakta-admin.ts`.

- [ ] **Step 3: Tambah case `reset_signer` di `api/pakta-admin.ts`**

Tambahkan case baru setelah case `delete_event` (baris 104-134) dan sebelum case `get_signed_url` (baris 136):

```typescript
    case 'reset_signer': {
      const { id } = body as { id: string };
      if (!id) return res.status(400).json({ error: 'id peserta wajib diisi' });

      const { data: signer } = await sb
        .from('pakta_signers')
        .select('pdf_path')
        .eq('id', id)
        .single();

      if (signer?.pdf_path) {
        await sb.storage.from('pakta-documents').remove([signer.pdf_path]);
      }

      const { error } = await sb
        .from('pakta_signers')
        .update({ status: 'belum', signed_at: null, pdf_path: null })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run tests/paktaAdmin.test.ts`
Expected: PASS — semua test di file ini lolos, termasuk 3 test baru (total naik dari yang sudah ada di file ini sebelumnya + 3)

- [ ] **Step 5: Commit**

```bash
git add api/pakta-admin.ts tests/paktaAdmin.test.ts
git commit -m "feat(pakta-admin): tambah action reset_signer untuk reset tanda tangan"
```

---

### Task 2: Frontend — tombol reset tanda tangan

**Files:**
- Modify: `src/components/pakta-admin/PaktaDashboard.tsx`

Tidak ada test otomatis untuk task ini — codebase ini belum punya precedent test komponen React (`@testing-library/react` ter-install tapi tidak dipakai permanen di `tests/`). Verifikasi: build clean + full suite existing tidak regresi (Task 4 di plan ini melakukan verifikasi perilaku manual).

- [ ] **Step 1: Tambah fungsi `resetSigner`**

Tambahkan fungsi berikut di `PaktaDashboard.tsx`, setelah fungsi `downloadPdf` (baris 52-66) dan sebelum fungsi `copyLink`:

```typescript
  async function resetSigner(signer: Signer) {
    if (!confirm(`Reset tanda tangan ${signer.nama}? PDF yang sudah ditandatangani akan dihapus permanen dan pegawai ini bisa TTD ulang.`)) return;
    try {
      await callAdmin('reset_signer', { id: signer.id });
      load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

```

- [ ] **Step 2: Tambah tombol "Reset" di kolom Unduh**

Ubah blok `<td>` kolom Unduh (baris 153-164) dari:

```tsx
                      <td>
                        {s.pdf_path ? (
                          <button
                            className="sg-btn sg-btn-outline"
                            style={{ fontSize: 12, padding: '2px 10px' }}
                            disabled={downloadingId === s.id}
                            onClick={() => downloadPdf(s)}
                          >
                            {downloadingId === s.id ? '…' : 'PDF'}
                          </button>
                        ) : '—'}
                      </td>
```

menjadi:

```tsx
                      <td>
                        {s.pdf_path ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="sg-btn sg-btn-outline"
                              style={{ fontSize: 12, padding: '2px 10px' }}
                              disabled={downloadingId === s.id}
                              onClick={() => downloadPdf(s)}
                            >
                              {downloadingId === s.id ? '…' : 'PDF'}
                            </button>
                            <button
                              className="sg-btn sg-btn-outline"
                              style={{ fontSize: 12, padding: '2px 10px' }}
                              onClick={() => resetSigner(s)}
                            >
                              Reset
                            </button>
                          </div>
                        ) : '—'}
                      </td>
```

Tombol "Reset" hanya muncul bersama tombol "PDF" (keduanya di dalam kondisi `s.pdf_path ?`), sehingga peserta berstatus "Belum" (tanpa `pdf_path`) tetap menampilkan `—` seperti sekarang, tidak berubah.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: 0 error

- [ ] **Step 4: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx
git commit -m "feat(pakta-admin): tambah tombol reset tanda tangan di dashboard"
```

---

### Task 3: Frontend — search peserta

**Files:**
- Modify: `src/components/pakta-admin/PaktaDashboard.tsx`

Task ini melanjutkan dari Task 2 di file yang sama. Tidak ada test otomatis (sama seperti Task 2) — verifikasi lewat Task 4.

- [ ] **Step 1: Tambah import `matchesSignerQuery`**

Ubah baris import di bagian atas file dari:

```typescript
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';
```

menjadi:

```typescript
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';
import { matchesSignerQuery } from '../../lib/signerFilter';
```

- [ ] **Step 2: Tambah state `query`**

Ubah blok state di awal komponen dari:

```typescript
  const { callAdmin } = usePaktaAdmin();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
```

- [ ] **Step 3: Tambah `filteredSigners`**

Ubah baris:

```typescript
  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;
```

menjadi:

```typescript
  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;
  const filteredSigners = signers.filter(s =>
    matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query)
  );
```

`sudahCount`/`totalCount` tetap dihitung dari `signers` mentah (bukan `filteredSigners`) — statistik kartu di atas tabel tidak berubah saat mengetik di kotak cari.

- [ ] **Step 4: Tambah search input + empty state pencarian, ganti `signers.map` jadi `filteredSigners.map`**

Ubah seluruh blok tabel (dari `{/* Tabel signer */}` sampai penutup `)}`  sebelum bagian "Kolom kanan: QR code + link") dari:

```tsx
          {/* Tabel signer */}
          {signers.length === 0 ? (
            <p className="apple-empty">Belum ada pegawai. Klik "Impor Pegawai" untuk menambahkan.</p>
          ) : (
            <div className="apple-table-wrap">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Waktu TTD</th>
                    <th>Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {signers.map(s => (
                    <tr key={s.id}>
                      <td>{s.nama}</td>
                      <td>{s.nip}</td>
                      <td>{s.jabatan}</td>
                      <td>
                        <span className={`apple-badge ${s.status === 'sudah' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
                          {s.status === 'sudah' ? 'Sudah' : 'Belum'}
                        </span>
                      </td>
                      <td className="apple-caption">
                        {s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '—'}
                      </td>
                      <td>
                        {s.pdf_path ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="sg-btn sg-btn-outline"
                              style={{ fontSize: 12, padding: '2px 10px' }}
                              disabled={downloadingId === s.id}
                              onClick={() => downloadPdf(s)}
                            >
                              {downloadingId === s.id ? '…' : 'PDF'}
                            </button>
                            <button
                              className="sg-btn sg-btn-outline"
                              style={{ fontSize: 12, padding: '2px 10px' }}
                              onClick={() => resetSigner(s)}
                            >
                              Reset
                            </button>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
```

menjadi:

```tsx
          {/* Tabel signer */}
          {signers.length === 0 ? (
            <p className="apple-empty">Belum ada pegawai. Klik "Impor Pegawai" untuk menambahkan.</p>
          ) : (
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
                <div className="apple-table-wrap">
                  <table className="apple-table">
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>NIP</th>
                        <th>Jabatan</th>
                        <th>Status</th>
                        <th>Waktu TTD</th>
                        <th>Unduh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSigners.map(s => (
                        <tr key={s.id}>
                          <td>{s.nama}</td>
                          <td>{s.nip}</td>
                          <td>{s.jabatan}</td>
                          <td>
                            <span className={`apple-badge ${s.status === 'sudah' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
                              {s.status === 'sudah' ? 'Sudah' : 'Belum'}
                            </span>
                          </td>
                          <td className="apple-caption">
                            {s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '—'}
                          </td>
                          <td>
                            {s.pdf_path ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="sg-btn sg-btn-outline"
                                  style={{ fontSize: 12, padding: '2px 10px' }}
                                  disabled={downloadingId === s.id}
                                  onClick={() => downloadPdf(s)}
                                >
                                  {downloadingId === s.id ? '…' : 'PDF'}
                                </button>
                                <button
                                  className="sg-btn sg-btn-outline"
                                  style={{ fontSize: 12, padding: '2px 10px' }}
                                  onClick={() => resetSigner(s)}
                                >
                                  Reset
                                </button>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
```

Catatan: kondisi `signers.length === 0` (belum ada peserta sama sekali) tetap terluar dan tidak berubah — pesan "Tidak ada peserta yang cocok dengan pencarian." (dari `filteredSigners.length === 0`) hanya muncul kalau memang ada peserta tapi search tidak menemukan kecocokan.

- [ ] **Step 5: Build & jalankan test suite penuh**

Run: `npm run build && npx vitest run`
Expected: build 0 error; seluruh test lolos (baseline + 3 test baru dari Task 1)

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx
git commit -m "feat(pakta-admin): tambah search nama/NIP di dashboard"
```

---

### Task 4: Verifikasi manual (reset tanda tangan + search)

**Files:** tidak ada file yang diubah — task ini murni verifikasi, dilakukan controller (implementer tidak punya akses browser, dan codebase tidak punya precedent test komponen React permanen untuk `PaktaDashboard.tsx`).

Sesi-sesi sebelumnya (fitur pencarian nama publik, fitur progress submit) memakai pola yang sama: render test `@testing-library/react` sementara yang di-mock, dijalankan sekali oleh controller, lalu dihapus (tidak masuk commit manapun). Task ini memakai pendekatan yang sama.

- [ ] **Step 1: Tulis render test sementara (TIDAK dikomit, dihapus setelah dipakai)**

Buat file sementara `tests/zzz-manual-verify-dashboard-reset-search.test.tsx`:

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
    { id: 's2', nama: 'Siti Aminah', nip: '198502022010011002', jabatan: 'Staf', status: 'belum' as const, signed_at: null, pdf_path: null },
  ],
};

describe('PaktaDashboard reset + search (manual verification, NOT part of plan test suite - delete after use)', () => {
  it('tombol Reset hanya muncul untuk status sudah, dan memanggil reset_signer setelah konfirmasi', async () => {
    callAdminMock.mockImplementation(async (action: string) => {
      if (action === 'get_event') return { event: baseEvent };
      if (action === 'reset_signer') return { ok: true };
      throw new Error(`unexpected action ${action}`);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<PaktaDashboard eventId="ev1" />);
    await screen.findByText('Ahmad Budiman');

    // Reset hanya ada di baris "sudah", tidak ada di baris "belum"
    const resetButtons = screen.getAllByText('Reset');
    expect(resetButtons).toHaveLength(1);

    fireEvent.click(resetButtons[0]);
    await waitFor(() => {
      expect(callAdminMock).toHaveBeenCalledWith('reset_signer', { id: 's1' });
    });
  });

  it('search memfilter tabel berdasarkan nama dan NIP', async () => {
    callAdminMock.mockImplementation(async (action: string) => {
      if (action === 'get_event') return { event: baseEvent };
      throw new Error(`unexpected action ${action}`);
    });

    render(<PaktaDashboard eventId="ev1" />);
    await screen.findByText('Ahmad Budiman');
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Cari nama atau NIP…');
    fireEvent.change(searchInput, { target: { value: 'siti' } });
    expect(screen.queryByText('Ahmad Budiman')).not.toBeInTheDocument();
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '198501012010011001' } });
    expect(screen.getByText('Ahmad Budiman')).toBeInTheDocument();
    expect(screen.queryByText('Siti Aminah')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'tidak-ada-yang-cocok' } });
    expect(screen.getByText('Tidak ada peserta yang cocok dengan pencarian.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Jalankan test sementara**

Run: `npx vitest run tests/zzz-manual-verify-dashboard-reset-search.test.tsx`
Expected: PASS, 2/2. Kalau gagal karena detail lain di `PaktaDashboard.tsx` yang tidak terduga dari plan ini (mis. bentuk data `event.pakta_signers` yang tidak cocok dengan mock), baca kode Task 1-3 yang baru saja ditulis untuk menyesuaikan mock — tujuannya murni memverifikasi UI reset & search yang ditambahkan plan ini.

- [ ] **Step 3: Konfirmasi tidak ada regresi ke suite utama, lalu hapus file sementara**

```bash
npx vitest run
rm tests/zzz-manual-verify-dashboard-reset-search.test.tsx
git status --short
```

Expected: full suite tetap lolos (baseline + 3 test baru dari Task 1, file sementara di atas tidak menambah hitungan permanen karena akan dihapus), dan `git status --short` bersih dari file test sementara tersebut.

- [ ] **Step 4: Laporkan hasil**

Tulis catatan singkat: apakah tombol Reset benar-benar hanya muncul di baris "sudah" (bukan "belum"), apakah `window.confirm` yang di-Cancel benar-benar mencegah `callAdmin('reset_signer', ...)` terpanggil (tambahkan pengecekan ini juga: ubah `confirm` mock jadi `mockReturnValue(false)` di satu assertion tambahan dan pastikan `callAdminMock` TIDAK dipanggil dengan `reset_signer`), dan apakah search benar-benar mem-filter dengan nama DAN NIP seperti yang diminta spec. Catat sebagai known-limitation kalau ada bagian yang tidak bisa diverifikasi (mis. penghapusan file storage sungguhan di Supabase — itu sudah tercakup di Task 1 lewat mock Supabase langsung, bukan lewat komponen ini).

---

## Ringkasan Cakupan Spec

- Backend `reset_signer` (hapus PDF storage + reset status) → Task 1 (TDD, 3 test: hapus storage, tanpa pdf_path, id kosong)
- Tombol reset hanya untuk status "sudah" → Task 2 (markup kondisional `s.pdf_path ?`) + Task 4 (verifikasi jumlah tombol Reset)
- Konfirmasi `window.confirm` sebelum reset → Task 2 (`resetSigner` function) + Task 4 (verifikasi confirm dipanggil, Cancel mencegah aksi)
- Reload tabel setelah reset (`load()`) → Task 2 (`resetSigner` memanggil `load()` setelah `callAdmin` sukses)
- Search nama + NIP → Task 3 (`filteredSigners`, reuse `matchesSignerQuery`) + Task 4 (verifikasi filter dua field)
- Statistik tidak berubah saat search → Task 3 (`sudahCount`/`totalCount` dari `signers` mentah, bukan `filteredSigners`)
- Empty state pencarian → Task 3 (kondisi `filteredSigners.length === 0`) + Task 4 (verifikasi pesan muncul)
- Hal yang tidak berubah (kolom lain, `downloadPdf`, `copyLink`, QR, action admin lain) → tidak disentuh oleh task manapun di plan ini, sesuai spec bagian 4
