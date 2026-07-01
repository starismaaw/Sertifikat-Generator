# Progress Bertahap Submit + Unduh PDF Halaman Sukses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti teks statis "Mengirim tanda tangan…" dengan progress bar bertahap yang mencerminkan langkah asli, dan tambah tombol unduh PDF di halaman sukses memakai PDF yang sudah dirender di browser saat submit.

**Architecture:** Tambah state `submitPhase` yang di-update di titik nyata dalam `handleSubmit` (bukan animasi kosong), reuse class CSS `.apple-progress*` yang sudah ada. Simpan `pdfBytes` hasil `renderPakta()` (sudah dihitung sebelum upload) ke state `success`, lalu bungkus jadi `Blob` + object URL lokal untuk diunduh — tanpa API baru.

**Tech Stack:** React (TSX), CSS custom properties yang sudah ada di `apple-design.css` (tidak ada CSS baru), Blob/object URL browser API standar.

---

### Task 1: Progress bertahap saat submit

**Files:**
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx`

Tidak ada test otomatis untuk task ini — codebase ini belum punya precedent test komponen React (`@testing-library/react` ter-install tapi tidak dipakai di manapun di `tests/`), dan perubahan ini murni JSX + state timing tanpa fungsi murni baru yang berdiri sendiri. Verifikasi: build clean + full suite existing tidak regresi (Task 3 di plan ini melakukan verifikasi perilaku manual).

- [ ] **Step 1: Tambah tipe `SubmitPhase` dan `SUBMIT_PHASE_LABELS`**

Ubah baris 8-16 dari:

```typescript
type PageState =
  | { step: 'loading' }
  | { step: 'notFound' }
  | { step: 'pickName'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signers: SignerRow[] }
  | { step: 'signing'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signer: SignerRow; backgroundDataUrl: string }
  | { step: 'submitting' }
  | { step: 'success'; signerNama: string }
  | { step: 'error'; message: string };

