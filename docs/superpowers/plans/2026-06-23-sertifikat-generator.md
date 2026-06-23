# Generator Sertifikat Otomatis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side web app that generates certificate PDFs (single via form, bulk via Excel/CSV) from a user-uploaded background, with a 3-panel visual field editor and per-event auto-incrementing certificate numbers.

**Architecture:** Pure client-side React SPA. Pure-logic modules (`NumberFormatter`, `EventStore`, `DataImporter`, `PdfRenderer`) are framework-agnostic and unit-tested with Vitest. UI is built on top of them. All persistence is in `localStorage`. PDFs are produced with `pdf-lib`, drawing vector text at coordinates over the embedded background image.

**Tech Stack:** React 19 + Vite + TypeScript, `pdf-lib`, `react-konva` + `konva`, `xlsx` (SheetJS), `papaparse`, `jszip`, Vitest + `@testing-library/react` + `jsdom`.

---

## Coordinate System (read before any editor/PDF task)

Field positions are stored in **natural background-image pixels** — the intrinsic `naturalWidth`/`naturalHeight` of the uploaded image, NOT the on-screen display size.

- The editor renders the background scaled to fit its container. A `displayScale` factor converts between screen pixels and natural pixels. Konva drag returns stage coordinates; divide by `displayScale` to store natural coordinates.
- The PDF page is created at the image's natural width/height, so stored coordinates map **1:1** into the PDF.
- `pdf-lib`'s origin is **bottom-left** (y grows upward). Our stored `y` is the text baseline measured from the **top**. Convert with `pdfY = pageHeight - field.y`.
- `field.x` is the anchor X; horizontal alignment (`perataan`) positions text relative to `field.lebar` starting at `field.x`.

This single convention is used by both `CertificateEditor` and `PdfRenderer`. Do not introduce a second one.

---

## File Structure

```
src/
  types.ts                      # Event, Field, FieldTipe, Penandatangan
  lib/
    numberFormatter.ts          # buildCertNumber(pattern, n, padding, date)
    eventStore.ts               # CRUD events + claimNextNumber, localStorage
    dataImporter.ts             # parseFile -> {headers, rows}; column mapping helpers
    pdfRenderer.ts              # renderCertificate(event, values) -> Uint8Array (PDF bytes)
    download.ts                 # downloadBlob, buildZip
  hooks/
    useEvents.ts                # React state wrapper around eventStore
  components/
    AppRouter.tsx               # hash-based view switching
    EventList.tsx               # Home: list + new/delete event
    editor/
      CertificateEditor.tsx     # 3-panel layout shell
      FieldPalette.tsx          # left panel: add fields
      EditorCanvas.tsx          # center: react-konva stage, drag fields
      FieldProperties.tsx       # right: font/size/color/align + number pattern
    generate/
      GenerateSingle.tsx        # single form -> preview -> download
      GenerateBulk.tsx          # upload -> map columns -> preview -> ZIP
      ColumnMapper.tsx          # map file headers to fields
      BulkPreviewTable.tsx      # preview rows + warnings
  App.tsx
  main.tsx
tests/
  numberFormatter.test.ts
  eventStore.test.ts
  dataImporter.test.ts
  pdfRenderer.test.ts
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Vite React-TS project**

Run in the project root:
```bash
npm create vite@latest . -- --template react-ts
```
If the directory is non-empty, choose "Ignore files and continue". This generates `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`.

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install pdf-lib konva react-konva xlsx papaparse jszip
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @types/papaparse
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify the toolchain runs**

Run: `npm run test`
Expected: PASS with "No test files found" (exit 0) — confirms Vitest is wired.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Init git and commit**

```bash
git init
printf "node_modules\ndist\n.superpowers/\n.DS_Store\n" > .gitignore
git add -A
git commit -m "chore: scaffold Vite React-TS project with Vitest"
```

---

## Task 2: Domain types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write the types**

Create `src/types.ts`:
```ts
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
  font: string;     // 'Helvetica' | 'Times' | 'Courier'
  ukuran: number;   // font size in natural pixels
  warna: string;    // hex, e.g. '#000000'
  perataan: Perataan;
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

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.
```bash
git add src/types.ts && git commit -m "feat: add domain types"
```

---

## Task 3: NumberFormatter (pure)

**Files:**
- Create: `src/lib/numberFormatter.ts`
- Test: `tests/numberFormatter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/numberFormatter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildCertNumber, toRoman } from '../src/lib/numberFormatter';

describe('toRoman', () => {
  it('maps months 1-12 to Roman numerals', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(6)).toBe('VI');
    expect(toRoman(12)).toBe('XII');
  });
});

describe('buildCertNumber', () => {
  const date = new Date('2026-06-15');

  it('pads {n} to the requested width', () => {
    expect(buildCertNumber('{n}', 1, 3, date)).toBe('001');
    expect(buildCertNumber('{n}', 42, 4, date)).toBe('0042');
  });

  it('substitutes {bulan} as Roman and {tahun} as full year', () => {
    expect(buildCertNumber('{n}/SERT/P3KP/{bulan}/{tahun}', 7, 3, date))
      .toBe('007/SERT/P3KP/VI/2026');
  });

  it('leaves free text untouched and keeps unknown braces literal', () => {
    expect(buildCertNumber('NO-{n}-END', 5, 2, date)).toBe('NO-05-END');
    expect(buildCertNumber('{x}/{n}', 1, 1, date)).toBe('{x}/1');
  });

  it('does not pad numbers already wider than padding', () => {
    expect(buildCertNumber('{n}', 1234, 3, date)).toBe('1234');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/numberFormatter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/numberFormatter.ts`:
