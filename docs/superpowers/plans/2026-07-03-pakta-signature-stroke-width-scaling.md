# Kompensasi Lebar Goresan Tanda Tangan (`strokeScale`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lebar goresan tanda tangan (`minWidth`/`maxWidth` di `signature_pad`) dikalikan `scale` layar-ke-dokumen supaya lebar goresan FINAL setelah di-embed ke PDF selalu konsisten di semua device — menghilangkan efek "goresan terlalu tebal" di mobile.

**Architecture:** Prop baru `strokeScale` di `SignaturePad` (default `1`, tidak mengubah perilaku standalone). `PaktaDocumentPreview` meneruskan `scale` yang sudah dihitungnya sendiri ke prop ini saat merender `SignaturePad` yang di-embed ke field TTD. `minWidth`/`maxWidth` di-set ulang lewat efek terpisah yang memutasi instance `signature_pad` yang sudah ada (bukan membuat ulang), supaya goresan yang sedang digambar tidak hilang saat `scale` berubah (mis. resize kontainer).

**Tech Stack:** TypeScript, React, `signature_pad`, Vitest + `@testing-library/react`, verifikasi manual browser (`preview_*` tools) untuk konfirmasi visual akhir.

**Referensi:** `docs/superpowers/specs/2026-07-03-pakta-signature-stroke-width-scaling-design.md`

---

### Task 1: Prop `strokeScale` di `SignaturePad` + teruskan dari `PaktaDocumentPreview`

**Files:**
- Modify: `tests/SignaturePad.test.tsx` (mock `MockSignaturePadInstance`/`MockSignaturePad`, tambah 3 test baru)
- Modify: `src/components/pakta-signer/SignaturePad.tsx` (prop `strokeScale`, konstanta `BASE_MIN_WIDTH`/`BASE_MAX_WIDTH`, efek mutasi)
- Modify: `src/components/pakta-signer/PaktaDocumentPreview.tsx:166-171` (teruskan `strokeScale={scale}`)

Context penting: mock `signature_pad` saat ini (`tests/SignaturePad.test.tsx`) HANYA meng-capture `options` mentah di constructor (`this.options = options`), TIDAK meng-capture `minWidth`/`maxWidth` sebagai instance property terpisah. Karena implementasi baru akan MEMUTASI instance property `pad.minWidth`/`pad.maxWidth` langsung (bukan lewat `options`), mock ini WAJIB diperbarui dulu supaya test bisa membaca nilai SETELAH mutasi — kalau tidak, test tidak akan bisa membedakan "constructor dipanggil dengan nilai benar" dari "mutasi berikutnya benar-benar terjadi".

- [ ] **Step 1: Update mock `signature_pad` & tulis 3 test baru (RED untuk 2 dari 3)**

Di `tests/SignaturePad.test.tsx`, ganti interface `MockSignaturePadInstance` (baris 6-17 saat ini) dari:

```ts
interface MockSignaturePadInstance {
  canvas: HTMLCanvasElement;
  options: { backgroundColor?: string };
  listeners: Record<string, { cb: () => void; once: boolean }>;
  clear: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
  toData: ReturnType<typeof vi.fn>;
  fromData: ReturnType<typeof vi.fn>;
  dispatch: (event: string) => void;
}
```

menjadi:

```ts
interface MockSignaturePadInstance {
  canvas: HTMLCanvasElement;
  options: { backgroundColor?: string; minWidth?: number; maxWidth?: number };
  minWidth: number;
  maxWidth: number;
  listeners: Record<string, { cb: () => void; once: boolean }>;
  clear: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
  toData: ReturnType<typeof vi.fn>;
  fromData: ReturnType<typeof vi.fn>;
  dispatch: (event: string) => void;
}
```

Lalu ganti class `MockSignaturePad` di dalam `vi.mock('signature_pad', ...)` (baris 20-44 saat ini) dari:

```ts
  class MockSignaturePad implements MockSignaturePadInstance {
    canvas: HTMLCanvasElement;
    options: { backgroundColor?: string };
    listeners: Record<string, { cb: () => void; once: boolean }> = {};
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
```

menjadi:

```ts
  class MockSignaturePad implements MockSignaturePadInstance {
    canvas: HTMLCanvasElement;
    options: { backgroundColor?: string; minWidth?: number; maxWidth?: number };
    minWidth: number;
    maxWidth: number;
    listeners: Record<string, { cb: () => void; once: boolean }> = {};
    clear = vi.fn();
    off = vi.fn();
    isEmpty = vi.fn(() => true);
    toDataURL = vi.fn(() => 'data:image/png;base64,mock');
    toData = vi.fn(() => []);
    fromData = vi.fn();
    constructor(canvas: HTMLCanvasElement, options: { backgroundColor?: string; minWidth?: number; maxWidth?: number }) {
      this.canvas = canvas;
      this.options = options;
      this.minWidth = options.minWidth ?? 0;
      this.maxWidth = options.maxWidth ?? 0;
      instances.push(this);
    }
```