async function loadBackground(templatePath: string): Promise<string> {
```

menjadi:

```typescript
type PageState =
  | { step: 'loading' }
  | { step: 'notFound' }
  | { step: 'pickName'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signers: SignerRow[] }
  | { step: 'signing'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signer: SignerRow; backgroundDataUrl: string }
  | { step: 'submitting' }
  | { step: 'success'; signerNama: string }
  | { step: 'error'; message: string };

type SubmitPhase = 'preparing' | 'rendering' | 'uploading' | 'saving';

const SUBMIT_PHASE_LABELS: Record<SubmitPhase, string> = {
  preparing: 'Menyiapkan dokumen…',
  rendering: 'Membuat PDF…',
  uploading: 'Mengunggah dokumen…',
  saving: 'Menyimpan status…',
};

async function loadBackground(templatePath: string): Promise<string> {
```

- [ ] **Step 2: Tambah state `submitPhase`**

Ubah baris 30-35 dari:

```typescript
export function PaktaSignPage({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [loadKey, setLoadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [showSudah, setShowSudah] = useState(false);
  const sigPadRef = useRef<SignaturePadHandle>(null);
```

menjadi:

```typescript
export function PaktaSignPage({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [loadKey, setLoadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [showSudah, setShowSudah] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('preparing');
  const sigPadRef = useRef<SignaturePadHandle>(null);
```

- [ ] **Step 3: Update `handleSubmit` untuk set `submitPhase` di setiap langkah nyata**

Ubah seluruh fungsi `handleSubmit` (baris 67-121) dari:

```typescript
  async function handleSubmit() {
    if (state.step !== 'signing') return;
    const pad = sigPadRef.current;
    if (!pad || pad.isEmpty()) {
      alert('Harap gambar tanda tangan Anda terlebih dahulu.');
      return;
    }
    const { template, signer, backgroundDataUrl } = state;
    setState({ step: 'submitting' });

    try {
      const signaturePng = pad.toDataURL();
      const values: FieldValues = {
        nama: signer.nama,
        nip: signer.nip,
        jabatan: signer.jabatan,
        tanggal: template.tanggal,
      };
      const templateWithBg: typeof template = { ...template, background: backgroundDataUrl };

      const urlResp = await fetch('/api/pakta-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_pdf_upload_url', signerId: signer.id, eventId }),
      });
      if (!urlResp.ok) {
        const err = await urlResp.json().catch(() => ({ error: 'Gagal menghubungi server' }));
        throw new Error(err.error ?? 'Gagal mendapatkan URL unggah');
      }
      const { signedUrl, pdfPath } = await urlResp.json() as { signedUrl: string; pdfPath: string };

      const pdfBytes = await renderPakta(templateWithBg, values, signaturePng);

      const uploadResp = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }),
      });
      if (!uploadResp.ok) throw new Error('Gagal mengunggah dokumen ke server');

      try {
        await updateSignerDone(signer.id, pdfPath);
      } catch (dbErr) {
        setState({
          step: 'error',
          message: `Dokumen berhasil diunggah namun gagal menyimpan status. ${(dbErr as Error).message}`,
        });
        return;
      }

      setState({ step: 'success', signerNama: signer.nama });
    } catch (err) {
      setState({ step: 'error', message: (err as Error).message });
    }
  }
```

menjadi:

```typescript
  async function handleSubmit() {
    if (state.step !== 'signing') return;
    const pad = sigPadRef.current;
    if (!pad || pad.isEmpty()) {
      alert('Harap gambar tanda tangan Anda terlebih dahulu.');
      return;
    }
    const { template, signer, backgroundDataUrl } = state;
    setSubmitPhase('preparing');
    setState({ step: 'submitting' });

    try {
      const signaturePng = pad.toDataURL();
      const values: FieldValues = {
        nama: signer.nama,
        nip: signer.nip,
        jabatan: signer.jabatan,
        tanggal: template.tanggal,
      };
      const templateWithBg: typeof template = { ...template, background: backgroundDataUrl };

      const urlResp = await fetch('/api/pakta-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_pdf_upload_url', signerId: signer.id, eventId }),
      });
      if (!urlResp.ok) {
        const err = await urlResp.json().catch(() => ({ error: 'Gagal menghubungi server' }));
        throw new Error(err.error ?? 'Gagal mendapatkan URL unggah');
      }
      const { signedUrl, pdfPath } = await urlResp.json() as { signedUrl: string; pdfPath: string };

      setSubmitPhase('rendering');
      const pdfBytes = await renderPakta(templateWithBg, values, signaturePng);

      setSubmitPhase('uploading');
      const uploadResp = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }),
      });
      if (!uploadResp.ok) throw new Error('Gagal mengunggah dokumen ke server');

      setSubmitPhase('saving');
      try {
        await updateSignerDone(signer.id, pdfPath);
      } catch (dbErr) {
        setState({
          step: 'error',
          message: `Dokumen berhasil diunggah namun gagal menyimpan status. ${(dbErr as Error).message}`,
        });
        return;
      }

      setState({ step: 'success', signerNama: signer.nama, pdfBytes });
    } catch (err) {
      setState({ step: 'error', message: (err as Error).message });
    }
  }
```

Catatan: baris terakhir (`setState({ step: 'success', signerNama: signer.nama, pdfBytes })`) sudah memakai bentuk akhir dari Task 2 (`pdfBytes` ikut disertakan) — ini supaya Task 1 tidak membuat state transisi antara yang lantas harus diubah lagi di Task 2. Tipe `PageState`'s `success` varian baru akan menerima field `pdfBytes` di Task 2 Step 1; sampai Task 2 selesai, TypeScript akan menandai baris ini error (field `pdfBytes` belum ada di tipe) — ini yang diharapkan, jangan jalankan `npm run build` sampai kedua task ini selesai berurutan dalam satu implementer yang sama, ATAU jika dijalankan sebagai task terpisah, Task 1 harus di-build-check SETELAH Task 2 selesai (lihat Step 5 di bawah).

- [ ] **Step 4: Ganti render step `submitting`**

Ubah baris 268-278 dari:

```tsx
  if (state.step === 'submitting') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <p style={{ color: 'var(--color-ink-faint)', textAlign: 'center', marginTop: 64 }}>
            Mengirim tanda tangan…
          </p>
        </div>
      </div>
    );
  }