```ts
const ROMAN: [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  let out = '';
  let rem = n;
  for (const [val, sym] of ROMAN) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

/**
 * Build a certificate number string from a pattern.
 * Supported placeholders: {n} (sequence, zero-padded), {bulan} (Roman month),
 * {tahun} (full year). Unknown {tokens} are left literal.
 */
export function buildCertNumber(
  pattern: string,
  n: number,
  padding: number,
  date: Date,
): string {
  const padded = String(n).padStart(padding, '0');
  return pattern.replace(/\{(\w+)\}/g, (whole, token: string) => {
    switch (token) {
      case 'n': return padded;
      case 'bulan': return toRoman(date.getMonth() + 1);
      case 'tahun': return String(date.getFullYear());
      default: return whole;
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/numberFormatter.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/numberFormatter.ts tests/numberFormatter.test.ts
git commit -m "feat: add NumberFormatter with Roman month + padding"
```

---

## Task 4: EventStore (localStorage + sequence)

**Files:**
- Create: `src/lib/eventStore.ts`
- Test: `tests/eventStore.test.ts`

**Intent under test:** numbers must never duplicate (claiming advances `nomorTerakhir` atomically), and events persist across reloads.

- [ ] **Step 1: Write the failing tests**

Create `tests/eventStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { listEvents, saveEvent, getEvent, deleteEvent, claimNextNumber } from '../src/lib/eventStore';
import type { CertEvent } from '../src/types';

function makeEvent(over: Partial<CertEvent> = {}): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: 'data:,', bgWidth: 800, bgHeight: 600, fields: [],
    polaNomor: '{n}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
    penandatangan: { nama: '', jabatan: '' }, ...over,
  };
}

beforeEach(() => localStorage.clear());

describe('EventStore CRUD', () => {
  it('saves and lists events', () => {
    saveEvent(makeEvent());
    expect(listEvents().map(e => e.id)).toEqual(['e1']);
  });

  it('updates an existing event in place (no duplicate)', () => {
    saveEvent(makeEvent());
    saveEvent(makeEvent({ nama: 'Pelatihan B' }));
    const all = listEvents();
    expect(all).toHaveLength(1);
    expect(all[0].nama).toBe('Pelatihan B');
  });

  it('gets and deletes', () => {
    saveEvent(makeEvent());
    expect(getEvent('e1')?.nama).toBe('Pelatihan A');
    deleteEvent('e1');
    expect(getEvent('e1')).toBeUndefined();
  });

  it('persists across a fresh module read', () => {
    saveEvent(makeEvent());
    expect(listEvents()).toHaveLength(1); // backed by localStorage, survives
  });
});

describe('claimNextNumber', () => {
  it('starts from nomorMulai and increments without duplicates', () => {
    saveEvent(makeEvent({ nomorMulai: 1, nomorTerakhir: 0 }));
    expect(claimNextNumber('e1')).toBe(1);
    expect(claimNextNumber('e1')).toBe(2);
    expect(claimNextNumber('e1')).toBe(3);
    expect(getEvent('e1')?.nomorTerakhir).toBe(3);
  });

  it('respects a higher nomorMulai', () => {
    saveEvent(makeEvent({ nomorMulai: 100, nomorTerakhir: 0 }));
    expect(claimNextNumber('e1')).toBe(100);
    expect(claimNextNumber('e1')).toBe(101);
  });

  it('throws for an unknown event', () => {
    expect(() => claimNextNumber('nope')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/eventStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/eventStore.ts`:
```ts
import type { CertEvent } from '../types';

const KEY = 'sertifikat.events.v1';

function readAll(): CertEvent[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CertEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: CertEvent[]): void {
  localStorage.setItem(KEY, JSON.stringify(events));
}

export function listEvents(): CertEvent[] {
  return readAll();
}

export function getEvent(id: string): CertEvent | undefined {
  return readAll().find(e => e.id === id);
}

export function saveEvent(event: CertEvent): void {
  const all = readAll();
  const idx = all.findIndex(e => e.id === event.id);
  if (idx >= 0) all[idx] = event;
  else all.push(event);
  writeAll(all);
}

export function deleteEvent(id: string): void {
  writeAll(readAll().filter(e => e.id !== id));
}

/** Atomically claim and persist the next certificate number for an event. */
export function claimNextNumber(id: string): number {
  const all = readAll();
  const ev = all.find(e => e.id === id);
  if (!ev) throw new Error(`Event tidak ditemukan: ${id}`);
  const next = Math.max(ev.nomorTerakhir + 1, ev.nomorMulai);
  ev.nomorTerakhir = next;
  writeAll(all);
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/eventStore.test.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventStore.ts tests/eventStore.test.ts
git commit -m "feat: add EventStore with atomic number claiming"
```

---

## Task 5: DataImporter (Excel/CSV)

**Files:**
- Create: `src/lib/dataImporter.ts`
- Test: `tests/dataImporter.test.ts`

**Intent under test:** a row whose mapped "nama" is blank must be flagged so it can be skipped (and not consume a number).

- [ ] **Step 1: Write the failing tests**

Create `tests/dataImporter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseCsv, applyMapping, validateRows } from '../src/lib/dataImporter';
import type { FieldTipe } from '../src/types';

const csv = 'Nama,Jabatan\nBudi,Peserta\n,Narasumber\nSiti,Peserta\n';

describe('parseCsv', () => {
  it('extracts headers and rows', () => {
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(['Nama', 'Jabatan']);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ Nama: 'Budi', Jabatan: 'Peserta' });
  });
});

describe('applyMapping', () => {
  it('maps file columns to field tipe', () => {
    const { rows } = parseCsv(csv);
    const mapping: Partial<Record<FieldTipe, string>> = { nama: 'Nama', peran: 'Jabatan' };
    const mapped = applyMapping(rows, mapping);
    expect(mapped[0]).toEqual({ nama: 'Budi', peran: 'Peserta' });
  });
});

describe('validateRows', () => {
  it('flags rows with blank nama', () => {
    const { rows } = parseCsv(csv);
    const mapped = applyMapping(rows, { nama: 'Nama' });
    const result = validateRows(mapped);
    expect(result[0].valid).toBe(true);
    expect(result[1].valid).toBe(false);   // blank nama
    expect(result[1].warning).toMatch(/nama/i);
    expect(result[2].valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/dataImporter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/dataImporter.ts`:
