# Custom Font System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti 3 Standard PDF Fonts dengan 10 Google Fonts custom (Regular/Bold/Italic/BoldItalic) yang konsisten di preview Konva.js dan output PDF melalui pdf-lib + fontkit.

**Architecture:** Font TTF di-bundle di `public/fonts/`, di-embed ke PDF via `@pdf-lib/fontkit`, dan di-render di preview Konva via Google Fonts CSS. Field `font` di `types.ts` diganti dua field: `fontFamily: string` dan `fontWeight: FontWeight`. Semua file yang memakai `field.font` diupdate dalam urutan: types → registry → pdfRenderer → EditorCanvas → CertPreviewMini → CertificateEditor → FieldProperties → tests.

**Tech Stack:** React, Konva.js (react-konva), pdf-lib ^1.17.1, @pdf-lib/fontkit (baru), @fontsource/* (devDependency untuk unduh TTF), Vitest

---

## File Map

| File | Aksi |
|------|------|
| `src/lib/fontRegistry.ts` | **Buat baru** — konstanta FONT_FAMILIES, FONT_WEIGHTS, FontWeight type |
| `src/types.ts` | **Ubah** — hapus `font`, tambah `fontFamily` + `fontWeight` |
| `src/lib/pdfRenderer.ts` | **Ubah** — gunakan fontkit, fetch TTF, embed dengan subset |
| `src/components/editor/EditorCanvas.tsx` | **Ubah** — `fontFamily={f.fontFamily}` + `fontStyle` helper |
| `src/components/generate/CertPreviewMini.tsx` | **Ubah** — sama seperti EditorCanvas |
| `src/components/editor/CertificateEditor.tsx` | **Ubah** — default field dari `font:'Helvetica'` ke `fontFamily/fontWeight` |
| `src/components/editor/FieldProperties.tsx` | **Ubah** — dua dropdown menggantikan satu |
| `index.html` | **Ubah** — tambah Google Fonts `<link>` |
| `public/fonts/*.ttf` | **Buat baru** — ~36 file TTF via script |
| `scripts/copy-fonts.mjs` | **Buat baru** — script salin TTF dari @fontsource |
| `tests/pdfRenderer.test.ts` | **Ubah** — update fixture ke shape Field baru |
| `package.json` | **Ubah** — tambah @pdf-lib/fontkit + @fontsource/* devDeps |

---

## Task 1: Install @pdf-lib/fontkit dan @fontsource devDependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @pdf-lib/fontkit sebagai runtime dependency**

```bash
npm install @pdf-lib/fontkit
```

Expected output: `added 1 package` (atau serupa)

- [ ] **Step 2: Install @fontsource packages sebagai devDependency**

```bash
npm install --save-dev \
  @fontsource/playfair-display \
  @fontsource/eb-garamond \
  @fontsource/cinzel \
  @fontsource/merriweather \
  @fontsource/lato \
  @fontsource/montserrat \
  @fontsource/roboto \
  @fontsource/open-sans \
  @fontsource/raleway \
  @fontsource/noto-serif
```

Expected: 10 packages terpasang.

---

## Task 2: Download font TTF ke public/fonts/

**Files:**
- Create: `scripts/copy-fonts.mjs`
- Create: `public/fonts/*.ttf` (~36 file)

- [ ] **Step 1: Buat direktori public/fonts/**

```bash
mkdir -p public/fonts
```

- [ ] **Step 2: Buat scripts/copy-fonts.mjs**

```javascript
// scripts/copy-fonts.mjs
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const FONTS = [
  { pkg: 'playfair-display', out: 'PlayfairDisplay', hasItalic: true },
  { pkg: 'eb-garamond',      out: 'EBGaramond',      hasItalic: true },
  { pkg: 'cinzel',           out: 'Cinzel',           hasItalic: false },
  { pkg: 'merriweather',     out: 'Merriweather',     hasItalic: true },
  { pkg: 'lato',             out: 'Lato',             hasItalic: true },
  { pkg: 'montserrat',       out: 'Montserrat',       hasItalic: true },
  { pkg: 'roboto',           out: 'Roboto',           hasItalic: true },
  { pkg: 'open-sans',        out: 'OpenSans',         hasItalic: true },
  { pkg: 'raleway',          out: 'Raleway',          hasItalic: true },
  { pkg: 'noto-serif',       out: 'NotoSerif',        hasItalic: true },
]

const WEIGHT_MAP = [
  { num: 400, name: 'Regular',    style: 'normal' },
  { num: 700, name: 'Bold',       style: 'normal' },
]

let copied = 0
let missing = 0

for (const font of FONTS) {
  for (const w of WEIGHT_MAP) {
    // Regular / Bold
    const src = resolve(
      `node_modules/@fontsource/${font.pkg}/files/${font.pkg}-latin-${w.num}-normal.ttf`
    )
    const dest = `public/fonts/${font.out}-${w.name}.ttf`
    if (existsSync(src)) {
      copyFileSync(src, dest)
      console.log(`✓ ${dest}`)
      copied++
    } else {
      console.error(`✗ MISSING: ${src}`)
      missing++
    }

    if (!font.hasItalic) continue

    // Italic / BoldItalic
    const italicName = w.num === 400 ? 'Italic' : 'BoldItalic'
    const srcItalic = resolve(
      `node_modules/@fontsource/${font.pkg}/files/${font.pkg}-latin-${w.num}-italic.ttf`
    )
    const destItalic = `public/fonts/${font.out}-${italicName}.ttf`
    if (existsSync(srcItalic)) {
      copyFileSync(srcItalic, destItalic)
      console.log(`✓ ${destItalic}`)
      copied++
    } else {
      console.error(`✗ MISSING: ${srcItalic}`)
      missing++
    }
  }
}

console.log(`\nDone: ${copied} copied, ${missing} missing`)
if (missing > 0) process.exit(1)
```

- [ ] **Step 3: Jalankan script**

```bash
node scripts/copy-fonts.mjs
```

Expected: output `✓` untuk setiap file, diakhiri `Done: 36 copied, 0 missing`.

Jika ada file `MISSING`: periksa apakah @fontsource package menggunakan nama file berbeda. Cek dengan:
```bash
ls node_modules/@fontsource/playfair-display/files/ | head -10
```
Sesuaikan path di script jika perlu.

- [ ] **Step 4: Verifikasi file ada**

```bash
ls public/fonts/ | wc -l
```

Expected: angka 34–36 (Cinzel tidak punya Italic/BoldItalic).

- [ ] **Step 5: Commit**

```bash
git add public/fonts/ scripts/copy-fonts.mjs package.json package-lock.json
git commit -m "feat: download font TTF files dan install @fontsource devDeps"
```

---

## Task 3: Buat src/lib/fontRegistry.ts

**Files:**
- Create: `src/lib/fontRegistry.ts`

- [ ] **Step 1: Buat file fontRegistry.ts**

```typescript
// src/lib/fontRegistry.ts

export const FONT_FAMILIES = [
  { label: 'Playfair Display', value: 'Playfair Display', hasItalic: true },
  { label: 'EB Garamond',      value: 'EB Garamond',      hasItalic: true },
  { label: 'Cinzel',           value: 'Cinzel',            hasItalic: false },
  { label: 'Merriweather',     value: 'Merriweather',      hasItalic: true },
  { label: 'Lato',             value: 'Lato',              hasItalic: true },
  { label: 'Montserrat',       value: 'Montserrat',        hasItalic: true },
  { label: 'Roboto',           value: 'Roboto',            hasItalic: true },
  { label: 'Open Sans',        value: 'Open Sans',         hasItalic: true },
  { label: 'Raleway',          value: 'Raleway',           hasItalic: true },
  { label: 'Noto Serif',       value: 'Noto Serif',        hasItalic: true },
] as const;

export const FONT_WEIGHTS = [
  { label: 'Regular',     value: 'Regular' },
  { label: 'Bold',        value: 'Bold' },
  { label: 'Italic',      value: 'Italic' },
  { label: 'Bold Italic', value: 'BoldItalic' },
] as const;

export type FontWeight = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic';

export const DEFAULT_FONT_FAMILY = 'Playfair Display';
export const DEFAULT_FONT_WEIGHT: FontWeight = 'Regular';

/** Convert fontFamily string to TTF file name prefix, e.g. 'Playfair Display' → 'PlayfairDisplay' */
export function toFontFileName(family: string): string {
  return family.replace(/\s/g, '');
}

