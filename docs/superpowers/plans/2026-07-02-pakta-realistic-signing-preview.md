# Preview Tanda Tangan Realistis Pakta Integritas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render dokumen Pakta Integritas penuh (gambar template + field nama/NIP/jabatan yang sudah terisi data asli) di halaman tanda tangan publik, dengan kanvas tanda tangan transparan yang ditempatkan tepat pada posisi field `tandaTangan` sehingga user merasa menandatangani dokumen asli — bukan kotak terpisah seperti sekarang.

**Architecture:** Komponen baru `PaktaDocumentPreview` merender `<img>` background + field-field ter-absolute-position (dihitung dari `scale = containerWidth / bgWidth`, pola yang sama dengan `EditorCanvas.tsx`), dengan logika font-fit dipakai ulang dari `pdfRenderer.ts` (`toCssFont`, `browserTextWidth`) agar posisi teks identik dengan PDF akhir. Kotak tanda tangan diberi batas bawah ukuran (`MIN_SIGNATURE_HEIGHT`) supaya tetap nyaman digambar di layar sempit. `SignaturePad.tsx` diperluas dengan mode "embedded" (transparan, tanpa tombol/border bawaan).

**Tech Stack:** React + TypeScript, CSS absolute-positioning (bukan Konva — halaman publik tidak mem-bundle `react-konva`), `signature_pad` (sudah ada), Vitest + `@testing-library/react` untuk test.

**Spec:** `docs/superpowers/specs/2026-07-02-pakta-realistic-signing-preview-design.md`

---

## Catatan cakupan test

`PaktaSignPage.tsx` saat ini **tidak punya test file sama sekali** (fetch Supabase, `fetch()` gambar, canvas — biaya mocking tinggi, nilai tambah rendah dibanding memvalidasi logika inti). Plan ini menambah test otomatis penuh untuk semua logika baru yang bisa diuji secara terisolasi (Task 2–5), tapi **sengaja tidak** menambah test untuk perubahan di `PaktaSignPage.tsx` (Task 6) — konsisten dengan basis line file itu (nol test), dan diverifikasi manual sesuai bagian Testing di spec. Ini dinyatakan eksplisit, bukan celah yang disembunyikan.

---

### Task 1: Polyfill `ResizeObserver` di test setup

**Kenapa:** `SignaturePad.tsx` (sudah ada) dan `PaktaDocumentPreview.tsx` (Task 5) sama-sama memanggil `new ResizeObserver(...)` langsung di `useEffect`. jsdom tidak menyediakan `ResizeObserver` secara bawaan — tanpa polyfill ini, setiap test yang me-mount kedua komponen tersebut akan gagal dengan `ReferenceError: ResizeObserver is not defined`.

**Files:**
- Modify: `tests/setup.ts`

- [ ] **Step 1: Tambahkan polyfill**

Isi `tests/setup.ts` saat ini:
```ts
import '@testing-library/jest-dom';
```

Ganti menjadi:
```ts
import '@testing-library/jest-dom';

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}
```

- [ ] **Step 2: Jalankan test suite penuh untuk memastikan tidak ada regresi**

Run: `npx vitest run`
Expected: semua test yang sudah ada tetap PASS (jumlah test sama seperti sebelum perubahan).

- [ ] **Step 3: Commit**

```bash
git add tests/setup.ts
git commit -m "test: polyfill ResizeObserver for jsdom"
```

---

### Task 2: Ekspor `browserTextWidth` dari `pdfRenderer.ts`

**Kenapa:** Fungsi ini sudah ada dan dipakai `pdfRenderer.ts` secara internal untuk mengukur lebar teks pakai canvas browser (dengan fallback aman saat canvas tidak tersedia, mis. di jsdom). `PaktaDocumentPreview` perlu memakai ulang fungsi ini persis agar shrink-to-fit font di preview identik dengan PDF akhir — bukan mengimplementasikan ulang logika pengukuran teks secara terpisah.

**Files:**
- Modify: `src/lib/pdfRenderer.ts:40`
- Modify: `tests/pdfRenderer.test.ts`

- [ ] **Step 1: Tambahkan `export` pada `browserTextWidth`**

Baris saat ini (`src/lib/pdfRenderer.ts:40-56`):
```ts
function browserTextWidth(
  text: string,
  fontFamily: string,
  fontWeight: FontWeight,
  size: number,
  afmFallback: () => number,
): number {
```

Ganti baris pertama menjadi:
```ts
export function browserTextWidth(
  text: string,
  fontFamily: string,
  fontWeight: FontWeight,
  size: number,
  afmFallback: () => number,
): number {
```

Tidak ada perubahan lain pada isi fungsi.

- [ ] **Step 2: Tambahkan test bahwa fungsi ini bisa diimpor dan dipakai**