```ts
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { FieldTipe, FieldValues } from '../types';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ValidatedRow {
  values: FieldValues;
  valid: boolean;
  warning?: string;
}

export function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).filter(Boolean);
  return { headers, rows: result.data };
}

/** Parse an .xlsx/.xls ArrayBuffer (first sheet). */
export function parseXlsx(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Dispatch by file extension. CSV is read as text; Excel as ArrayBuffer. */
export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(await file.text());
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXlsx(await file.arrayBuffer());
  }
  throw new Error('Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls');
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: Partial<Record<FieldTipe, string>>,
): FieldValues[] {
  return rows.map(row => {
    const out: FieldValues = {};
    for (const [tipe, col] of Object.entries(mapping)) {
      if (col) out[tipe as FieldTipe] = (row[col] ?? '').trim();
    }
    return out;
  });
}

export function validateRows(rows: FieldValues[]): ValidatedRow[] {
  return rows.map(values => {
    const nama = (values.nama ?? '').trim();
    return nama
      ? { values, valid: true }
      : { values, valid: false, warning: 'Baris tanpa nama — akan dilewati' };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/dataImporter.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dataImporter.ts tests/dataImporter.test.ts
git commit -m "feat: add DataImporter for CSV/Excel with row validation"
```

---

## Task 6: PdfRenderer (pdf-lib)

**Files:**
- Create: `src/lib/pdfRenderer.ts`
- Test: `tests/pdfRenderer.test.ts`

**Intent under test:** produced bytes are a valid PDF whose page size equals the background's natural dimensions (proving 1:1 coordinate mapping), and embedded text is present.

- [ ] **Step 1: Write the failing tests**

Create `tests/pdfRenderer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderCertificate, PNG_1x1 } from '../src/lib/pdfRenderer';
import type { CertEvent } from '../src/types';

function makeEvent(): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: PNG_1x1, bgWidth: 800, bgHeight: 600,
    fields: [{
      id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
      font: 'Helvetica', ukuran: 32, warna: '#000000', perataan: 'center',
    }],
    polaNomor: '{n}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
    penandatangan: { nama: 'Dr. X', jabatan: 'Kepala' },
  };
}

describe('renderCertificate', () => {
  it('produces a valid PDF sized to the natural background dimensions', async () => {
    const bytes = await renderCertificate(makeEvent(), { nama: 'Budi' });
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(800);
    expect(Math.round(page.getHeight())).toBe(600);
  });

  it('returns non-empty bytes', async () => {
    const bytes = await renderCertificate(makeEvent(), { nama: 'Budi' });
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/pdfRenderer.ts`:
```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { CertEvent, Field, FieldValues } from '../types';

/** A 1x1 transparent PNG data URL — handy default/test background. */
export const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

const FONT_MAP: Record<string, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  Times: StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
};

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

function alignedX(text: string, field: Field, font: PDFFont, size: number): number {
  const w = font.widthOfTextAtSize(text, size);
  if (field.perataan === 'center') return field.x + (field.lebar - w) / 2;
  if (field.perataan === 'right') return field.x + field.lebar - w;
  return field.x;
}

/** Render one certificate to PDF bytes. `values` supplies dynamic field text. */
export async function renderCertificate(
  event: CertEvent,
  values: FieldValues,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([event.bgWidth, event.bgHeight]);

  const bgBytes = dataUrlToBytes(event.background);
  const img = event.background.includes('image/png')
    ? await doc.embedPng(bgBytes)
    : await doc.embedJpg(bgBytes);
  page.drawImage(img, { x: 0, y: 0, width: event.bgWidth, height: event.bgHeight });

  const fontCache = new Map<string, PDFFont>();
  const getFont = async (name: string) => {
    if (!fontCache.has(name)) {
      fontCache.set(name, await doc.embedFont(FONT_MAP[name] ?? StandardFonts.Helvetica));
    }
    return fontCache.get(name)!;
  };

  for (const field of event.fields) {
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    const font = await getFont(field.font);
    const size = fitFontSize(text, field, font);
    page.drawText(text, {
      x: alignedX(text, field, font, size),
      y: event.bgHeight - field.y,        // top-down -> pdf bottom-up
      size,
      font,
      color: hexToRgb(field.warna),
    });
  }

  return doc.save();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdfRenderer.ts tests/pdfRenderer.test.ts
git commit -m "feat: add PdfRenderer drawing vector text over background"
```

---

## Task 7: Value resolver + download helpers

**Files:**
- Create: `src/lib/resolveValues.ts`, `src/lib/download.ts`
- Test: `tests/resolveValues.test.ts`

**Intent:** centralize how static event fields (acara/tanggal/penandatangan/nomor) merge with per-person dynamic values, so single and bulk modes stay consistent.

- [ ] **Step 1: Write the failing test**

Create `tests/resolveValues.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveValues } from '../src/lib/resolveValues';
import type { CertEvent } from '../src/types';

const event: CertEvent = {
  id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
  background: 'data:,', bgWidth: 800, bgHeight: 600, fields: [],
  polaNomor: '{n}/{tahun}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
  penandatangan: { nama: 'Dr. X', jabatan: 'Kepala' },
};

describe('resolveValues', () => {
  it('merges static event data with per-person values and a claimed number', () => {
    const v = resolveValues(event, { nama: 'Budi', peran: 'Peserta' }, 7);
    expect(v.nama).toBe('Budi');
    expect(v.peran).toBe('Peserta');
    expect(v.acara).toBe('Pelatihan A');
    expect(v.tanggal).toBe('2026-06-15');
    expect(v.namaPenandatangan).toBe('Dr. X');
    expect(v.penandatangan).toBe('Kepala');
    expect(v.nomor).toBe('007/2026');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/resolveValues.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement both helpers**

Create `src/lib/resolveValues.ts`:
```ts
import type { CertEvent, FieldValues } from '../types';
import { buildCertNumber } from './numberFormatter';

/**
 * Merge static event fields with a person's dynamic values and a claimed
 * sequence number into a full FieldValues map for rendering.
 */