```

menjadi:

```tsx
  if (state.step === 'submitting') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <div className="apple-progress" style={{ marginTop: 64 }}>
            <div className="apple-progress-phase">{SUBMIT_PHASE_LABELS[submitPhase]}</div>
            <div className="apple-progress-track">
              <div className="apple-progress-fill indeterminate" />
            </div>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 5: Build (boleh gagal di task ini karena `pdfBytes` belum ada di tipe `success` — itu normal, akan hijau setelah Task 2)**

Run: `npx tsc --noEmit 2>&1 | grep -i "success" || true`
Expected: kemungkinan menunjukkan error TypeScript terkait properti `pdfBytes` yang belum ada di varian `success` (dari `PageState`) — ini SEMENTARA dan disengaja, akan hilang setelah Task 2 menambah field tersebut ke tipe. Jangan coba perbaiki di task ini.

Jangan commit terpisah untuk task ini — lanjut langsung ke Task 2 di implementer/commit yang sama supaya kode selalu dalam keadaan build-clean di setiap commit (lihat instruksi commit gabungan di akhir Task 2).

---

### Task 2: Unduh PDF di halaman sukses

**Files:**
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx`

Task ini melanjutkan langsung dari Task 1 di file yang sama (Task 1 sengaja meninggalkan proyek dalam keadaan tidak build-clean karena tipe `success` belum diperluas — Task ini yang melengkapinya). Implementer yang sama mengerjakan Task 1 dan Task 2 berurutan, lalu commit sekali di akhir Task 2.

- [ ] **Step 1: Perluas tipe varian `success` di `PageState`**

Ubah baris 14 (di dalam union `PageState`, sudah termasuk `SubmitPhase`/`SUBMIT_PHASE_LABELS` dari Task 1) dari:

```typescript
  | { step: 'success'; signerNama: string }
```

menjadi:

```typescript
  | { step: 'success'; signerNama: string; pdfBytes: Uint8Array }