(Bagian `addEventListener`/`dispatch` di bawahnya TIDAK berubah.)

Lalu tambah 3 test baru persis setelah test `'memakai backgroundColor putih saat transparent tidak diisi'` (sebelum test `'memanggil onStrokeBegin saat event beginStroke terjadi pada pad'`) di `describe('SignaturePad', ...)`:

```ts
  it('memakai minWidth=1, maxWidth=3 sebagai default saat strokeScale tidak diisi', () => {
    render(<SignaturePad />);
    expect(instances[0].options.minWidth).toBe(1);
    expect(instances[0].options.maxWidth).toBe(3);
  });

  it('mengalikan minWidth/maxWidth dengan strokeScale saat diisi', () => {
    render(<SignaturePad strokeScale={0.3} />);
    expect(instances[0].options.minWidth).toBe(0.3);
    expect(instances[0].options.maxWidth).toBeCloseTo(0.9);
  });

  it('memutasi minWidth/maxWidth pada instance yang sama saat strokeScale berubah, tanpa membuat instance baru', () => {
    const { rerender } = render(<SignaturePad strokeScale={1} />);
    expect(instances.length).toBe(1);
    rerender(<SignaturePad strokeScale={0.5} />);
    expect(instances.length).toBe(1);
    expect(instances[0].minWidth).toBe(0.5);
    expect(instances[0].maxWidth).toBeCloseTo(1.5);
  });
```

- [ ] **Step 2: Jalankan test untuk konfirmasi hasil sesuai ekspektasi**

Run: `npx vitest run tests/SignaturePad.test.tsx`

Expected:
- `'memakai minWidth=1, maxWidth=3 sebagai default...'` → **PASS** (kode saat ini memang selalu memakai `minWidth:1, maxWidth:3` secara hardcode di constructor, jadi ini SUDAH benar sebelum fix — test ini berfungsi sebagai regression guard, bukan RED case).
- `'mengalikan minWidth/maxWidth dengan strokeScale...'` → **FAIL** (kode saat ini mengabaikan prop `strokeScale` yang belum ada di `SignaturePadProps` — constructor tetap memakai `1`/`3` hardcode, bukan `0.3`/`0.9`).
- `'memutasi minWidth/maxWidth pada instance yang sama...'` → **FAIL** (belum ada efek yang memutasi `pad.minWidth`/`maxWidth` saat prop berubah — nilainya tetap `1` dari constructor awal, bukan `0.5`).

**Jangan jalankan `npm run build` di titik ini** — `SignaturePadProps` belum punya field `strokeScale`, jadi pemanggilan `<SignaturePad strokeScale={...} />` di test akan gagal type-check (`tsc`) walau tetap bisa dijalankan `vitest` (transform esbuild tidak strict type-check). Build baru dijalankan setelah Step 3.

Kalau hasil actual berbeda dari penjelasan di atas, STOP dan re-periksa sebelum lanjut ke Step 3.

- [ ] **Step 3: Implementasi `strokeScale` di `SignaturePad.tsx`**

Di `src/components/pakta-signer/SignaturePad.tsx`, ganti baris 1-19 (import sampai akhir interface `SignaturePadProps`) dari:

```ts
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
```

menjadi:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

/** Target lebar goresan FINAL (satuan dokumen/PDF-point), independen dari device/scale.
 *  Sama seperti minWidth/maxWidth statis yang dipakai sebelum ada strokeScale -- supaya
 *  tampilan saat strokeScale=1 (default, mode standalone) tidak berubah sama sekali.
 *  Dikalikan `strokeScale` (scale layar-ke-dokumen dari PaktaDocumentPreview) supaya lebar
 *  goresan yang di-embed ke PDF (dibagi scale yang sama saat scaleToFit) selalu konsisten
 *  ke target ini di semua device -- lihat docs/superpowers/specs/2026-07-03-pakta-signature-stroke-width-scaling-design.md. */
const BASE_MIN_WIDTH = 1;
const BASE_MAX_WIDTH = 3;