/** Path to TTF file served from /public/fonts/ */
export function getFontPath(family: string, weight: FontWeight): string {
  return `/fonts/${toFontFileName(family)}-${weight}.ttf`;
}
```

- [ ] **Step 2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit
```

Expected: tidak ada error dari `fontRegistry.ts` (mungkin ada error dari file lain yang belum diupdate — abaikan dulu, selesaikan di task berikutnya).

---

## Task 4: Update src/types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Ganti field `font` dengan `fontFamily` dan `fontWeight`**

Ganti isi `src/types.ts` menjadi:

```typescript
import type { FontWeight } from './lib/fontRegistry';

export type FieldTipe =
  | 'nama'
  | 'nomor'
  | 'acara'
  | 'tanggal'
  | 'peran'
  | 'penandatangan'
  | 'namaPenandatangan';

export type Perataan = 'left' | 'center' | 'right';

export interface Field {
  id: string;
  tipe: FieldTipe;
  x: number;        // natural-pixel anchor X
  y: number;        // natural-pixel baseline Y from top
  lebar: number;    // natural-pixel width of the text box
  fontFamily: string;
  fontWeight: FontWeight;
  ukuran: number;   // font size in natural pixels
  warna: string;    // hex, e.g. '#000000'
  perataan: Perataan;
  formatter: 'none' | 'uppercase';
}

export interface Penandatangan {
  nama: string;
  jabatan: string;
}

export interface CertEvent {
  id: string;
  nama: string;
  tanggal: string;        // ISO yyyy-mm-dd
  background: string;     // data URL
  bgWidth: number;        // natural width px
  bgHeight: number;       // natural height px
  fields: Field[];
  polaNomor: string;      // e.g. '{n}/SERT/P3KP/{bulan}/{tahun}'
  nomorMulai: number;
  nomorPadding: number;
  nomorTerakhir: number;  // last issued; next = max(nomorTerakhir+1, nomorMulai)
  penandatangan: Penandatangan;
}

/** Resolved string values for one certificate, keyed by field tipe. */
export type FieldValues = Partial<Record<FieldTipe, string>>;
```