```

- [ ] **Step 2: Tambah fungsi `downloadSuccessPdf`**

Tambahkan fungsi berikut tepat setelah penutup fungsi `handleSubmit` (setelah `}` yang menutup `handleSubmit`, sebelum `if (state.step === 'loading') {`):

```typescript
  function downloadSuccessPdf(signerNama: string, pdfBytes: Uint8Array) {
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pakta-${signerNama.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
```

- [ ] **Step 3: Ganti render step `success`**

Ubah baris 280-295 dari:

```tsx
  if (state.step === 'success') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <div className="apple-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 className="apple-h2">Tanda Tangan Berhasil</h2>
            <p style={{ color: 'var(--color-ink-faint)', marginTop: 8 }}>
              Terima kasih, <strong>{state.signerNama}</strong>.<br />
              Pakta Integritas Anda telah berhasil ditandatangani dan disimpan.
            </p>
          </div>
        </div>
      </div>
    );
  }
```

menjadi:

```tsx
  if (state.step === 'success') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <div className="apple-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 className="apple-h2">Tanda Tangan Berhasil</h2>
            <p style={{ color: 'var(--color-ink-faint)', marginTop: 8 }}>
              Terima kasih, <strong>{state.signerNama}</strong>.<br />
              Pakta Integritas Anda telah berhasil ditandatangani dan disimpan.
            </p>
            <button
              className="apple-btn apple-btn-primary"
              style={{ marginTop: 24 }}
              onClick={() => downloadSuccessPdf(state.signerNama, state.pdfBytes)}
            >
              Unduh PDF
            </button>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Build & jalankan test suite penuh**

Run: `npm run build && npx vitest run`
Expected: build 0 error (termasuk error sementara dari Task 1 Step 5 sekarang sudah hilang karena tipe `success` sudah punya `pdfBytes`); seluruh test lolos, 83/83 (tidak ada test baru di plan ini — lihat catatan Tech Stack di header plan)

- [ ] **Step 5: Commit gabungan Task 1 + Task 2**

```bash
git add src/components/pakta-signer/PaktaSignPage.tsx
git commit -m "feat(pakta-signer): progress bertahap saat submit + unduh PDF di halaman sukses"
```

---

### Task 3: Verifikasi manual perilaku (progress bertahap + unduh PDF)

**Files:** tidak ada file yang diubah — task ini murni verifikasi, dilakukan controller (implementer tidak punya akses browser, dan codebase tidak punya precedent test komponen React untuk menambah test permanen di sini).

Sesi sebelumnya (fitur pencarian nama) tidak berhasil mengakses acara pakta sungguhan di browser (tidak ada password admin, tidak ada data event ter-seed) — controller memverifikasi lewat render test `@testing-library/react` sementara yang di-mock lalu dihapus setelah dipakai. Task ini memakai pendekatan yang sama karena situasinya tidak berubah.

- [ ] **Step 1: Tulis render test sementara (TIDAK dikomit, dihapus setelah dipakai) yang me-mock backend dan memverifikasi urutan label tahap**

Buat file sementara `tests/zzz-manual-verify-submit-progress.test.tsx` (nama diawali `zzz-manual-verify-` sebagai penanda "hapus setelah dipakai", konsisten dengan pola sesi sebelumnya):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { forwardRef, useImperativeHandle } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaktaSignPage } from '../src/components/pakta-signer/PaktaSignPage';
import type { SignaturePadHandle } from '../src/components/pakta-signer/SignaturePad';

const signer = { id: '1', event_id: 'ev1', nama: 'Ahmad Budiman', nip: '198501012010011001', jabatan: 'Staf', data: {}, status: 'belum' as const, signed_at: null, pdf_path: null };

vi.mock('../src/lib/paktaStore', () => ({
  getAcaraPakta: vi.fn(async () => ({
    eventId: 'ev1',
    nama: 'Pakta Uji Coba',
    tanggal: '2026-07-01',
    templatePath: 'dummy.png',
  })),
  listSigners: vi.fn(async () => [signer]),
  updateSignerDone: vi.fn(async () => {}),
}));

vi.mock('../src/lib/pdfRenderer', () => ({
  renderPakta: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
}));

// jsdom tidak punya Canvas 2D context sungguhan dan signature_pad melacak event
// pointer internal (bukan piksel canvas) untuk isEmpty() — memalsukan interaksi
// canvas langsung tidak akan bekerja. Mock seluruh komponen SignaturePad dengan
// stub yang selalu melaporkan "tidak kosong", supaya tes ini murni fokus pada
// perilaku PaktaSignPage (progress + unduh), bukan pada SignaturePad/signature_pad.
vi.mock('../src/components/pakta-signer/SignaturePad', () => ({
  SignaturePad: forwardRef<SignaturePadHandle>((_, ref) => {
    useImperativeHandle(ref, () => ({
      isEmpty: () => false,
      toDataURL: () => 'data:image/png;base64,stub',
      clear: () => {},
    }));
    return null;
  }),
}));

// jsdom tidak mengimplementasikan fetch untuk loadBackground (gambar latar) dan
// endpoint /api/pakta-signer — stub keduanya di sini.
global.fetch = vi.fn(async (url: string) => {
  if (typeof url === 'string' && url.includes('/api/pakta-signer')) {
    return {
      ok: true,
      json: async () => ({ signedUrl: 'https://example.test/upload', pdfPath: 'ev1/1.pdf' }),
    } as Response;
  }
  // loadBackground fetch (gambar template) dan PUT upload signedUrl
  return {
    ok: true,
    blob: async () => new Blob(['x']),
  } as Response;
}) as unknown as typeof fetch;

