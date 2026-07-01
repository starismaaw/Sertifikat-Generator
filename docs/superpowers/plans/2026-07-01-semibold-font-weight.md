# SemiBold Font Weight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `SemiBold` and `SemiBoldItalic` as selectable font weights in the certificate/pakta editor, backed by real 600-weight font files and consistent between the on-screen Konva preview and the exported PDF.

**Architecture:** Extend the existing `fontRegistry.ts` weight/family tables with two new `FontWeight` values and a per-family `hasSemiBold` flag, consolidate the three duplicated weight→CSS-string switches (`EditorCanvas.tsx`, `CertPreviewMini.tsx`, `pdfRenderer.ts`) into one shared map, extend `scripts/copy-fonts.mjs` to copy the 600-weight files that `@fontsource` already ships, and extend `index.html`'s Google Fonts `<link>` so the browser preview loads real weight 600 instead of synthesizing it.

**Tech Stack:** React + TypeScript + Vite, Konva/react-konva (canvas preview), pdf-lib + @pdf-lib/fontkit (PDF export), @fontsource/* (font asset source), Vitest (tests).

**Spec:** `docs/superpowers/specs/2026-07-01-semibold-font-weight-design.md`

---

## Task 1: Font registry — types, weights, families, shared CSS map

**Files:**
- Modify: `src/lib/fontRegistry.ts`
- Test: `tests/fontRegistry.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/fontRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FONT_FAMILIES, FONT_WEIGHTS, WEIGHT_CSS, toKonvaFontStyle, isWeightDisabled } from '../src/lib/fontRegistry';

describe('fontRegistry SemiBold support', () => {
  it('includes SemiBold and SemiBoldItalic in FONT_WEIGHTS', () => {
    const values = FONT_WEIGHTS.map(w => w.value);
    expect(values).toContain('SemiBold');
    expect(values).toContain('SemiBoldItalic');
  });

  it('flags Lato as not having SemiBold, all others as having it', () => {
    const byName = Object.fromEntries(FONT_FAMILIES.map(f => [f.value, f]));
    expect(byName['Lato'].hasSemiBold).toBe(false);
    expect(byName['Open Sans'].hasSemiBold).toBe(true);
    expect(byName['Cinzel'].hasSemiBold).toBe(true);
    expect(byName['Playfair Display'].hasSemiBold).toBe(true);
  });

  it('maps every FontWeight to a numeric weight + italic flag', () => {
    expect(WEIGHT_CSS.Regular).toEqual({ weight: 400, italic: false });
    expect(WEIGHT_CSS.SemiBold).toEqual({ weight: 600, italic: false });
    expect(WEIGHT_CSS.Bold).toEqual({ weight: 700, italic: false });
    expect(WEIGHT_CSS.Italic).toEqual({ weight: 400, italic: true });
    expect(WEIGHT_CSS.SemiBoldItalic).toEqual({ weight: 600, italic: true });
    expect(WEIGHT_CSS.BoldItalic).toEqual({ weight: 700, italic: true });
  });

  it('toKonvaFontStyle produces Konva-compatible fontStyle strings', () => {
    expect(toKonvaFontStyle('Regular')).toBe('normal');
    expect(toKonvaFontStyle('Bold')).toBe('700');
    expect(toKonvaFontStyle('SemiBold')).toBe('600');
    expect(toKonvaFontStyle('Italic')).toBe('italic');
    expect(toKonvaFontStyle('SemiBoldItalic')).toBe('italic 600');
    expect(toKonvaFontStyle('BoldItalic')).toBe('italic 700');
  });

  it('isWeightDisabled disables SemiBold variants for families without hasSemiBold', () => {
    const lato = FONT_FAMILIES.find(f => f.value === 'Lato')!;
    const openSans = FONT_FAMILIES.find(f => f.value === 'Open Sans')!;
    const cinzel = FONT_FAMILIES.find(f => f.value === 'Cinzel')!;

    expect(isWeightDisabled('SemiBold', lato)).toBe(true);
    expect(isWeightDisabled('SemiBoldItalic', lato)).toBe(true);
    expect(isWeightDisabled('SemiBold', openSans)).toBe(false);
    expect(isWeightDisabled('SemiBoldItalic', openSans)).toBe(false);
    expect(isWeightDisabled('SemiBold', cinzel)).toBe(false);
    expect(isWeightDisabled('SemiBoldItalic', cinzel)).toBe(true); // no italic at all
    expect(isWeightDisabled('Regular', undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fontRegistry.test.ts`
Expected: FAIL — `WEIGHT_CSS`, `toKonvaFontStyle`, `isWeightDisabled` are not exported from `../src/lib/fontRegistry`, and `hasSemiBold` is not a known property.

- [ ] **Step 3: Implement in `src/lib/fontRegistry.ts`**

Replace the entire file contents with:

```ts
export const FONT_FAMILIES = [
  { label: 'Playfair Display', value: 'Playfair Display', hasItalic: true,  hasSemiBold: true },
  { label: 'EB Garamond',      value: 'EB Garamond',      hasItalic: true,  hasSemiBold: true },
  { label: 'Cinzel',           value: 'Cinzel',            hasItalic: false, hasSemiBold: true },
  { label: 'Merriweather',     value: 'Merriweather',      hasItalic: true,  hasSemiBold: true },
  { label: 'Lato',             value: 'Lato',              hasItalic: true,  hasSemiBold: false },
  { label: 'Montserrat',       value: 'Montserrat',        hasItalic: true,  hasSemiBold: true },
  { label: 'Roboto',           value: 'Roboto',            hasItalic: true,  hasSemiBold: true },
  { label: 'Open Sans',        value: 'Open Sans',         hasItalic: true,  hasSemiBold: true },
  { label: 'Raleway',          value: 'Raleway',           hasItalic: true,  hasSemiBold: true },
  { label: 'Noto Serif',       value: 'Noto Serif',        hasItalic: true,  hasSemiBold: true },
] as const;

export const FONT_WEIGHTS = [
  { label: 'Regular',         value: 'Regular' },
  { label: 'SemiBold',        value: 'SemiBold' },
  { label: 'Bold',            value: 'Bold' },
  { label: 'Italic',          value: 'Italic' },
  { label: 'SemiBold Italic', value: 'SemiBoldItalic' },
  { label: 'Bold Italic',     value: 'BoldItalic' },
] as const;

export type FontWeight = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic' | 'SemiBold' | 'SemiBoldItalic';

export const DEFAULT_FONT_FAMILY = 'Playfair Display';
export const DEFAULT_FONT_WEIGHT: FontWeight = 'Regular';

/** Angka weight CSS + apakah italic, untuk tiap FontWeight — sumber tunggal dipakai
 *  oleh preview Konva (toKonvaFontStyle) dan pengukuran/canvas font di pdfRenderer. */