Tambahkan di akhir `tests/pdfRenderer.test.ts` (setelah `describe('toCssFont', ...)` yang sudah ada, baris ±216-224):

```ts
describe('browserTextWidth', () => {
  it('mengembalikan angka via afmFallback saat canvas 2d context tidak tersedia (lingkungan test)', () => {
    const width = browserTextWidth('Contoh Teks', 'Inter', 'Regular', 20, () => 123);
    expect(typeof width).toBe('number');
    expect(width).toBe(123);
  });
});
```

Tambahkan `browserTextWidth` ke import yang sudah ada di baris 3:
```ts
import { renderCertificate, renderPakta, PNG_1x1, toCssFont, browserTextWidth } from '../src/lib/pdfRenderer';
```

- [ ] **Step 3: Jalankan test**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: semua test PASS, termasuk test baru `browserTextWidth`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdfRenderer.ts tests/pdfRenderer.test.ts
git commit -m "refactor(pakta): export browserTextWidth for reuse in signing preview"
```

---

### Task 3: Buat `src/lib/paktaPreviewLayout.ts` (logika layout murni)

**Kenapa:** Ini inti dari perbaikan ergonomi mobile yang didiskusikan dengan user — kotak tanda tangan tidak boleh lebih kecil dari ukuran nyaman digambar (`MIN_SIGNATURE_HEIGHT`), sambil tetap berada di posisi field aslinya di dokumen. Ditulis sebagai fungsi murni (tanpa React/DOM) supaya bisa diuji dengan angka pasti, terpisah dari kerumitan rendering komponen.

**Files:**
- Create: `src/lib/paktaPreviewLayout.ts`
- Test: `tests/paktaPreviewLayout.test.ts`

- [ ] **Step 1: Tulis test yang gagal (TDD)**

Buat `tests/paktaPreviewLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  MIN_SIGNATURE_HEIGHT,
  computeScale,
  computeSignatureBox,
  fitFontSizeCss,
} from '../src/lib/paktaPreviewLayout';

describe('computeScale', () => {
  it('menghitung rasio containerWidth terhadap bgWidth', () => {
    expect(computeScale(400, 800)).toBe(0.5);
  });

  it('mengembalikan 1 bila bgWidth atau containerWidth <= 0 (nilai belum terukur)', () => {
    expect(computeScale(400, 0)).toBe(1);
    expect(computeScale(0, 800)).toBe(1);
  });
});

describe('computeSignatureBox', () => {
  it('tidak mengubah kotak bila tinggi hasil scale sudah >= MIN_SIGNATURE_HEIGHT', () => {
    const field = { x: 100, y: 100, lebar: 400, tinggi: 150 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 100, top: 100, width: 400, height: 150 });
  });

  it('membesarkan kotak secara proporsional & terpusat saat lebih kecil dari MIN_SIGNATURE_HEIGHT, tanpa perlu clamp', () => {
    // rawWidth=100, rawHeight=50 -> growFactor = 140/50 = 2.8 -> width=280, height=140
    // pusat asli: x=400+50=450, y=400+25=425 -> box baru terpusat di titik itu
    const field = { x: 400, y: 400, lebar: 100, tinggi: 50 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 310, top: 355, width: 280, height: 140 });
  });

  it('meng-clamp kotak yang membesar agar tidak keluar dari batas dokumen (mis. field dekat pojok kiri-atas)', () => {
    // rawWidth=100, rawHeight=50 -> growFactor=2.8 -> width=280, height=140
    // pusat asli (60,35) membuat box keluar batas kiri/atas -> di-clamp ke 0
    const field = { x: 10, y: 10, lebar: 100, tinggi: 50 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 0, top: 0, width: 280, height: 140 });
  });

  it('memakai lebar/2 sebagai tinggi default bila field.tinggi tidak diisi', () => {
    const field = { x: 0, y: 0, lebar: 300, tinggi: undefined };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    // rawHeight = 300/2 = 150 >= MIN_SIGNATURE_HEIGHT -> tidak membesar
    expect(box).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });

  it('mengekspor MIN_SIGNATURE_HEIGHT = 140', () => {
    expect(MIN_SIGNATURE_HEIGHT).toBe(140);
  });
});