describe('PaktaSignPage submit flow (manual verification, NOT part of plan test suite - delete after use)', () => {
  it('menampilkan label tahap berurutan lalu tombol unduh PDF di halaman sukses', async () => {
    render(<PaktaSignPage eventId="ev1" />);
    const namaBtn = await screen.findByText('Ahmad Budiman');
    fireEvent.click(namaBtn);

    // Tunggu sampai step 'signing' termuat (loadBackground selesai)
    await screen.findByText('Tanda Tangan Anda');

    fireEvent.click(screen.getByText('Kirim Tanda Tangan'));

    // Selama proses submit, minimal satu label tahap sempat terlihat
    await waitFor(() => {
      const phaseText = screen.queryByText(/Menyiapkan dokumen…|Membuat PDF…|Mengunggah dokumen…|Menyimpan status…/);
      expect(phaseText).toBeTruthy();
    });

    // Setelah selesai, halaman sukses + tombol unduh muncul
    await screen.findByText('Tanda Tangan Berhasil', {}, { timeout: 3000 });
    expect(screen.getByText('Unduh PDF')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Jalankan test sementara**

Run: `npx vitest run tests/zzz-manual-verify-submit-progress.test.tsx`
Expected: PASS. Kalau gagal karena detail lain di `PaktaSignPage.tsx` yang tidak terduga dari plan ini (mis. urutan `fetch` mock yang tidak cocok dengan urutan panggilan sungguhan), baca kode `handleSubmit` yang baru saja ditulis di Task 1/2 untuk menyesuaikan mock — tujuannya murni memverifikasi UI progress & tombol unduh yang ditambahkan plan ini, bukan menguji ulang `SignaturePad`/`signature_pad` itu sendiri.

- [ ] **Step 3: Konfirmasi tidak ada regresi ke suite utama, lalu hapus file sementara**

```bash
npx vitest run
rm tests/zzz-manual-verify-submit-progress.test.tsx
git status --short
```

Expected: full suite tetap 83/83 (file sementara di atas tidak menambah ke hitungan permanen karena akan dihapus), dan `git status --short` tidak menunjukkan file test sementara tersebut lagi (hanya perubahan yang memang dari Task 1+2 yang sudah dikomit, working tree bersih).

- [ ] **Step 4: Laporkan hasil**

Tulis catatan singkat: apakah label tahap benar-benar berganti berurutan selama proses submit (bukan cuma satu tahap yang "kebetulan" ketangkep `waitFor`), apakah tombol "Unduh PDF" muncul dan `onClick`-nya terhubung ke `pdfBytes` yang benar (bisa dicek dengan spy pada `URL.createObjectURL` dalam variasi test kalau ingin bukti lebih kuat), dan catat sebagai known-limitation bagian mana yang tidak bisa diverifikasi (mis. isi PDF hasil unduhan sungguhan tidak dibuka ulang untuk dibandingkan byte-by-byte — cukup percaya bahwa `pdfBytes` yang sama dipakai untuk upload dan unduhan karena satu variabel yang sama, sudah tercermin di kode).

---

## Ringkasan Cakupan Spec

- Progress bertahap (label tahap + bar indeterminate) → Task 1 (state, handleSubmit, render `submitting`) + Task 3 (verifikasi urutan label)
- Simpan `pdfBytes` ke state `success` → Task 1 Step 3 (baris terakhir `handleSubmit`) + Task 2 Step 1 (tipe)
- Tombol unduh PDF di halaman sukses → Task 2 Step 2-3 (fungsi + render) + Task 3 (verifikasi tombol muncul)
- Batasan "pdfBytes hilang setelah refresh" (spec bagian 3.4) → tidak butuh implementasi, sudah merupakan perilaku alami dari state React yang tidak dipersist — tidak ada task terpisah karena tidak ada kode yang perlu ditulis untuk ini
- Hal yang tidak berubah (API `get_pdf_upload_url`, `updateSignerDone`, step lain, dashboard admin) → tidak disentuh oleh task manapun di plan ini, sesuai spec bagian 4