export interface SignaturePadProps {
  /** Kanvas transparan tanpa border putih, untuk menyatu di atas gambar dokumen. */
  transparent?: boolean;
  /** Sembunyikan tombol "Hapus Tanda Tangan" bawaan (dipakai saat parent merender tombolnya sendiri). */
  hideClearButton?: boolean;
  /** Dipanggil sekali saat stroke pertama dimulai. */
  onStrokeBegin?: () => void;
  /** Style tambahan untuk elemen <canvas>. */
  style?: CSSProperties;
  /** Faktor scale layar-ke-dokumen (dari computeScale di PaktaDocumentPreview) -- lebar
   *  goresan (minWidth/maxWidth) dikalikan nilai ini supaya lebar goresan FINAL setelah
   *  di-embed ke PDF (yang membagi balik dengan scale yang sama lewat scaleToFit) tetap
   *  konsisten di semua device, tidak makin tebal di kotak kecil (mobile). Default 1
   *  (tidak ada kompensasi) -- dipakai di mode standalone (PaktaSignPage.tsx, saat
   *  template belum punya field tandaTangan) yang tidak pernah di-embed lewat field
   *  manapun, jadi tidak ada faktor scale untuk dikompensasi. */
  strokeScale?: number;
}
```

Lalu, di dalam komponen, ganti baris `{ transparent = false, hideClearButton = false, onStrokeBegin, style },` (parameter destructuring fungsi komponen) menjadi:

```ts
  { transparent = false, hideClearButton = false, onStrokeBegin, style, strokeScale = 1 },
```

Lalu ganti pembuatan `SignaturePadLib` (baris berikut di dalam `useEffect` pertama):

```ts
    const pad = new SignaturePadLib(canvas, {
      minWidth: 1,
      maxWidth: 3,
      backgroundColor: transparent ? 'rgba(255,255,255,0)' : '#fff',
    });
```

menjadi:

```ts
    const pad = new SignaturePadLib(canvas, {
      minWidth: BASE_MIN_WIDTH * strokeScale,
      maxWidth: BASE_MAX_WIDTH * strokeScale,
      backgroundColor: transparent ? 'rgba(255,255,255,0)' : '#fff',
    });
```

Update juga komentar eslint-disable tepat di atas `}, [transparent]);` (penutup `useEffect` pertama) dari:

```ts
    // onStrokeBegin sengaja tidak masuk deps: dibaca lewat ref supaya pad tidak
    // dibuat ulang (dan tanda tangan yang sudah digambar tidak hilang) tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent]);
```

menjadi:

```ts
    // onStrokeBegin & strokeScale sengaja tidak masuk deps: pad tidak boleh dibuat ulang
    // (dan tanda tangan yang sudah digambar tidak hilang) tiap render -- onStrokeBegin
    // dibaca lewat ref, strokeScale diterapkan lewat efek terpisah di bawah (memutasi
    // properti pad langsung, bukan re-create instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent]);