- [ ] **Step 2: Cek berapa error TypeScript yang muncul**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: sejumlah error — ini normal, semua file yang masih pakai `field.font` akan error. Selesaikan di task-task berikutnya.

---

## Task 5: Migrasi data lama di src/lib/eventStore.ts

**Files:**
- Modify: `src/lib/eventStore.ts`

Data yang sudah tersimpan di localStorage memiliki `font: 'Helvetica'` (field lama). Fungsi `readAll()` sudah punya pola migrasi untuk `formatter` — kita tambahkan migrasi font di sana.

- [ ] **Step 1: Tambah migrasi fontFamily/fontWeight di readAll()**

Cari baris:
```typescript
    events.forEach(e => e.fields.forEach(f => { if (!f.formatter) f.formatter = 'none'; }));
```

Ganti dengan:
```typescript
    events.forEach(e => e.fields.forEach(f => {
      if (!f.formatter) f.formatter = 'none';
      // Migration: lama pakai f.font, baru pakai fontFamily + fontWeight
      const legacy = f as unknown as Record<string, unknown>;
      if (!f.fontFamily) {
        f.fontFamily = 'Playfair Display';
        f.fontWeight = 'Regular';
        delete legacy['font'];
      }
    }));
```

- [ ] **Step 2: Verifikasi TypeScript tidak error**

```bash
npx tsc --noEmit 2>&1 | grep "eventStore"
```

Expected: kosong.

---

## Task 6: Update index.html — tambah Google Fonts CSS

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Tambah Google Fonts link setelah link Inter yang sudah ada**

Cari baris:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Tambahkan tepat setelahnya:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Cinzel:wght@400;700&family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,400;0,700;1,400;1,700&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Raleway:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
```

---

## Task 7: Update src/lib/pdfRenderer.ts

**Files:**
- Modify: `src/lib/pdfRenderer.ts`

- [ ] **Step 1: Ganti seluruh isi pdfRenderer.ts**

```typescript
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CertEvent, Field, FieldValues } from '../types';
import { getFontPath, type FontWeight } from './fontRegistry';

/** A 1x1 transparent PNG data URL — handy default/test background. */
export const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Shrink font size until the text fits within field.lebar (min 6pt). */
function fitFontSize(text: string, field: Field, font: PDFFont): number {
  let size = field.ukuran;
  while (size > 6 && font.widthOfTextAtSize(text, size) > field.lebar) size -= 1;
  return size;
}