export function resolveValues(
  event: CertEvent,
  person: FieldValues,
  claimedNumber: number,
): FieldValues {
  return {
    acara: event.nama,
    tanggal: event.tanggal,
    namaPenandatangan: event.penandatangan.nama,
    penandatangan: event.penandatangan.jabatan,
    nomor: buildCertNumber(
      event.polaNomor,
      claimedNumber,
      event.nomorPadding,
      new Date(event.tanggal),
    ),
    ...person, // person values (nama, peran) override
  };
}
```

Create `src/lib/download.ts`:
```ts
import JSZip from 'jszip';

export function downloadBlob(bytes: Uint8Array, filename: string, type = 'application/pdf'): void {
  const blob = new Blob([bytes], { type });
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

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/resolveValues.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolveValues.ts src/lib/download.ts tests/resolveValues.test.ts
git commit -m "feat: add value resolver and download/zip helpers"
```

---

## Task 8: useEvents hook + routing shell

**Files:**
- Create: `src/hooks/useEvents.ts`, `src/components/AppRouter.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement the events hook**

Create `src/hooks/useEvents.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';
import type { CertEvent } from '../types';
import { listEvents, saveEvent, deleteEvent } from '../lib/eventStore';

export function useEvents() {
  const [events, setEvents] = useState<CertEvent[]>([]);

  const refresh = useCallback(() => setEvents(listEvents()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback((e: CertEvent) => { saveEvent(e); refresh(); }, [refresh]);
  const remove = useCallback((id: string) => { deleteEvent(id); refresh(); }, [refresh]);

  return { events, save, remove, refresh };
}
```

- [ ] **Step 2: Implement a minimal hash router**

Create `src/components/AppRouter.tsx`:
```tsx
import { useEffect, useState } from 'react';

export type View =
  | { name: 'home' }
  | { name: 'editor'; eventId: string }
  | { name: 'generate'; eventId: string };

function parseHash(): View {
  const h = window.location.hash.replace(/^#/, '');
  const [name, id] = h.split('/');
  if (name === 'editor' && id) return { name: 'editor', eventId: id };
  if (name === 'generate' && id) return { name: 'generate', eventId: id };
  return { name: 'home' };
}

export function navigate(view: View): void {
  if (view.name === 'home') window.location.hash = '';
  else window.location.hash = `${view.name}/${view.eventId}`;
}

export function useView(): View {
  const [view, setView] = useState<View>(parseHash);
  useEffect(() => {
    const onChange = () => setView(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return view;
}
```

- [ ] **Step 3: Wire App.tsx (placeholder views for now)**

Replace `src/App.tsx`:
```tsx
import { useView } from './components/AppRouter';

export default function App() {
  const view = useView();
  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>Generator Sertifikat</h1>
      <p>View aktif: {view.name}</p>
    </main>
  );
}
```

- [ ] **Step 4: Verify build + manual run**

Run: `npx tsc --noEmit && npm run build`
Expected: success.
Run: `npm run dev` and open the printed URL — confirm the heading renders and changing the hash to `#editor/x` updates "View aktif".

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEvents.ts src/components/AppRouter.tsx src/App.tsx
git commit -m "feat: add useEvents hook and hash router shell"
```

---

## Task 9: EventList (Home) with image upload

**Files:**
- Create: `src/components/EventList.tsx`, `src/lib/image.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement image loader/validator**

Create `src/lib/image.ts`:
```ts
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Validate type/size, read as data URL, and measure natural dimensions. */
export function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      reject(new Error('Background harus berupa gambar PNG atau JPG'));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('Ukuran gambar maksimal 5 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('File gambar tidak valid'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Implement EventList**

Create `src/components/EventList.tsx`:
```tsx
import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { loadImage } from '../lib/image';
import { navigate } from './AppRouter';
import type { CertEvent } from '../types';

export function EventList() {
  const { events, save, remove } = useEvents();
  const [error, setError] = useState('');

  async function handleNew(file: File) {
    setError('');
    try {
      const img = await loadImage(file);
      const ev: CertEvent = {
        id: crypto.randomUUID(),
        nama: 'Acara Baru', tanggal: new Date().toISOString().slice(0, 10),
        background: img.dataUrl, bgWidth: img.width, bgHeight: img.height,
        fields: [], polaNomor: '{n}/SERT/{bulan}/{tahun}',
        nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
        penandatangan: { nama: '', jabatan: '' },
      };
      save(ev);
      navigate({ name: 'editor', eventId: ev.id });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Daftar Acara</h2>
      <label style={{ display: 'inline-block', margin: '8px 0', cursor: 'pointer' }}>
        <strong>+ Acara Baru</strong> (pilih background)
        <input type="file" accept="image/png,image/jpeg" hidden
          onChange={e => e.target.files?.[0] && handleNew(e.target.files[0])} />
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <ul>
        {events.map(ev => (
          <li key={ev.id} style={{ margin: '6px 0' }}>
            {ev.nama} — {ev.tanggal}{' '}
            <button onClick={() => navigate({ name: 'editor', eventId: ev.id })}>Edit Template</button>{' '}
            <button onClick={() => navigate({ name: 'generate', eventId: ev.id })}>Generate</button>{' '}
            <button onClick={() => confirm(`Hapus "${ev.nama}"?`) && remove(ev.id)}>Hapus</button>
          </li>
        ))}
        {events.length === 0 && <li>Belum ada acara.</li>}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Render it from App.tsx home view**

In `src/App.tsx`, import `EventList` and render it when `view.name === 'home'`:
```tsx
import { useView } from './components/AppRouter';
import { EventList } from './components/EventList';

export default function App() {
  const view = useView();
  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>Generator Sertifikat</h1>
      {view.name === 'home' && <EventList />}
      {view.name !== 'home' && <p>View: {view.name} (akan diisi di task berikutnya)</p>}
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`. Click "Acara Baru", pick a PNG/JPG → it should create an event and switch to the editor view. Reload → event still listed (localStorage). Try a >5 MB file → see the error message.

- [ ] **Step 5: Commit**

```bash
git add src/components/EventList.tsx src/lib/image.ts src/App.tsx
git commit -m "feat: add Home event list with validated background upload"
```

---

## Task 10: Editor — 3-panel shell + field palette

**Files:**
- Create: `src/components/editor/CertificateEditor.tsx`, `src/components/editor/FieldPalette.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement the field palette (left panel)**

Create `src/components/editor/FieldPalette.tsx`:
```tsx
import type { FieldTipe } from '../../types';

const LABELS: Record<FieldTipe, string> = {
  nama: 'Nama peserta', nomor: 'Nomor sertifikat', acara: 'Nama acara',
  tanggal: 'Tanggal acara', peran: 'Peran',
  namaPenandatangan: 'Nama penandatangan', penandatangan: 'Jabatan penandatangan',
};

export function FieldPalette({ onAdd, used }: { onAdd: (t: FieldTipe) => void; used: Set<FieldTipe> }) {
  return (
    <div style={{ width: 160 }}>
      <h3>Field</h3>
      {(Object.keys(LABELS) as FieldTipe[]).map(t => (
        <button key={t} disabled={used.has(t)} onClick={() => onAdd(t)}
          style={{ display: 'block', width: '100%', margin: '4px 0', textAlign: 'left' }}>
          + {LABELS[t]}
        </button>
      ))}
    </div>
  );
}

export { LABELS as FIELD_LABELS };
```

- [ ] **Step 2: Implement the editor shell (loads event, holds state)**

Create `src/components/editor/CertificateEditor.tsx`:
```tsx
import { useState } from 'react';
import type { CertEvent, Field, FieldTipe } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { getEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { FieldPalette } from './FieldPalette';

function newField(tipe: FieldTipe, ev: CertEvent): Field {
  return {
    id: crypto.randomUUID(), tipe,
    x: ev.bgWidth * 0.2, y: ev.bgHeight * 0.5, lebar: ev.bgWidth * 0.6,
    font: 'Helvetica', ukuran: Math.round(ev.bgHeight * 0.04),
    warna: '#000000', perataan: 'center',
  };
}

export function CertificateEditor({ eventId }: { eventId: string }) {
  const { save } = useEvents();
  const [event, setEvent] = useState<CertEvent | undefined>(() => getEvent(eventId));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!event) return <p>Acara tidak ditemukan. <button onClick={() => navigate({ name: 'home' })}>Kembali</button></p>;

  const update = (next: CertEvent) => { setEvent(next); save(next); };
  const used = new Set(event.fields.map(f => f.tipe));

  const addField = (tipe: FieldTipe) => {
    const f = newField(tipe, event);
    update({ ...event, fields: [...event.fields, f] });
    setSelectedId(f.id);
  };

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <FieldPalette onAdd={addField} used={used} />
      <div style={{ flex: 1 }} id="editor-canvas-slot">
        {/* EditorCanvas mounts here in Task 11 */}
        <p>Kanvas akan tampil di sini.</p>
      </div>
      <div style={{ width: 220 }} id="editor-props-slot">
        {/* FieldProperties mounts here in Task 12 */}
        <button onClick={() => navigate({ name: 'home' })}>← Daftar Acara</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Route to it**

In `src/App.tsx`, render `<CertificateEditor eventId={view.eventId} />` when `view.name === 'editor'`.

- [ ] **Step 4: Verify**

Run: `npm run dev`, open an event's editor. Clicking palette buttons adds fields (button becomes disabled once used). Reload → fields persist.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/ src/App.tsx
git commit -m "feat: add editor shell and field palette"
```

---

## Task 11: Editor — react-konva canvas with draggable fields

**Files:**
- Create: `src/components/editor/EditorCanvas.tsx`
- Modify: `src/components/editor/CertificateEditor.tsx`

- [ ] **Step 1: Implement the canvas**

Create `src/components/editor/EditorCanvas.tsx`:
```tsx
import { useRef } from 'react';
import { Stage, Layer, Image as KImage, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent, Field } from '../../types';
import { FIELD_LABELS } from './FieldPalette';

const MAX_W = 700; // max on-screen canvas width

function useHtmlImage(src: string): HTMLImageElement | undefined {
  const ref = useRef<HTMLImageElement>();
  if (!ref.current || ref.current.src !== src) {
    const img = new window.Image();
    img.src = src;
    ref.current = img;
  }
  return ref.current;
}

export function EditorCanvas({
  event, selectedId, onSelect, onMove,
}: {
  event: CertEvent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const scale = Math.min(1, MAX_W / event.bgWidth);
  const img = useHtmlImage(event.background);

  const handleDrag = (f: Field) => (e: Konva.KonvaEventObject<DragEvent>) => {
    onMove(f.id, e.target.x() / scale, e.target.y() / scale);
  };

  return (
    <Stage width={event.bgWidth * scale} height={event.bgHeight * scale}
      style={{ border: '1px solid #ccc' }}>
      <Layer>
        {img && <KImage image={img} width={event.bgWidth * scale} height={event.bgHeight * scale} />}
        {event.fields.map(f => (
          <Text
            key={f.id}
            text={FIELD_LABELS[f.tipe]}
            x={f.x * scale}
            y={f.y * scale}
            fontSize={f.ukuran * scale}
            fill={f.warna}
            draggable
            onClick={() => onSelect(f.id)}
            onTap={() => onSelect(f.id)}
            onDragStart={() => onSelect(f.id)}
            onDragEnd={handleDrag(f)}
            stroke={selectedId === f.id ? '#1e90ff' : undefined}
            strokeWidth={selectedId === f.id ? 0.5 : 0}
          />
        ))}
      </Layer>
    </Stage>
  );
}
```

> Note on placeholder `Rect` import: remove `Rect` from the import if unused to keep `tsc` clean. It is listed in case you add a selection box; otherwise delete it.

- [ ] **Step 2: Wire it into the editor**

In `CertificateEditor.tsx`, replace the canvas slot content:
```tsx
import { EditorCanvas } from './EditorCanvas';
// ...
const moveField = (id: string, x: number, y: number) =>
  update({ ...event, fields: event.fields.map(f => f.id === id ? { ...f, x, y } : f) });
// ...
<div style={{ flex: 1 }}>
  <EditorCanvas event={event} selectedId={selectedId} onSelect={setSelectedId} onMove={moveField} />
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run dev`. Add fields → drag them over the background → positions stick after reload. Selecting a field highlights it.

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean (delete unused `Rect` import if it errors).
```bash
git add src/components/editor/EditorCanvas.tsx src/components/editor/CertificateEditor.tsx
git commit -m "feat: add konva canvas with draggable fields"
```

---

## Task 12: Editor — field properties + number/event settings

**Files:**
- Create: `src/components/editor/FieldProperties.tsx`
- Modify: `src/components/editor/CertificateEditor.tsx`

- [ ] **Step 1: Implement the properties panel**

Create `src/components/editor/FieldProperties.tsx`:
```tsx
import type { CertEvent, Field, Perataan } from '../../types';

const FONTS = ['Helvetica', 'Times', 'Courier'];
const ALIGNS: Perataan[] = ['left', 'center', 'right'];

export function FieldProperties({
  event, selected, onField, onEvent, onDelete,
}: {
  event: CertEvent;
  selected: Field | undefined;
  onField: (patch: Partial<Field>) => void;
  onEvent: (patch: Partial<CertEvent>) => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <h3>Pengaturan Acara</h3>
      <label>Nama acara<br />
        <input value={event.nama} onChange={e => onEvent({ nama: e.target.value })} /></label><br />
      <label>Tanggal<br />
        <input type="date" value={event.tanggal} onChange={e => onEvent({ tanggal: e.target.value })} /></label><br />
      <label>Pola nomor<br />
        <input value={event.polaNomor} onChange={e => onEvent({ polaNomor: e.target.value })} /></label>
      <small> — {'{n}'} {'{bulan}'} {'{tahun}'}</small><br />
      <label>Nomor mulai <input type="number" style={{ width: 60 }} value={event.nomorMulai}
        onChange={e => onEvent({ nomorMulai: Number(e.target.value) })} /></label>{' '}
      <label>Padding <input type="number" style={{ width: 50 }} value={event.nomorPadding}
        onChange={e => onEvent({ nomorPadding: Number(e.target.value) })} /></label><br />
      <label>Penandatangan (nama)<br />
        <input value={event.penandatangan.nama}
          onChange={e => onEvent({ penandatangan: { ...event.penandatangan, nama: e.target.value } })} /></label><br />
      <label>Penandatangan (jabatan)<br />
        <input value={event.penandatangan.jabatan}
          onChange={e => onEvent({ penandatangan: { ...event.penandatangan, jabatan: e.target.value } })} /></label>

      <h3>Properti Field</h3>
      {!selected && <p><em>Pilih field di kanvas.</em></p>}
      {selected && (
        <>
          <label>Font{' '}
            <select value={selected.font} onChange={e => onField({ font: e.target.value })}>
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select></label><br />
          <label>Ukuran <input type="number" style={{ width: 60 }} value={selected.ukuran}
            onChange={e => onField({ ukuran: Number(e.target.value) })} /></label><br />
          <label>Warna <input type="color" value={selected.warna}
            onChange={e => onField({ warna: e.target.value })} /></label><br />
          <label>Lebar <input type="number" style={{ width: 70 }} value={Math.round(selected.lebar)}
            onChange={e => onField({ lebar: Number(e.target.value) })} /></label><br />
          <label>Perataan{' '}
            <select value={selected.perataan} onChange={e => onField({ perataan: e.target.value as Perataan })}>
              {ALIGNS.map(a => <option key={a}>{a}</option>)}
            </select></label><br />
          <button onClick={onDelete} style={{ marginTop: 8, color: 'crimson' }}>Hapus field</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the editor (props slot)**

In `CertificateEditor.tsx`, add handlers and render:
```tsx
import { FieldProperties } from './FieldProperties';
// ...
const selected = event.fields.find(f => f.id === selectedId);
const patchField = (patch: Partial<Field>) =>
  selected && update({ ...event, fields: event.fields.map(f => f.id === selected.id ? { ...f, ...patch } : f) });
const patchEvent = (patch: Partial<CertEvent>) => update({ ...event, ...patch });
const deleteField = () => {
  if (!selected) return;
  update({ ...event, fields: event.fields.filter(f => f.id !== selected.id) });
  setSelectedId(null);
};
// props slot:
<div style={{ width: 240 }}>
  <button onClick={() => navigate({ name: 'home' })}>← Daftar Acara</button>
  <FieldProperties event={event} selected={selected}
    onField={patchField} onEvent={patchEvent} onDelete={deleteField} />
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run dev`. Edit event name/date/number pattern/signatory. Select a field → change font/size/color/width/align and see canvas update. Delete a field re-enables its palette button. Reload → all persists.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/FieldProperties.tsx src/components/editor/CertificateEditor.tsx
git commit -m "feat: add field properties and event/number settings panel"
```

---

## Task 13: Generate — Single mode

**Files:**
- Create: `src/components/generate/GenerateSingle.tsx`, `src/components/generate/GenerateView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement the single generator**

Create `src/components/generate/GenerateSingle.tsx`:
```tsx
import { useState } from 'react';
import type { CertEvent, FieldValues } from '../../types';
import { claimNextNumber } from '../../lib/eventStore';
import { resolveValues } from '../../lib/resolveValues';
import { renderCertificate } from '../../lib/pdfRenderer';
import { downloadBlob } from '../../lib/download';

export function GenerateSingle({ event }: { event: CertEvent }) {
  const [nama, setNama] = useState('');
  const [peran, setPeran] = useState('Peserta');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setError('');
    if (!nama.trim()) { setError('Nama wajib diisi'); return; }
    setBusy(true);
    try {
      const n = claimNextNumber(event.id);
      const values: FieldValues = resolveValues(event, { nama: nama.trim(), peran }, n);
      const bytes = await renderCertificate(event, values);
      downloadBlob(bytes, `Sertifikat - ${nama.trim()}.pdf`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>Satuan</h3>
      <label>Nama <input value={nama} onChange={e => setNama(e.target.value)} /></label>{' '}
      <label>Peran{' '}
        <select value={peran} onChange={e => setPeran(e.target.value)}>
          <option>Peserta</option><option>Narasumber</option><option>Panitia</option>
        </select></label>{' '}
      <button disabled={busy} onClick={generate}>{busy ? 'Memproses…' : 'Unduh PDF'}</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Implement the Generate view wrapper (tabs)**

Create `src/components/generate/GenerateView.tsx`:
```tsx
import { useState } from 'react';
import { getEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { GenerateSingle } from './GenerateSingle';

export function GenerateView({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  if (!event) return <p>Acara tidak ditemukan. <button onClick={() => navigate({ name: 'home' })}>Kembali</button></p>;
  if (event.fields.length === 0)
    return <p>Template belum punya field. <button onClick={() => navigate({ name: 'editor', eventId })}>Buka editor</button></p>;

  return (
    <section>
      <button onClick={() => navigate({ name: 'home' })}>← Daftar Acara</button>
      <h2>Generate — {event.nama}</h2>
      <button onClick={() => setTab('single')} disabled={tab === 'single'}>Satuan</button>{' '}
      <button onClick={() => setTab('bulk')} disabled={tab === 'bulk'}>Massal</button>
      {tab === 'single' && <GenerateSingle event={event} />}
      {tab === 'bulk' && <p>Mode massal di task berikutnya.</p>}
    </section>
  );
}
```

- [ ] **Step 3: Route to it**

In `src/App.tsx`, render `<GenerateView eventId={view.eventId} />` when `view.name === 'generate'`.

- [ ] **Step 4: Verify**

Run: `npm run dev`. Open Generate for an event with fields. Enter a name → "Unduh PDF" downloads a PDF with the background and text in the right places. Generate twice → certificate number increments (check the number field). Blank name → error.

- [ ] **Step 5: Commit**

```bash
git add src/components/generate/ src/App.tsx
git commit -m "feat: add single certificate generation"
```

---

## Task 14: Generate — Bulk mode (upload, map, preview, ZIP)

**Files:**
- Create: `src/components/generate/ColumnMapper.tsx`, `src/components/generate/BulkPreviewTable.tsx`, `src/components/generate/GenerateBulk.tsx`
- Modify: `src/components/generate/GenerateView.tsx`

- [ ] **Step 1: Implement the column mapper**

Create `src/components/generate/ColumnMapper.tsx`:
```tsx
import type { FieldTipe } from '../../types';
import { FIELD_LABELS } from '../editor/FieldPalette';

// Only person-level fields are mapped from the file; the rest come from the event.
const MAPPABLE: FieldTipe[] = ['nama', 'peran'];

export function ColumnMapper({
  headers, mapping, onChange,
}: {
  headers: string[];
  mapping: Partial<Record<FieldTipe, string>>;
  onChange: (m: Partial<Record<FieldTipe, string>>) => void;
}) {
  return (
    <div>
      <h4>Pemetaan Kolom</h4>
      {MAPPABLE.map(tipe => (
        <div key={tipe}>
          <label>{FIELD_LABELS[tipe]}{tipe === 'nama' && ' *'}{' '}
            <select value={mapping[tipe] ?? ''}
              onChange={e => onChange({ ...mapping, [tipe]: e.target.value || undefined })}>
              <option value="">— pilih kolom —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement the preview table**

Create `src/components/generate/BulkPreviewTable.tsx`:
```tsx
import type { ValidatedRow } from '../../lib/dataImporter';

export function BulkPreviewTable({ rows, numbers }: { rows: ValidatedRow[]; numbers: string[] }) {
  return (
    <table border={1} cellPadding={4} style={{ borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr><th>#</th><th>Nama</th><th>Peran</th><th>Nomor</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: r.valid ? undefined : '#fff0f0' }}>
            <td>{i + 1}</td>
            <td>{r.values.nama ?? ''}</td>
            <td>{r.values.peran ?? ''}</td>
            <td>{r.valid ? numbers[i] : '—'}</td>
            <td>{r.valid ? 'OK' : r.warning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Implement the bulk generator**

Create `src/components/generate/GenerateBulk.tsx`:
```tsx
import { useState } from 'react';
import type { CertEvent, FieldTipe, FieldValues } from '../../types';
import { parseFile, applyMapping, validateRows, type ValidatedRow } from '../../lib/dataImporter';
import { buildCertNumber } from '../../lib/numberFormatter';
import { claimNextNumber } from '../../lib/eventStore';
import { resolveValues } from '../../lib/resolveValues';
import { renderCertificate } from '../../lib/pdfRenderer';
import { buildZip, downloadBlob } from '../../lib/download';
import { ColumnMapper } from './ColumnMapper';
import { BulkPreviewTable } from './BulkPreviewTable';

export function GenerateBulk({ event }: { event: CertEvent }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldTipe, string>>>({});
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  // Preview numbers are illustrative (start from nomorTerakhir+1); real numbers
  // are claimed atomically at generation time so concurrent runs never collide.
  const validCount = rows.filter(r => r.valid).length;
  let seq = Math.max(event.nomorTerakhir + 1, event.nomorMulai);
  const previewNumbers = rows.map(r =>
    r.valid ? buildCertNumber(event.polaNomor, seq++, event.nomorPadding, new Date(event.tanggal)) : '');

  async function handleFile(file: File) {
    setError('');
    try {
      const parsed = await parseFile(file);
      if (parsed.headers.length === 0) throw new Error('File kosong atau header tidak terbaca');
      setHeaders(parsed.headers);
      const guess = parsed.headers.find(h => /nama/i.test(h));
      const m: Partial<Record<FieldTipe, string>> = guess ? { nama: guess } : {};
      setMapping(m);
      setRows(validateRows(applyMapping(parsed.rows, m)));
    } catch (e) { setError((e as Error).message); }
  }

  function remap(m: Partial<Record<FieldTipe, string>>) {
    setMapping(m);
    // re-run mapping requires original rows; re-read from current rows' source
    setRows(prev => validateRows(prev.map(r => r.values))); // keep, but mapping change handled below
  }

  // Simpler: store raw rows to re-map. Keep a ref to original parsed rows.
  // (Implementation note: lift raw rows into state if remapping by other columns is needed.)

  async function generate() {
    if (!mapping.nama) { setError('Kolom Nama wajib dipetakan'); return; }
    if (validCount === 0) { setError('Tidak ada baris valid'); return; }
    setError('');
    const files: { name: string; bytes: Uint8Array }[] = [];
    let done = 0;
    for (const r of rows) {
      if (!r.valid) continue;
      const n = claimNextNumber(event.id);
      const values: FieldValues = resolveValues(event, r.values, n);
      files.push({ name: `Sertifikat - ${values.nama}.pdf`, bytes: await renderCertificate(event, values) });
      setProgress(Math.round((++done / validCount) * 100));
    }
    const zip = await buildZip(files);
    downloadBlob(zip, `Sertifikat - ${event.nama}.zip`, 'application/zip');
    setProgress(null);
  }

  return (
    <section>
      <h3>Massal</h3>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {headers.length > 0 && (
        <>
          <ColumnMapper headers={headers} mapping={mapping} onChange={remap} />
          <p>{validCount} valid / {rows.length} baris</p>
          <BulkPreviewTable rows={rows} numbers={previewNumbers} />
          <button disabled={progress !== null} onClick={generate} style={{ marginTop: 8 }}>
            {progress === null ? 'Generate & Unduh ZIP' : `Memproses… ${progress}%`}
          </button>
        </>
      )}
    </section>
  );
}
```

> **Implementation note (fix the remap shortcut):** `remap` above must re-apply the new mapping to the **original parsed rows**, not the already-mapped values. Lift the raw parsed rows into state: add `const [raw, setRaw] = useState<Record<string,string>[]>([])`, set it in `handleFile` (`setRaw(parsed.rows)`), and make `remap` do `setRows(validateRows(applyMapping(raw, m)))`. Do this when implementing — do not ship the placeholder `remap`.

- [ ] **Step 4: Wire bulk into GenerateView**

In `GenerateView.tsx`, import `GenerateBulk` and replace the bulk placeholder:
```tsx
import { GenerateBulk } from './GenerateBulk';
// ...
{tab === 'bulk' && <GenerateBulk event={event} />}
```

- [ ] **Step 5: Verify**

Run: `npm run dev`. Prepare a CSV with `Nama,Jabatan` and one blank-name row. Upload → headers detected, Nama auto-mapped, blank row flagged red and excluded from numbering. Map Jabatan→Peran. Click Generate → progress runs to 100% → a ZIP downloads with one PDF per valid row. Reopen the event → `nomorTerakhir` advanced by the number of valid rows. Repeat with an `.xlsx` file.

- [ ] **Step 6: Commit**

```bash
git add src/components/generate/ColumnMapper.tsx src/components/generate/BulkPreviewTable.tsx src/components/generate/GenerateBulk.tsx src/components/generate/GenerateView.tsx
git commit -m "feat: add bulk generation with mapping, preview, and ZIP"
```

---

## Task 15: localStorage quota guard

**Files:**
- Modify: `src/lib/eventStore.ts`, `src/components/EventList.tsx`

- [ ] **Step 1: Make writes detect quota errors**

In `src/lib/eventStore.ts`, wrap `writeAll`:
```ts
function writeAll(events: CertEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch (e) {
    throw new Error('Penyimpanan penuh. Hapus acara lama untuk melanjutkan.');
  }
}
```

- [ ] **Step 2: Surface the error on Home**

In `EventList.tsx`, the `handleNew` catch already shows `error`. Confirm the message from a failed save propagates (it does — `save` calls `saveEvent` which calls `writeAll`). No further change needed beyond verifying the catch wraps `save`.

- [ ] **Step 3: Verify**

Run the full test suite and build:
```bash
npm run test && npm run build
```
Expected: all tests PASS, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/eventStore.ts src/components/EventList.tsx
git commit -m "feat: guard localStorage quota with a clear message"
```

---

## Task 16: Final verification + deploy config

**Files:**
- Create: `README.md`
- Modify: `vite.config.ts` (set `base` for static hosting if needed)

- [ ] **Step 1: Run the full suite**

Run: `npm run test`
Expected: all suites PASS (numberFormatter, eventStore, dataImporter, pdfRenderer, resolveValues).

- [ ] **Step 2: Production build + preview**

Run: `npm run build && npm run preview`
Open the preview URL and walk the full flow: create event → place fields → single download → bulk ZIP. Confirm PDFs open correctly.

- [ ] **Step 3: Write README**

Create `README.md` with: what the app does, `npm install`, `npm run dev`, `npm run test`, `npm run build`, and a note that data lives in the browser's localStorage (per-browser, no server) and the documented future-upgrade path (backend, login, email, QR).

- [ ] **Step 4: Commit**

```bash
git add README.md vite.config.ts
git commit -m "docs: add README and finalize build config"
```

---

## Self-Review Notes (coverage map)

- Upload background PNG/JPG per event → Task 9 (`loadImage`, EventList).
- Visual drag-drop editor → Tasks 10–12.
- All 7 dynamic fields → `types.ts` (Task 2), palette (Task 10), resolver (Task 7).
- Configurable per-event number pattern + persistent sequence → Tasks 3, 4, 12.
- Single mode → Task 13. Bulk Excel/CSV → mapping/preview/ZIP → Task 14.
- localStorage persistence → Task 4; quota guard → Task 15.
- PDF vector text over background, 1:1 coordinates → Task 6.
- Error/edge cases: bad/oversized image (Task 9), empty/unmapped file (Tasks 5, 14), blank-name skip without consuming number (Tasks 5, 14), long-name auto-shrink (Task 6 `fitFontSize`), quota (Task 15), bulk progress (Task 14).
- Tests for NumberFormatter, EventStore, DataImporter, PdfRenderer (+ resolveValues) → Tasks 3–7.
- Future-upgrade path documented → Task 16 README; `EventStore` isolates persistence for a later API swap.
```