```

Lalu tambah efek BARU tepat SETELAH `}, [transparent]);` (penutup `useEffect` pertama) dan SEBELUM `useImperativeHandle(ref, () => ({`:

```ts

  // Terapkan strokeScale ke pad yang SUDAH ada (mutasi properti minWidth/maxWidth
  // langsung -- signature_pad mendukung ini tanpa perlu re-create instance), supaya
  // perubahan scale (mis. resize kontainer) tidak menghapus goresan yang sedang digambar.
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.minWidth = BASE_MIN_WIDTH * strokeScale;
    pad.maxWidth = BASE_MAX_WIDTH * strokeScale;
  }, [strokeScale]);
```

- [ ] **Step 4: Teruskan `strokeScale={scale}` dari `PaktaDocumentPreview.tsx`**

Di `src/components/pakta-signer/PaktaDocumentPreview.tsx`, ganti (baris 166-171 saat ini):

```tsx
            <SignaturePad
              ref={innerSigRef}
              transparent
              hideClearButton
              onStrokeBegin={() => setHasSignature(true)}
            />
```

menjadi:

```tsx
            <SignaturePad
              ref={innerSigRef}
              transparent
              hideClearButton
              onStrokeBegin={() => setHasSignature(true)}
              strokeScale={scale}
            />
```

- [ ] **Step 5: Jalankan test untuk konfirmasi semua lolos**

Run: `npx vitest run tests/SignaturePad.test.tsx`

Expected: semua test di file ini **PASS**, termasuk 3 test dari Step 1.

- [ ] **Step 6: Jalankan seluruh test suite & build untuk pastikan tidak ada regresi**

Run: `npm run test`

Expected: semua 22 file test **PASS** (khususnya `tests/PaktaDocumentPreview.test.tsx` — mock `SignaturePad` di file itu mengetik parameter `props` secara longgar/`{ onStrokeBegin?: () => void }` dan tidak membaca prop lain, jadi prop baru `strokeScale` yang diteruskan dari `PaktaDocumentPreview.tsx` akan diabaikan mock ini tanpa error, TIDAK perlu diubah).

Run: `npm run build`

Expected: `tsc -b && vite build` selesai TANPA ERROR.

- [ ] **Step 7: Verifikasi manual di browser sungguhan (WAJIB — konfirmasi visual, bukan cuma angka)**

Task ini TIDAK boleh dianggap selesai hanya dari Step 5-6 lolos — itu membuktikan logic & tidak ada regresi, BUKAN membuktikan goresan SUNGGUH terlihat tipis secara visual di mobile.

Gunakan `preview_*` tools (server dev via `preview_start`, viewport mobile via `preview_resize`) dengan harness sementara yang me-render `PaktaDocumentPreview` di dalam wrapper CSS produksi (`apple-page`/`apple-page-compact`, seperti pola verifikasi sebelumnya di sesi ini), pakai field TTD rasio default editor (`lebar: 600, tinggi: 240` pada `bgWidth: 1000`, ATAU `bgWidth` lebih besar seperti `2000` untuk skenario template resolusi tinggi yang faktor pembesarannya lebih ekstrem). Harness sementara ini TIDAK dikomit — buat, verifikasi, lalu `git checkout -- <file yang diubah untuk harness>` setelah selesai.

Langkah verifikasi:
1. Gambar tanda tangan sederhana (`PointerEvent` sintetis dengan delay antar-event, pola yang sudah dipakai di verifikasi-verifikasi sebelumnya di sesi ini) di viewport mobile (mis. 375px atau 390px).
2. Ambil screenshot (`preview_screenshot`) area kotak TTD — goresan harus terlihat tipis/wajar, TIDAK tebal/blok seperti sebelum fix.
3. Render lewat `renderPakta` sungguhan (impor `renderPakta` dari `../lib/pdfRenderer`), panggil dengan template + tangkapan tanda tangan asli, decode PNG hasil embed (atau load hasil PDF ke `<img>`/canvas untuk screenshot) — pastikan goresan di hasil PDF JUGA terlihat tipis/wajar secara visual, bukan cuma diverifikasi lewat angka `cm` operator.

Kalau goresan MASIH terlihat tebal secara visual di salah satu langkah, STOP — fix belum benar, jangan lanjut ke Step 8.

- [ ] **Step 8: Commit**

```bash
git add tests/SignaturePad.test.tsx src/components/pakta-signer/SignaturePad.tsx src/components/pakta-signer/PaktaDocumentPreview.tsx
git commit -m "fix(pakta): kompensasi lebar goresan tanda tangan dengan strokeScale

SignaturePad sebelumnya memakai minWidth=1, maxWidth=3 (CSS piksel) tetap,
independen dari scale layar-ke-dokumen. Setelah PR #35 (kotak TTD persis
ukuran field, tanpa minimum lagi), kotak capture di mobile jadi jauh
lebih kecil secara absolut -- diverifikasi matematis: lebar goresan
FINAL setelah di-embed ke PDF = W_css / scale (dpr terbukti saling
meniadakan dari perhitungan). Untuk scale khas mobile (~0.1-0.4), faktor
1/scale bisa 2.5x-10x, membuat goresan yang dulu pas jadi terlalu tebal
-- baik di preview (lebih dominan relatif ke kotak kecil) maupun output
PDF (di-scale-up proporsional).

Fix: tambah prop strokeScale (default 1) ke SignaturePad, minWidth/
maxWidth dikalikan nilai ini. PaktaDocumentPreview meneruskan scale yang
sudah dihitungnya sendiri. Target kalibrasi (1/3) sudah ada, tidak perlu
ditebak ulang -- tinggal diterapkan konsisten di semua device alih-alih
cuma 'kebetulan pas' di desktop seperti sekarang (yang berarti goresan
desktop akan sedikit lebih tipis dari sekarang -- trade-off yang
disetujui demi konsistensi lebar goresan final yang presisi).

Mode standalone (PaktaSignPage.tsx, saat template belum punya field
tandaTangan) tidak berubah -- default strokeScale=1 berlaku karena
signature di jalur itu tidak pernah di-embed lewat field manapun.

Diverifikasi: npm run test (22 file, semua PASS termasuk 3 test baru),
npm run build (PASS), dan manual di browser mobile viewport sungguhan --
goresan terlihat tipis/wajar secara visual, di preview maupun hasil PDF.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Catatan untuk Controller (bukan bagian task subagent)

Step 7 (verifikasi manual browser) memerlukan `preview_*` tools yang HANYA tersedia di sesi controller (bukan di subagent implementer biasa). Kalau task ini dijalankan lewat `subagent-driven-development`, controller perlu:
1. Membiarkan implementer subagent menyelesaikan Step 1-6 dan Step 8 (commit), MELEWATI Step 7 dengan melaporkannya sebagai `DONE_WITH_CONCERNS` (concern: "Step 7 verifikasi manual browser memerlukan preview_* tools yang tidak tersedia untuk subagent — perlu dilakukan controller setelah commit").
2. Controller sendiri menjalankan Step 7 SETELAH implementer commit, SEBELUM task dianggap benar-benar selesai dan sebelum task reviewer di-dispatch (atau sertakan hasil verifikasi manual controller sebagai bagian dari bukti yang diberikan ke task reviewer).