export const WEIGHT_CSS: Record<FontWeight, { weight: number; italic: boolean }> = {
  Regular:        { weight: 400, italic: false },
  SemiBold:       { weight: 600, italic: false },
  Bold:           { weight: 700, italic: false },
  Italic:         { weight: 400, italic: true },
  SemiBoldItalic: { weight: 600, italic: true },
  BoldItalic:     { weight: 700, italic: true },
};

/** Konversi FontWeight ke string `fontStyle` yang dipahami Konva/canvas. */
export function toKonvaFontStyle(weight: FontWeight): string {
  const { weight: w, italic } = WEIGHT_CSS[weight];
  const parts = [italic ? 'italic' : '', w !== 400 ? String(w) : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : 'normal';
}

type FontFamilyEntry = (typeof FONT_FAMILIES)[number];

/** Apakah opsi weight ini harus di-disable di dropdown untuk family yang dipilih
 *  (mis. Lato tidak punya cut 600, Cinzel tidak punya varian italic sama sekali). */
export function isWeightDisabled(weight: FontWeight, family: FontFamilyEntry | undefined): boolean {
  if (!family) return false;
  const isItalicVariant = weight === 'Italic' || weight === 'BoldItalic' || weight === 'SemiBoldItalic';
  const isSemiBoldVariant = weight === 'SemiBold' || weight === 'SemiBoldItalic';
  if (isItalicVariant && !family.hasItalic) return true;
  if (isSemiBoldVariant && !family.hasSemiBold) return true;
  return false;
}

export function toFontFileName(family: string): string {
  return family.replace(/\s/g, '');
}

// PENTING: gunakan .woff bukan .ttf
export function getFontPath(family: string, weight: FontWeight): string {
  return `/fonts/${toFontFileName(family)}-${weight}.woff`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fontRegistry.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All existing tests still PASS (no test hardcodes the old `FONT_WEIGHTS`/`FONT_FAMILIES` array shape).

- [ ] **Step 6: Commit**

```bash
git add src/lib/fontRegistry.ts tests/fontRegistry.test.ts
git commit -m "feat(font): tambah SemiBold/SemiBoldItalic ke font registry"
```

---

## Task 2: Consolidate Konva font-style logic in EditorCanvas and CertPreviewMini

**Files:**
- Modify: `src/components/editor/EditorCanvas.tsx:1-17`
- Modify: `src/components/generate/CertPreviewMini.tsx:1-31`

- [ ] **Step 1: Update `EditorCanvas.tsx` imports and remove local `konvaFontStyle`**

In `src/components/editor/EditorCanvas.tsx`, replace lines 1-17:

```ts
import { useState, useEffect, Fragment } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text, Group } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent } from '../../types';
import { FIELD_LABELS } from './FieldPalette';
import { toKonvaFontStyle } from '../../lib/fontRegistry';

const MAX_W = 680;
const BOUNDARY_PADDING = 4;

function useHtmlImage(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  return img;
}
```

Then replace all three call sites (originally lines 125, 137, 150) — change `konvaFontStyle(f.fontWeight)` to `toKonvaFontStyle(f.fontWeight)` in each of the three `<Text fontStyle={...} />` usages.

- [ ] **Step 2: Update `CertPreviewMini.tsx` imports and remove local `konvaFontStyle`**

In `src/components/generate/CertPreviewMini.tsx`, replace lines 1-31:

```ts
import { useState, useEffect, useRef, Fragment } from 'react';
import { Stage, Layer, Image as KImage, Text } from 'react-konva';
import type { CertEvent } from '../../types';
import { resolveValues } from '../../lib/resolveValues';
import { toKonvaFontStyle } from '../../lib/fontRegistry';

function useContainerWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(380);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

function useHtmlImage(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  return img;
}
```

Then at line 87, change `fontStyle={konvaFontStyle(f.fontWeight)}` to `fontStyle={toKonvaFontStyle(f.fontWeight)}`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: No errors. (This also confirms no other file imports the now-deleted local `konvaFontStyle` functions.)

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (no test targets these two component files directly today).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/EditorCanvas.tsx src/components/generate/CertPreviewMini.tsx
git commit -m "refactor(font): pakai toKonvaFontStyle bersama, hapus duplikasi konvaFontStyle"
```

---

## Task 3: Use shared WEIGHT_CSS map in pdfRenderer's toCssFont

**Files:**
- Modify: `src/lib/pdfRenderer.ts:1-37`
- Test: `tests/pdfRenderer.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

`toCssFont` is currently a module-private function with no way to observe its output from outside `pdfRenderer.ts`. Export it so its exact string output is testable (this is the point of the refactor — the old version only knew binary bold/not-bold, the new version must produce the correct numeric weight for `SemiBold`).

Add to `tests/pdfRenderer.test.ts`:

```ts
import { renderCertificate, renderPakta, PNG_1x1, toCssFont } from '../src/lib/pdfRenderer';
```

(replacing the existing import line that lacks `toCssFont`), then add a new `describe` block:

```ts
describe('toCssFont', () => {
  it('produces the correct CSS font string for every weight', () => {
    expect(toCssFont('Open Sans', 'Regular', 32)).toBe('400 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'SemiBold', 32)).toBe('600 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'Bold', 32)).toBe('700 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'Italic', 32)).toBe('italic 400 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'SemiBoldItalic', 32)).toBe('italic 600 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'BoldItalic', 32)).toBe('italic 700 32px "Open Sans"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: FAIL — `toCssFont` is not exported from `../src/lib/pdfRenderer` (import error), so the test file cannot even run.

- [ ] **Step 3: Implement in `src/lib/pdfRenderer.ts`**

Replace lines 1-37 (imports through `toCssFont`):

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CertEvent, Field, FieldValues, PaktaTemplate } from '../types';
import { getFontPath, WEIGHT_CSS, type FontWeight } from './fontRegistry';

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

export function toCssFont(fontFamily: string, fontWeight: FontWeight, size: number): string {
  const { weight, italic } = WEIGHT_CSS[fontWeight];
  return `${italic ? 'italic ' : ''}${weight} ${size}px "${fontFamily}"`;
}
```

Leave everything from `browserTextWidth` onward (line 41 onward in the original file) unchanged.

Note: `toCssFont` changes from a module-private `function` to an `export function` — no other behavior changes in this file besides the body of `toCssFont` itself.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: PASS (all tests in the file, including the new `toCssFont` describe block)

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdfRenderer.ts tests/pdfRenderer.test.ts
git commit -m "refactor(font): toCssFont pakai WEIGHT_CSS, tambah dukungan SemiBold"
```

---

## Task 4: FieldProperties dropdown — disable SemiBold variants per family

**Files:**
- Modify: `src/components/editor/FieldProperties.tsx:6, 162-177`

- [ ] **Step 1: Update import**

Change line 6 from:

```ts
import { FONT_FAMILIES, FONT_WEIGHTS } from '../../lib/fontRegistry';
```

to:

```ts
import { FONT_FAMILIES, FONT_WEIGHTS, isWeightDisabled } from '../../lib/fontRegistry';
```

- [ ] **Step 2: Update the weight `<select>` block**

Replace the block currently at lines 162-177:

```tsx
        <select
          className="sg-select"
          value={selected.fontWeight}
          onChange={e => onField({ fontWeight: e.target.value as Field['fontWeight'] })}
        >
          {FONT_WEIGHTS.map(w => {
            const currentFont = FONT_FAMILIES.find(f => f.value === selected.fontFamily);
            const disabled = isWeightDisabled(w.value, currentFont);
            return (
              <option key={w.value} value={w.value} disabled={disabled}>
                {w.label}
              </option>
            );
          })}
        </select>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: No errors.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open the certificate editor, select a text field.
- Set Font Family to "Open Sans" → confirm "SemiBold" and "SemiBold Italic" are selectable (not greyed out) in the Weight dropdown.
- Set Font Family to "Lato" → confirm "SemiBold" and "SemiBold Italic" are greyed out/disabled.
- Set Font Family to "Cinzel" → confirm "SemiBold" is selectable but "SemiBold Italic" (and "Italic", "Bold Italic") are disabled.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/FieldProperties.tsx
git commit -m "feat(editor): disable opsi SemiBold di dropdown untuk family tanpa dukungan"
```

---

## Task 5: Generate the SemiBold font asset files

**Files:**
- Modify: `scripts/copy-fonts.mjs`
- Create (generated, not hand-written): 17 files in `public/fonts/*.woff`

- [ ] **Step 1: Update `scripts/copy-fonts.mjs`**

Replace the full file contents:

```js
// scripts/copy-fonts.mjs
// Salin WOFF font files dari @fontsource ke public/fonts/
// @pdf-lib/fontkit mendukung WOFF (bukan hanya TTF)

import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const FONTS = [
  { pkg: 'playfair-display', out: 'PlayfairDisplay', hasItalic: true,  hasSemiBold: true },
  { pkg: 'eb-garamond',      out: 'EBGaramond',      hasItalic: true,  hasSemiBold: true },
  { pkg: 'cinzel',           out: 'Cinzel',           hasItalic: false, hasSemiBold: true },
  { pkg: 'merriweather',     out: 'Merriweather',     hasItalic: true,  hasSemiBold: true },
  { pkg: 'lato',             out: 'Lato',             hasItalic: true,  hasSemiBold: false },
  { pkg: 'montserrat',       out: 'Montserrat',       hasItalic: true,  hasSemiBold: true },
  { pkg: 'roboto',           out: 'Roboto',           hasItalic: true,  hasSemiBold: true },
  { pkg: 'open-sans',        out: 'OpenSans',         hasItalic: true,  hasSemiBold: true },
  { pkg: 'raleway',          out: 'Raleway',          hasItalic: true,  hasSemiBold: true },
  { pkg: 'noto-serif',       out: 'NotoSerif',        hasItalic: true,  hasSemiBold: true },
]

mkdirSync('public/fonts', { recursive: true })

let copied = 0
let missing = 0

for (const font of FONTS) {
  const copyFont = (weight, name, style) => {
    const src = resolve(`node_modules/@fontsource/${font.pkg}/files/${font.pkg}-latin-${weight}-${style}.woff`)
    const dest = `public/fonts/${font.out}-${name}.woff`
    if (existsSync(src)) {
      copyFileSync(src, dest)
      console.log(`✓ ${dest}`)
      copied++
    } else {
      console.error(`✗ MISSING: ${src}`)
      missing++
    }
  }

  copyFont(400, 'Regular',    'normal')
  copyFont(700, 'Bold',       'normal')
  if (font.hasItalic) {
    copyFont(400, 'Italic',     'italic')
    copyFont(700, 'BoldItalic', 'italic')
  }
  if (font.hasSemiBold) {
    copyFont(600, 'SemiBold', 'normal')
    if (font.hasItalic) {
      copyFont(600, 'SemiBoldItalic', 'italic')
    }
  }
}

console.log(`\nDone: ${copied} copied, ${missing} missing`)
if (missing > 0) process.exit(1)
```

- [ ] **Step 2: Run the script**

Run: `node scripts/copy-fonts.mjs`

Expected count of new files: Playfair Display, EB Garamond, Merriweather, Montserrat, Roboto, Open Sans, Raleway, Noto Serif (8 families) × 2 files (SemiBold + SemiBoldItalic) = 16, plus Cinzel × 1 file (SemiBold only, no italic) = 17 new files, plus Lato × 0. The repo currently has 38 files in `public/fonts/` (verified via `ls public/fonts | wc -l`), so expected output is:

`Done: 55 copied, 0 missing`

If the script reports `missing > 0`, stop and check `node_modules/@fontsource/<pkg>/files/` for the exact filename — do not fabricate or hand-edit a font file to work around a missing source file.

- [ ] **Step 3: Verify the new files are real weight-600 fonts**

Run (requires `pip install fonttools` if not already available):

```bash
python3 -c "
from fontTools.ttLib import TTFont
import glob
for path in sorted(glob.glob('public/fonts/*-SemiBold*.woff')):
    tt = TTFont(path)
    weight = tt['OS/2'].usWeightClass
    print(path, 'usWeightClass=', weight)
    assert weight == 600, f'{path} has wrong weight class {weight}'
print('All SemiBold files verified as weight 600')
"
```

Expected: prints `usWeightClass= 600` for all 17 files and ends with `All SemiBold files verified as weight 600`.

- [ ] **Step 4: Check git status for the new/changed files**

Run: `git status --short public/fonts scripts/copy-fonts.mjs`
Expected: 17 new files under `public/fonts/` (all `SemiBold`/`SemiBoldItalic`) and `scripts/copy-fonts.mjs` modified. No other files should be touched by this step.

- [ ] **Step 5: Commit**

```bash
git add scripts/copy-fonts.mjs public/fonts/*-SemiBold*.woff
git commit -m "feat(font): generate 17 file weight SemiBold dari @fontsource"
```

---

## Task 6: index.html — load real weight 600 for preview parity

**Files:**
- Modify: `index.html:14`

- [ ] **Step 1: Update the Google Fonts `<link>`**

Replace line 14:

```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Cinzel:wght@400;700&family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,400;0,700;1,400;1,700&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Raleway:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
```

with:

```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Cinzel:wght@400;600;700&family=Merriweather:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Roboto:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Raleway:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap" rel="stylesheet" />
```

(Lato's segment is unchanged — it has no weight 600 to load.)

- [ ] **Step 2: Manual verification in the browser**

Run: `npm run dev`, open the app, open browser devtools Network tab, reload.
Confirm the request to `fonts.googleapis.com/css2?...` succeeds (200) and the response CSS includes `font-weight: 600;` blocks for `Open Sans` (search the response body for `font-weight: 600`).

- [ ] **Step 3: Visual check — SemiBold renders distinctly from Bold/Regular**

In the editor, add a text field, set Font Family to "Open Sans", and cycle through Regular → SemiBold → Bold in the Weight dropdown while watching the canvas preview. Confirm SemiBold visibly sits between Regular and Bold in stroke weight (not identical to either).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(font): load weight 600 dari Google Fonts untuk preview SemiBold"
```

---

## Task 7: End-to-end verification — exported PDF actually embeds weight 600

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full automated test suite**

Run: `npx vitest run`
Expected: All tests PASS, zero skipped, zero failed.

- [ ] **Step 2: Run typecheck and build**

Run: `npm run build`
Expected: Builds successfully with no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors. Report any warnings honestly if present — do not claim "clean" if there are warnings.

- [ ] **Step 4: Manual PDF export check**

In the running dev app (`npm run dev`), create or open a certificate event, add a text field with Font Family "Open Sans" and Weight "SemiBold", fill in a sample value, and export/download the generated PDF.

- [ ] **Step 5: Verify the embedded font in the exported PDF is genuinely weight 600**

Run (adjust `~/Downloads/<file>.pdf` to the actual downloaded path):

```bash
python3 -c "
import zlib, re
path = '<path-to-downloaded-pdf>'
with open(path, 'rb') as f:
    data = f.read()
# crude check: embedded font subsets are named like 'ABCDEF+OpenSans-SemiBold'
matches = re.findall(rb'/BaseFont\s*/([A-Za-z0-9+]+)', data)
print('Embedded font names:', matches)
assert any(b'SemiBold' in m for m in matches), 'No SemiBold font embedded in PDF'
print('Confirmed: PDF embeds a SemiBold-named font subset')
"
```

Expected: prints a `BaseFont` entry containing `SemiBold` (e.g. `ABCDEF+OpenSans-SemiBold`), confirming pdf-lib actually embedded the new font file and did not silently fall back to Helvetica (which would show `/BaseFont /Helvetica` instead).

- [ ] **Step 6: Update handoff doc**

Update `docs/agent-handoff.md` per the project's Finish Protocol (branch, task, files changed, commands run, build/lint/test results, known issues, next step). Do not commit or push unless the user explicitly asks.

---

## Summary of Files Touched

| File | Change |
|------|--------|
| `src/lib/fontRegistry.ts` | Add `SemiBold`/`SemiBoldItalic`, `hasSemiBold`, `WEIGHT_CSS`, `toKonvaFontStyle`, `isWeightDisabled` |
| `tests/fontRegistry.test.ts` | **New** — unit tests for the above |
| `src/components/editor/EditorCanvas.tsx` | Remove local `konvaFontStyle`, use shared `toKonvaFontStyle` |
| `src/components/generate/CertPreviewMini.tsx` | Remove local `konvaFontStyle`, use shared `toKonvaFontStyle` |
| `src/lib/pdfRenderer.ts` | `toCssFont` uses `WEIGHT_CSS` instead of a binary bold/italic switch |
| `tests/pdfRenderer.test.ts` | Extend — SemiBold/SemiBoldItalic render without throwing |
| `src/components/editor/FieldProperties.tsx` | Weight dropdown disables SemiBold variants via `isWeightDisabled` |
| `scripts/copy-fonts.mjs` | Add `hasSemiBold` per family + copy weight-600 files |
| `public/fonts/*-SemiBold*.woff` | **New** (generated) — 17 files |
| `index.html` | Add weight `600` to Google Fonts query for 9 families |
| `docs/agent-handoff.md` | Updated per Finish Protocol |