/** Convert fontWeight to CSS font shorthand string for canvas measurement. */
function toCssFont(fontFamily: string, fontWeight: FontWeight, size: number): string {
  const italic = fontWeight === 'Italic' || fontWeight === 'BoldItalic';
  const bold   = fontWeight === 'Bold'   || fontWeight === 'BoldItalic';
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px "${fontFamily}"`;
}

// Use browser canvas measurement so PDF centering matches the Konva preview exactly.
// Falls back to pdf-lib AFM metrics when canvas is unavailable (test / SSR env).
function browserTextWidth(
  text: string,
  fontFamily: string,
  fontWeight: FontWeight,
  size: number,
  afmFallback: () => number,
): number {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return afmFallback();
    ctx.font = toCssFont(fontFamily, fontWeight, size);
    return ctx.measureText(text).width;
  } catch {
    return afmFallback();
  }
}

function alignedX(text: string, field: Field, font: PDFFont, size: number): number {
  const w = browserTextWidth(
    text,
    field.fontFamily,
    field.fontWeight,
    size,
    () => font.widthOfTextAtSize(text, size),
  );
  if (field.perataan === 'center') return field.x + (field.lebar - w) / 2;
  if (field.perataan === 'right')  return field.x + field.lebar - w;
  return field.x;
}

/** Render one certificate to PDF bytes. `values` supplies dynamic field text. */
export async function renderCertificate(
  event: CertEvent,
  values: FieldValues,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([event.bgWidth, event.bgHeight]);

  const bgBytes = dataUrlToBytes(event.background);
  const img = event.background.includes('image/png')
    ? await doc.embedPng(bgBytes)
    : await doc.embedJpg(bgBytes);
  page.drawImage(img, { x: 0, y: 0, width: event.bgWidth, height: event.bgHeight });

  const fontCache = new Map<string, PDFFont>();

  const getFont = async (family: string, weight: FontWeight): Promise<PDFFont> => {
    const key = `${family}-${weight}`;
    if (!fontCache.has(key)) {
      try {
        const res = await fetch(getFontPath(family, weight));
        if (!res.ok) throw new Error(`Font fetch failed: ${getFontPath(family, weight)}`);
        const bytes = await res.arrayBuffer();
        fontCache.set(key, await doc.embedFont(bytes, { subset: true }));
      } catch {
        // Fallback to Helvetica in non-browser environments (e.g. tests)
        fontCache.set(key, await doc.embedFont(StandardFonts.Helvetica));
      }
    }
    return fontCache.get(key)!;
  };

  for (const field of event.fields) {
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;

    const font = await getFont(field.fontFamily, field.fontWeight);
    const size = fitFontSize(text, field, font);
    // field.y is the TOP of the text box (Konva origin: top-left, y grows down).
    // pdf-lib drawText y is the BASELINE (origin: bottom-left, y grows up).
    const ascent = font.heightAtSize(size, { descender: false });
    page.drawText(text, {
      x: alignedX(text, field, font, size),
      y: event.bgHeight - field.y - ascent,
      size,
      font,
      color: hexToRgb(field.warna),
    });
  }

  return doc.save();
}
```

---

## Task 8: Update src/components/editor/EditorCanvas.tsx

**Files:**
- Modify: `src/components/editor/EditorCanvas.tsx`

- [ ] **Step 1: Tambah helper konvaFontStyle dan update Konva Text**

Cari bagian `<Text` di dalam EditorCanvas.tsx. Tambahkan helper function `konvaFontStyle` di atas komponen `EditorCanvas`, dan update prop `fontFamily` + tambah `fontStyle`:

Tambahkan function ini sebelum `export function EditorCanvas`:

```typescript
function konvaFontStyle(weight: string): string {
  switch (weight) {
    case 'Bold':       return 'bold';
    case 'Italic':     return 'italic';
    case 'BoldItalic': return 'bold italic';
    default:           return 'normal';
  }
}
```

Ganti baris `fontFamily={f.font}` dengan:

```typescript
                    fontFamily={f.fontFamily}
                    fontStyle={konvaFontStyle(f.fontWeight)}
```

---

## Task 9: Update src/components/generate/CertPreviewMini.tsx

**Files:**
- Modify: `src/components/generate/CertPreviewMini.tsx`

- [ ] **Step 1: Tambah helper konvaFontStyle dan update Konva Text**

Tambahkan function `konvaFontStyle` yang identik sebelum komponen (atau import dari EditorCanvas bila diekstrak ke utils — untuk sekarang, duplikasi fine):

```typescript
function konvaFontStyle(weight: string): string {
  switch (weight) {
    case 'Bold':       return 'bold';
    case 'Italic':     return 'italic';
    case 'BoldItalic': return 'bold italic';
    default:           return 'normal';
  }
}
```

Ganti `fontFamily={f.font}` dengan:

```typescript
                    fontFamily={f.fontFamily}
                    fontStyle={konvaFontStyle(f.fontWeight)}
```

---

## Task 10: Update src/components/editor/CertificateEditor.tsx

**Files:**
- Modify: `src/components/editor/CertificateEditor.tsx`

- [ ] **Step 1: Ganti default field dari `font:'Helvetica'` ke `fontFamily/fontWeight`**

Cari baris:
```typescript
    font: 'Helvetica', ukuran: Math.round(ev.bgHeight * 0.04),
```

Ganti dengan:
```typescript
    fontFamily: 'Playfair Display', fontWeight: 'Regular' as const, ukuran: Math.round(ev.bgHeight * 0.04),
```

---

## Task 11: Update src/components/editor/FieldProperties.tsx

**Files:**
- Modify: `src/components/editor/FieldProperties.tsx`

- [ ] **Step 1: Ganti seluruh section "Font" di FieldTab**

Tambahkan import di baris paling atas file:
```typescript
import { FONT_FAMILIES, FONT_WEIGHTS } from '../../lib/fontRegistry';
```

Hapus baris:
```typescript
const FONTS: Field['font'][] = ['Helvetica', 'Times', 'Courier'];
```

Cari section `{/* Font */}` (sekitar baris 136–148 pada file asli). Ganti seluruh section itu dengan:

```tsx
      {/* Font */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Huruf</div>
        <select
          className="sg-select"
          value={selected.fontFamily}
          onChange={e => onField({ fontFamily: e.target.value })}
          style={{ marginBottom: 8 }}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="sg-select"
          value={selected.fontWeight}
          onChange={e => onField({ fontWeight: e.target.value as Field['fontWeight'] })}
        >
          {FONT_WEIGHTS.map(w => {
            const currentFont = FONT_FAMILIES.find(f => f.value === selected.fontFamily);
            const isItalicVariant = w.value === 'Italic' || w.value === 'BoldItalic';
            const disabled = isItalicVariant && currentFont ? !currentFont.hasItalic : false;
            return (
              <option key={w.value} value={w.value} disabled={disabled}>
                {w.label}
              </option>
            );
          })}
        </select>
      </div>
```

Hapus juga hint lama jika masih ada:
```typescript
        <div className="sg-hint" style={{ marginTop: 6 }}>
          Tersedia: Helvetica, Times, Courier (batas PDF)
        </div>
```

---

## Task 12: Update tests/pdfRenderer.test.ts

**Files:**
- Modify: `tests/pdfRenderer.test.ts`

- [ ] **Step 1: Update fixture makeEvent() ke shape Field baru**

Ganti `makeEvent()`:

```typescript
function makeEvent(): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: PNG_1x1, bgWidth: 800, bgHeight: 600,
    fields: [{
      id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
      fontFamily: 'Playfair Display', fontWeight: 'Regular',
      ukuran: 32, warna: '#000000', perataan: 'center', formatter: 'none',
    }],
    polaNomor: '{n}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
    penandatangan: { nama: 'Dr. X', jabatan: 'Kepala' },
  };
}
```

- [ ] **Step 2: Jalankan test untuk verifikasi masih pass**

```bash
npm run test
```

Expected output:
```
✓ tests/pdfRenderer.test.ts (2)
  ✓ produces a valid PDF sized to the natural background dimensions
  ✓ returns non-empty bytes
```

Catatan: test akan fallback ke Helvetica (karena `fetch` tidak tersedia di Vitest/Node.js) — ini expected behavior sesuai desain.

---

## Task 13: TypeScript check + build + lint

**Files:** (tidak ada perubahan baru)

- [ ] **Step 1: Cek TypeScript error**

```bash
npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: kosong (0 error). Jika masih ada error, baca pesan error dan fix file yang disebutkan.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `✓ built in X.XXs` tanpa error.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: tidak ada error. Warning boleh ada.

- [ ] **Step 4: Commit**

```bash
git add src/ index.html tests/
git commit -m "feat: custom font system — 10 Google Fonts dengan Regular/Bold/Italic/BoldItalic"
```

---

## Checklist Akhir

- [ ] `public/fonts/` berisi ~36 file TTF
- [ ] Dropdown font family menampilkan 10 pilihan
- [ ] Dropdown weight menampilkan 4 opsi (Italic/BoldItalic di-disable untuk Cinzel)
- [ ] Preview Konva.js menggunakan font dan weight yang dipilih
- [ ] PDF yang di-generate menggunakan font yang sesuai dengan preview
- [ ] Test `pdfRenderer.test.ts` masih pass
- [ ] Build bersih tanpa error TypeScript