describe('fitFontSizeCss', () => {
  it('mengecilkan ukuran font sampai teks muat dalam lebar field', () => {
    // Di jsdom, canvas 2d context tidak tersedia sehingga browserTextWidth() jatuh ke
    // afmFallback internal (text.length * size * 0.5). Untuk teks 10 karakter & lebar 100:
    // butuh size <= 20 supaya 10 * size * 0.5 <= 100.
    const field = { fontFamily: 'Inter', fontWeight: 'Regular' as const, ukuran: 32, lebar: 100 };
    const size = fitFontSizeCss('AAAAAAAAAA', field);
    expect(size).toBe(20);
  });

  it('tidak mengecilkan font bila teks sudah muat pada ukuran aslinya', () => {
    const field = { fontFamily: 'Inter', fontWeight: 'Regular' as const, ukuran: 10, lebar: 1000 };
    const size = fitFontSizeCss('Teks Pendek', field);
    expect(size).toBe(10);
  });

  it('tidak mengecilkan font di bawah 6px', () => {
    const field = { fontFamily: 'Inter', fontWeight: 'Regular' as const, ukuran: 32, lebar: 1 };
    const size = fitFontSizeCss('Teks yang sangat sangat panjang sekali', field);
    expect(size).toBe(6);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal (modul belum ada)**

Run: `npx vitest run tests/paktaPreviewLayout.test.ts`
Expected: FAIL dengan error module not found — `Cannot find module '../src/lib/paktaPreviewLayout'`.

- [ ] **Step 3: Tulis implementasi**

Buat `src/lib/paktaPreviewLayout.ts`:

```ts
import type { Field } from '../types';
import { browserTextWidth } from './pdfRenderer';

/** Tinggi minimum (px, sudah di-scale) kotak tanda tangan interaktif, supaya tetap
 *  nyaman digambar dengan jari di layar sempit meski field aslinya kecil. */
export const MIN_SIGNATURE_HEIGHT = 140;

/** scale = lebar kontainer / lebar natural background. 1 bila belum bisa diukur. */
export function computeScale(containerWidth: number, bgWidth: number): number {
  if (bgWidth <= 0 || containerWidth <= 0) return 1;
  return containerWidth / bgWidth;
}

export interface SignatureBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Kotak tanda tangan interaktif, hasil scale field 'tandaTangan' dengan batas
 * bawah ukuran MIN_SIGNATURE_HEIGHT. Bila kotak hasil scale lebih kecil dari batas,
 * kotak dibesarkan proporsional (mempertahankan rasio lebar:tinggi asli) dan
 * dipusatkan pada titik tengah kotak aslinya, lalu di-clamp agar tidak keluar
 * dari batas dokumen (mis. field yang dekat pojok kiri/atas).
 */
export function computeSignatureBox(
  field: Pick<Field, 'x' | 'y' | 'lebar' | 'tinggi'>,
  scale: number,
  bgWidth: number,
  bgHeight: number,
): SignatureBox {
  const rawWidth = field.lebar * scale;
  const rawHeight = (field.tinggi ?? field.lebar / 2) * scale;
  const rawLeft = field.x * scale;
  const rawTop = field.y * scale;

  const growFactor = rawHeight > 0 ? Math.max(1, MIN_SIGNATURE_HEIGHT / rawHeight) : 1;
  const width = rawWidth * growFactor;
  const height = rawHeight * growFactor;

  const centerX = rawLeft + rawWidth / 2;
  const centerY = rawTop + rawHeight / 2;

  const containerW = bgWidth * scale;
  const containerH = bgHeight * scale;

  const left = clamp(centerX - width / 2, 0, Math.max(0, containerW - width));
  const top = clamp(centerY - height / 2, 0, Math.max(0, containerH - height));

  return { left, top, width, height };
}

/** Kecilkan font sampai muat dalam field.lebar (min 6px), sama seperti fitFontSize
 *  di pdfRenderer.ts tapi untuk ukuran CSS yang sudah di-scale untuk layar. */
export function fitFontSizeCss(
  text: string,
  field: Pick<Field, 'fontFamily' | 'fontWeight' | 'ukuran' | 'lebar'>,
): number {
  let size = field.ukuran;
  while (
    size > 6 &&
    browserTextWidth(text, field.fontFamily, field.fontWeight, size, () => text.length * size * 0.5) >
      field.lebar
  ) {
    size -= 1;
  }
  return size;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/paktaPreviewLayout.test.ts`
Expected: semua test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paktaPreviewLayout.ts tests/paktaPreviewLayout.test.ts
git commit -m "feat(pakta): add pure layout helpers for realistic signing preview"
```

---

### Task 4: Perluas `SignaturePad.tsx` dengan mode "embedded"

**Kenapa:** Kanvas tanda tangan perlu menyatu transparan di atas gambar dokumen (bukan kotak putih berbingkai berdiri sendiri), dan tombol "Hapus" bawaannya perlu bisa disembunyikan karena `PaktaDocumentPreview` (Task 5) akan merender tombol clear-nya sendiri di posisi yang lebih pas (pojok kotak TTD).

**Files:**
- Modify: `src/components/pakta-signer/SignaturePad.tsx`
- Test: `tests/SignaturePad.test.tsx`

- [ ] **Step 1: Tulis test yang gagal (TDD)**

Buat `tests/SignaturePad.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { instances } = vi.hoisted(() => ({ instances: [] as unknown as MockSignaturePadInstance[] }));

interface MockSignaturePadInstance {
  canvas: HTMLCanvasElement;
  options: { backgroundColor?: string };
  listeners: Record<string, () => void>;
  clear: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
  toData: ReturnType<typeof vi.fn>;
  fromData: ReturnType<typeof vi.fn>;
}

vi.mock('signature_pad', () => {
  class MockSignaturePad implements MockSignaturePadInstance {
    canvas: HTMLCanvasElement;
    options: { backgroundColor?: string };
    listeners: Record<string, () => void> = {};
    clear = vi.fn();
    off = vi.fn();
    isEmpty = vi.fn(() => true);
    toDataURL = vi.fn(() => 'data:image/png;base64,mock');
    toData = vi.fn(() => []);
    fromData = vi.fn();
    constructor(canvas: HTMLCanvasElement, options: { backgroundColor?: string }) {
      this.canvas = canvas;
      this.options = options;
      instances.push(this);
    }
    addEventListener(event: string, cb: () => void) {
      this.listeners[event] = cb;
    }
  }
  return { default: MockSignaturePad };
});

import { SignaturePad } from '../src/components/pakta-signer/SignaturePad';

beforeEach(() => {
  instances.length = 0;
});

describe('SignaturePad', () => {
  it('menampilkan tombol "Hapus Tanda Tangan" secara default', () => {
    render(<SignaturePad />);
    expect(screen.getByRole('button', { name: 'Hapus Tanda Tangan' })).toBeInTheDocument();
  });

  it('menyembunyikan tombol "Hapus Tanda Tangan" saat hideClearButton diisi true', () => {
    render(<SignaturePad hideClearButton />);
    expect(screen.queryByRole('button', { name: 'Hapus Tanda Tangan' })).not.toBeInTheDocument();
  });

  it('memakai backgroundColor transparan saat transparent=true', () => {
    render(<SignaturePad transparent hideClearButton />);
    expect(instances[0].options.backgroundColor).toBe('rgba(255,255,255,0)');
  });

  it('memakai backgroundColor putih saat transparent tidak diisi', () => {
    render(<SignaturePad />);
    expect(instances[0].options.backgroundColor).toBe('#fff');
  });

  it('memanggil onStrokeBegin saat event beginStroke terjadi pada pad', () => {
    const onStrokeBegin = vi.fn();
    render(<SignaturePad onStrokeBegin={onStrokeBegin} />);
    instances[0].listeners.beginStroke();
    expect(onStrokeBegin).toHaveBeenCalledTimes(1);
  });

  it('memanggil pad.clear() saat tombol "Hapus Tanda Tangan" diklik', () => {
    render(<SignaturePad />);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus Tanda Tangan' }));
    expect(instances[0].clear).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/SignaturePad.test.tsx`
Expected: FAIL — `SignaturePad` belum menerima props `transparent`/`hideClearButton`/`onStrokeBegin`, jadi test transparansi & `onStrokeBegin` gagal (props diabaikan).

- [ ] **Step 3: Tulis implementasi**

Ganti seluruh isi `src/components/pakta-signer/SignaturePad.tsx` menjadi:

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

export interface SignaturePadProps {
  /** Kanvas transparan tanpa border putih, untuk menyatu di atas gambar dokumen. */
  transparent?: boolean;
  /** Sembunyikan tombol "Hapus Tanda Tangan" bawaan (dipakai saat parent merender tombolnya sendiri). */
  hideClearButton?: boolean;
  /** Dipanggil sekali saat stroke pertama dimulai. */
  onStrokeBegin?: () => void;
  /** Style tambahan untuk elemen <canvas>. */
  style?: CSSProperties;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { transparent = false, hideClearButton = false, onStrokeBegin, style },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onStrokeBeginRef = useRef(onStrokeBegin);
  onStrokeBeginRef.current = onStrokeBegin;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      minWidth: 1,
      maxWidth: 3,
      backgroundColor: transparent ? 'rgba(255,255,255,0)' : '#fff',
    });
    padRef.current = pad;
    pad.addEventListener('beginStroke', () => onStrokeBeginRef.current?.(), { once: true });

    function resizeCanvas() {
      if (!canvas || !padRef.current) return;
      const strokes = padRef.current.toData();
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current.clear();
      if (strokes.length > 0) padRef.current.fromData(strokes);
    }

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    return () => {
      observer.disconnect();
      pad.off();
    };
    // onStrokeBegin sengaja tidak masuk deps: dibaca lewat ref supaya pad tidak
    // dibuat ulang (dan tanda tangan yang sudah digambar tidak hilang) tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
    clear: () => padRef.current?.clear(),
  }));

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: transparent ? '100%' : 180,
          border: transparent ? 'none' : '1px solid var(--color-separator)',
          borderRadius: transparent ? 0 : 8,
          background: transparent ? 'transparent' : '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
          ...style,
        }}
      />
      {!hideClearButton && (
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button
            type="button"
            className="apple-btn apple-btn-secondary apple-btn-sm"
            onClick={() => padRef.current?.clear()}
          >
            Hapus Tanda Tangan
          </button>
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/SignaturePad.test.tsx`
Expected: semua test PASS.

- [ ] **Step 5: Jalankan seluruh suite untuk memastikan tidak ada regresi**

Run: `npx vitest run`
Expected: semua test PASS (termasuk test lama yang tidak menyentuh `SignaturePad`).

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-signer/SignaturePad.tsx tests/SignaturePad.test.tsx
git commit -m "feat(pakta): add embedded/transparent mode to SignaturePad"
```

---

### Task 5: Buat `PaktaDocumentPreview.tsx`

**Kenapa:** Komponen inti fitur ini — merender dokumen penuh (background + field terisi) dan kotak tanda tangan interaktif di posisi field `tandaTangan`, memakai fungsi murni dari Task 3 dan `SignaturePad` mode embedded dari Task 4.

**Files:**
- Create: `src/components/pakta-signer/PaktaDocumentPreview.tsx`
- Test: `tests/PaktaDocumentPreview.test.tsx`

- [ ] **Step 1: Tulis test yang gagal (TDD)**

Buat `tests/PaktaDocumentPreview.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import type { PaktaTemplate, FieldValues } from '../src/types';

vi.mock('../src/components/pakta-signer/SignaturePad', () => ({
  SignaturePad: forwardRef(function MockSignaturePad(
    props: { onStrokeBegin?: () => void },
    ref: React.Ref<{ isEmpty: () => boolean; toDataURL: () => string; clear: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({
      isEmpty: () => true,
      toDataURL: () => 'data:image/png;base64,mock',
      clear: vi.fn(),
    }));
    return <div data-testid="mock-signature-pad" onClick={() => props.onStrokeBegin?.()} />;
  }),
}));

import { PaktaDocumentPreview } from '../src/components/pakta-signer/PaktaDocumentPreview';

const template: PaktaTemplate = {
  background: 'data:image/png;base64,bg',
  bgWidth: 1000,
  bgHeight: 1000,
  fields: [
    {
      id: 'f1', tipe: 'jabatan', x: 50, y: 50, lebar: 300,
      fontFamily: 'Inter', fontWeight: 'Regular', ukuran: 24,
      warna: '#000000', perataan: 'left', formatter: 'none',
    },
    {
      id: 'f2', tipe: 'namaNip', x: 50, y: 120, lebar: 300,
      fontFamily: 'Inter', fontWeight: 'Regular', ukuran: 20,
      warna: '#000000', perataan: 'left', formatter: 'none',
    },
    {
      id: 'f3', tipe: 'tandaTangan', x: 400, y: 400, lebar: 100, tinggi: 50,
      fontFamily: 'Inter', fontWeight: 'Regular', ukuran: 16,
      warna: '#000000', perataan: 'left', formatter: 'none',
    },
  ],
};

const values: FieldValues = {
  nama: 'Budi Santoso',
  nip: '198001012020121001',
  jabatan: 'Kepala Balai',
};

beforeEach(() => vi.clearAllMocks());

describe('PaktaDocumentPreview', () => {
  it('merender field jabatan dan namaNip (nama bergaris bawah + baris NIP) dengan nilai asli', () => {
    render(<PaktaDocumentPreview template={template} values={values} />);
    expect(screen.getByText('Kepala Balai')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('NIP. 198001012020121001')).toBeInTheDocument();
  });

  it('tidak merender baris namaNip bila nilai nama kosong', () => {
    render(<PaktaDocumentPreview template={template} values={{ jabatan: 'Kepala Balai' }} />);
    expect(screen.queryByText('NIP. 198001012020121001')).not.toBeInTheDocument();
  });

  it('tidak merender field bertipe lain bila nilainya kosong', () => {
    render(<PaktaDocumentPreview template={template} values={{ nama: 'Budi Santoso', nip: '123' }} />);
    expect(screen.queryByText('Kepala Balai')).not.toBeInTheDocument();
  });

  it('menampilkan hint "Tanda tangan di sini" sebelum menggambar, dan menyembunyikannya setelah stroke pertama', () => {
    render(<PaktaDocumentPreview template={template} values={values} />);
    expect(screen.getByText('Tanda tangan di sini')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-signature-pad'));
    expect(screen.queryByText('Tanda tangan di sini')).not.toBeInTheDocument();
  });

  it('menampilkan tombol "Hapus Tanda Tangan" hanya setelah ada tanda tangan', () => {
    render(<PaktaDocumentPreview template={template} values={values} />);
    expect(screen.queryByRole('button', { name: 'Hapus Tanda Tangan' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-signature-pad'));
    expect(screen.getByRole('button', { name: 'Hapus Tanda Tangan' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/PaktaDocumentPreview.test.tsx`
Expected: FAIL dengan error module not found — `Cannot find module '../src/components/pakta-signer/PaktaDocumentPreview'`.

- [ ] **Step 3: Tulis implementasi**

Buat `src/components/pakta-signer/PaktaDocumentPreview.tsx`:

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import type { Field, FieldValues, PaktaTemplate } from '../../types';
import { WEIGHT_CSS } from '../../lib/fontRegistry';
import { computeScale, computeSignatureBox, fitFontSizeCss } from '../../lib/paktaPreviewLayout';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

function textStyle(field: Field, scale: number, text: string): CSSProperties {
  const { weight, italic } = WEIGHT_CSS[field.fontWeight];
  const size = fitFontSizeCss(text, {
    fontFamily: field.fontFamily,
    fontWeight: field.fontWeight,
    ukuran: field.ukuran * scale,
    lebar: field.lebar * scale,
  });
  return {
    fontFamily: `"${field.fontFamily}"`,
    fontWeight: weight,
    fontStyle: italic ? 'italic' : 'normal',
    fontSize: size,
    color: field.warna,
  };
}

/** Field teks biasa (nama, nip, jabatan, tanggal, dst) — satu baris.
 *  formatter (mis. uppercase) sengaja tidak diterapkan: pdfRenderer.ts juga tidak
 *  menerapkannya untuk Pakta, supaya preview identik dengan PDF akhir. */
function TextFieldOverlay({ field, scale, text }: { field: Field; scale: number; text: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: field.x * scale,
        top: field.y * scale,
        width: field.lebar * scale,
        textAlign: field.perataan,
      }}
    >
      <span style={textStyle(field, scale, text)}>{text}</span>
    </div>
  );
}

/** Field gabungan Nama & NIP: baris nama bergaris bawah, lalu "NIP. <nip>" di bawahnya. */
function NamaNipOverlay({ field, scale, nama, nip }: { field: Field; scale: number; nama: string; nip: string }) {
  if (!nama) return null;
  const lineHeight = field.ukuran * scale * 1.4;
  const nipText = `NIP. ${nip}`;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: field.x * scale,
          top: field.y * scale,
          width: field.lebar * scale,
          textAlign: field.perataan,
        }}
      >
        <span style={{ ...textStyle(field, scale, nama), textDecoration: 'underline' }}>{nama}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: field.x * scale,
          top: field.y * scale + lineHeight,
          width: field.lebar * scale,
          textAlign: field.perataan,
        }}
      >
        <span style={textStyle(field, scale, nipText)}>{nipText}</span>
      </div>
    </>
  );
}

export interface PaktaDocumentPreviewProps {
  template: PaktaTemplate;
  values: FieldValues;
}

export const PaktaDocumentPreview = forwardRef<SignaturePadHandle, PaktaDocumentPreviewProps>(
  function PaktaDocumentPreview({ template, values }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const innerSigRef = useRef<SignaturePadHandle>(null);
    const [scale, setScale] = useState(1);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      function update() {
        const width = el!.offsetWidth;
        setScale(width > 0 ? computeScale(width, template.bgWidth) : 1);
      }
      const observer = new ResizeObserver(update);
      observer.observe(el);
      update();
      return () => observer.disconnect();
    }, [template.bgWidth]);

    useImperativeHandle(ref, () => ({
      isEmpty: () => innerSigRef.current?.isEmpty() ?? true,
      toDataURL: () => innerSigRef.current?.toDataURL() ?? '',
      clear: () => {
        innerSigRef.current?.clear();
        setHasSignature(false);
      },
    }));

    const sigField = template.fields.find(f => f.tipe === 'tandaTangan');
    const sigBox = sigField ? computeSignatureBox(sigField, scale, template.bgWidth, template.bgHeight) : null;

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        <img
          src={template.background}
          alt="Pratinjau dokumen Pakta Integritas"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />

        {template.fields.map(field => {
          if (field.tipe === 'tandaTangan') return null;
          if (field.tipe === 'namaNip') {
            return (
              <NamaNipOverlay
                key={field.id}
                field={field}
                scale={scale}
                nama={(values.nama ?? '').toString()}
                nip={(values.nip ?? '').toString()}
              />
            );
          }
          return (
            <TextFieldOverlay
              key={field.id}
              field={field}
              scale={scale}
              text={(values[field.tipe] ?? '').toString()}
            />
          );
        })}

        {sigBox && (
          <div
            style={{
              position: 'absolute',
              left: sigBox.left,
              top: sigBox.top,
              width: sigBox.width,
              height: sigBox.height,
              border: hasSignature ? 'none' : '1px dashed var(--color-separator)',
              borderRadius: 8,
            }}
          >
            <SignaturePad
              ref={innerSigRef}
              transparent
              hideClearButton
              onStrokeBegin={() => setHasSignature(true)}
            />
            {!hasSignature && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: 'var(--color-ink-faint)',
                  pointerEvents: 'none',
                }}
              >
                Tanda tangan di sini
              </span>
            )}
            {hasSignature && (
              <button
                type="button"
                className="apple-btn apple-btn-secondary apple-btn-sm"
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 4,
                  background: 'rgba(255,255,255,0.85)',
                }}
                onClick={() => {
                  innerSigRef.current?.clear();
                  setHasSignature(false);
                }}
              >
                Hapus Tanda Tangan
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/PaktaDocumentPreview.test.tsx`
Expected: semua test PASS.

- [ ] **Step 5: Jalankan seluruh suite untuk memastikan tidak ada regresi**

Run: `npx vitest run`
Expected: semua test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-signer/PaktaDocumentPreview.tsx tests/PaktaDocumentPreview.test.tsx
git commit -m "feat(pakta): add PaktaDocumentPreview for realistic signing preview"
```

---

### Task 6: Pasang `PaktaDocumentPreview` di step `signing` — `PaktaSignPage.tsx`

**Kenapa:** Ini langkah yang benar-benar mengubah pengalaman user — mengganti kartu ringkasan teks + kotak TTD terpisah dengan dokumen penuh yang bisa ditandatangani langsung. Tidak ada test otomatis baru di sini (lihat "Catatan cakupan test" di atas) — diverifikasi manual di Task 7.

**Files:**
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx:1-6` (imports)
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx:247-289` (step `signing`)

- [ ] **Step 1: Tambahkan import `PaktaDocumentPreview`**

Baris 1-6 saat ini:
```tsx
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, PaktaTemplate } from '../../types';
import { getAcaraByLink, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
import { renderPakta } from '../../lib/pdfRenderer';
import { matchesSignerQuery } from '../../lib/signerFilter';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
```

Ganti menjadi:
```tsx
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, PaktaTemplate } from '../../types';
import { getAcaraByLink, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
import { renderPakta } from '../../lib/pdfRenderer';
import { matchesSignerQuery } from '../../lib/signerFilter';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { PaktaDocumentPreview } from './PaktaDocumentPreview';
```

- [ ] **Step 2: Ganti isi blok `if (state.step === 'signing')`**

Blok saat ini (baris 247-289):
```tsx
  if (state.step === 'signing') {
    const { template, signer } = state;
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <button
            className="apple-btn apple-btn-secondary apple-btn-sm"
            style={{ marginBottom: 20 }}
            onClick={() => setLoadKey(k => k + 1)}
          >
            ← Pilih Nama Lain
          </button>

          <div className="apple-card" style={{ marginBottom: 20 }}>
            <h2 className="apple-h2" style={{ marginBottom: 4 }}>{template.nama}</h2>
            <p style={{ color: 'var(--color-ink-faint)', fontSize: 13 }}>
              {signer.nama}
              {signer.nip ? ` — ${signer.nip}` : ''}
              {signer.jabatan ? ` — ${signer.jabatan}` : ''}
            </p>
          </div>

          <div className="apple-card" style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
              Tanda Tangan Anda
            </p>
            <p style={{ color: 'var(--color-ink-faint)', fontSize: 12, marginBottom: 12 }}>
              Gambar tanda tangan di kotak di bawah ini menggunakan jari atau mouse.
            </p>
            <SignaturePad ref={sigPadRef} />
          </div>

          <button
            className="apple-btn apple-btn-primary"
            style={{ width: '100%' }}
            onClick={handleSubmit}
          >
            Kirim Tanda Tangan
          </button>
        </div>
      </div>
    );
  }
```

Ganti menjadi:
```tsx
  if (state.step === 'signing') {
    const { template, signer, backgroundDataUrl } = state;
    const values: FieldValues = {
      nama: signer.nama,
      nip: signer.nip,
      jabatan: signer.jabatan,
      tanggal: template.tanggal,
    };
    const previewTemplate: PaktaTemplate = { ...template, background: backgroundDataUrl };
    const hasSigField = template.fields.some(f => f.tipe === 'tandaTangan');

    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <button
            className="apple-btn apple-btn-secondary apple-btn-sm"
            style={{ marginBottom: 20 }}
            onClick={() => setLoadKey(k => k + 1)}
          >
            ← Pilih Nama Lain
          </button>

          <div
            style={{
              position: 'relative',
              marginBottom: 20,
              borderRadius: 'var(--apple-radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <PaktaDocumentPreview
              ref={hasSigField ? sigPadRef : undefined}
              template={previewTemplate}
              values={values}
            />
          </div>

          {!hasSigField && (
            <div className="apple-card" style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--color-ink-faint)', fontSize: 12, marginBottom: 12 }}>
                Template ini belum memiliki area tanda tangan yang ditentukan. Gambar tanda tangan Anda di kotak berikut.
              </p>
              <SignaturePad ref={sigPadRef} />
            </div>
          )}

          <button
            className="apple-btn apple-btn-primary"
            style={{ width: '100%' }}
            onClick={handleSubmit}
          >
            Kirim Tanda Tangan
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Periksa tipe (TypeScript)**

Run: `npx tsc -b --noEmit`
Expected: tidak ada error tipe baru terkait `PaktaSignPage.tsx` atau `PaktaDocumentPreview.tsx`.

- [ ] **Step 4: Jalankan seluruh test suite**

Run: `npx vitest run`
Expected: semua test PASS (tidak ada test yang menyentuh `PaktaSignPage.tsx` secara langsung, jadi tidak ada test baru di sini — lihat "Catatan cakupan test").

- [ ] **Step 5: Commit**

```bash
git add src/components/pakta-signer/PaktaSignPage.tsx
git commit -m "feat(pakta): render full document with signature overlay in signing step"
```

---

### Task 7: Verifikasi manual end-to-end + validasi penuh

**Kenapa:** `PaktaSignPage.tsx` tidak punya test otomatis (lihat catatan di atas), dan bagian Testing di spec eksplisit meminta verifikasi manual untuk memastikan posisi field & kotak TTD presisi dibandingkan PDF asli, shrink-to-fit nama panjang, tombol hapus, dan fallback template tanpa field TTD.

**Files:** tidak ada perubahan kode — verifikasi saja.

- [ ] **Step 1: Jalankan validasi penuh**

Run:
```bash
npm run build
npm run lint
npx vitest run
```
Expected: build sukses, tidak ada error lint baru (nyatakan jujur bila ada warning — jangan bilang "clean" kecuali nol warning), semua test PASS.

- [ ] **Step 2: Verifikasi manual di browser — desktop**

Jalankan `npm run dev`, buka halaman `/pakta/{slug}` untuk sebuah acara aktif yang punya template dengan field `nama`/`nip`/`jabatan`/`namaNip`/`tandaTangan`. Pilih nama, lalu periksa:
- Dokumen background tampil penuh dengan field-field terisi data asli, posisinya presisi (bandingkan dengan hasil PDF setelah submit).
- Kotak TTD punya border dashed + label "Tanda tangan di sini" sebelum digambar.
- Setelah digambar, hint hilang dan tombol "Hapus Tanda Tangan" muncul di pojok kanan-bawah kotak TTD.
- Klik "Hapus Tanda Tangan" → kanvas kosong, hint muncul kembali.
- Klik "Kirim Tanda Tangan" → alur submit tetap berfungsi seperti sebelumnya (upload, simpan status, unduh PDF).

- [ ] **Step 3: Verifikasi manual di browser — mobile (375px)**

Resize viewport ke 375px (atau device toolbar Chrome DevTools). Periksa:
- Dokumen fit ke lebar layar tanpa perlu zoom.
- Kotak TTD tidak terlalu kecil untuk digambar dengan jari/mouse (bandingkan dengan `MIN_SIGNATURE_HEIGHT = 140px` di Task 3) — tidak sekecil hasil scale field aslinya bila template punya field TTD kecil.
- Nama panjang (mis. dengan gelar, > 30 karakter) tidak overflow keluar field — font mengecil otomatis.

- [ ] **Step 4: Verifikasi fallback template tanpa field `tandaTangan`**

Bila ada (atau buat sementara di admin) template yang belum punya field `tandaTangan`, buka halaman tanda tangannya dan pastikan muncul pesan "Template ini belum memiliki area tanda tangan..." dengan kotak tanda tangan standalone di bawah dokumen, dan submit tetap berfungsi.

- [ ] **Step 5: Update `docs/agent-handoff.md`**

Isi sesuai format yang diwajibkan `AGENTS.md` (branch, task, file yang diubah, command yang dijalankan, hasil build/lint/test, known issues, next step). Nyatakan status commit/push apa adanya (belum di-push kecuali user eksplisit minta).

- [ ] **Step 6: Commit dokumentasi handoff (bila ada perubahan)**

```bash
git add docs/agent-handoff.md
git commit -m "docs: update agent handoff for realistic signing preview"
```
