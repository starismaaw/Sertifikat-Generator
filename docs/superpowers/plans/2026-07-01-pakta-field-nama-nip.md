# Field Gabungan "Nama & NIP" (Pakta Integritas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah field tipe baru `namaNip` di editor Pakta Integritas — satu blok draggable dua baris (nama bergaris bawah + `"NIP. <nip>"` di bawahnya) yang zona editornya sama persis dengan hasil render PDF.

**Architecture:** Field baru di-*special-case* di titik yang sama seperti field `tandaTangan` yang sudah ada — di render loop `pdfRenderer.ts` (dua `drawText` + satu `drawLine` garis bawah) dan di `EditorCanvas.tsx` (Group Konva draggable berisi 2 `Text`). Tidak ada key `FieldValues` baru — field ini membaca `values.nama`/`values.nip` yang sudah ada.

**Tech Stack:** TypeScript, React, react-konva (Konva.js), pdf-lib, vitest.

**Spec:** [`docs/superpowers/specs/2026-07-01-pakta-field-nama-nip-design.md`](../specs/2026-07-01-pakta-field-nama-nip-design.md)

---

### Task 1: Daftarkan tipe field `namaNip` di sistem tipe & palet

**Files:**
- Modify: `src/types.ts:3-13`
- Modify: `src/components/editor/FieldPalette.tsx:3-14`
- Modify: `src/components/pakta-admin/PaktaPalette.tsx:3-10`

- [ ] **Step 1: Tambah `'namaNip'` ke union `FieldTipe`**

Di `src/types.ts`, ubah:

```ts
export type FieldTipe =
  | 'nama'
  | 'nomor'
  | 'acara'
  | 'tanggal'
  | 'peran'
  | 'penandatangan'
  | 'namaPenandatangan'
  | 'nip'
  | 'jabatan'
  | 'tandaTangan';
```

menjadi:

```ts
export type FieldTipe =
  | 'nama'
  | 'nomor'
  | 'acara'
  | 'tanggal'
  | 'peran'
  | 'penandatangan'
  | 'namaPenandatangan'
  | 'nip'
  | 'jabatan'
  | 'namaNip'
  | 'tandaTangan';
```

- [ ] **Step 2: Jalankan type-check untuk konfirmasi error yang diharapkan**

Run: `npx tsc -b --noEmit`
Expected: FAIL dengan pesan seperti `Property 'namaNip' is missing in type '{ nama: string; ... }' but required in type 'Record<FieldTipe, string>'` yang menunjuk ke `src/components/editor/FieldPalette.tsx` (const `LABELS`). Ini membuktikan `FieldTipe` sudah bertambah dan sekarang `LABELS`/`PAKTA_LABELS` perlu diperbarui.

- [ ] **Step 3: Tambah label di `FieldPalette.tsx` (dipakai bersama oleh `EditorCanvas` & `FieldProperties`, wajib lengkap karena tipenya `Record<FieldTipe, string>`)**

Di `src/components/editor/FieldPalette.tsx`, ubah:

```ts
const LABELS: Record<FieldTipe, string> = {
  nama: 'Nama peserta',
  nomor: 'Nomor sertifikat',
  acara: 'Nama acara',
  tanggal: 'Tanggal acara',
  peran: 'Peran / jabatan',
  namaPenandatangan: 'Nama penandatangan',
  penandatangan: 'Jabatan penandatangan',
  nip: 'NIP',
  jabatan: 'Jabatan',
  tandaTangan: 'Tanda Tangan',
};
```

menjadi:

```ts
const LABELS: Record<FieldTipe, string> = {
  nama: 'Nama peserta',
  nomor: 'Nomor sertifikat',
  acara: 'Nama acara',
  tanggal: 'Tanggal acara',
  peran: 'Peran / jabatan',
  namaPenandatangan: 'Nama penandatangan',
  penandatangan: 'Jabatan penandatangan',
  nip: 'NIP',
  jabatan: 'Jabatan',
  namaNip: 'Nama & NIP',
  tandaTangan: 'Tanda Tangan',
};
```

Catatan: `namaNip` **tidak** ditambahkan ke array `SECTIONS` di file yang sama — field ini tidak boleh tampil di palet editor Sertifikat, hanya di palet Pakta Integritas (Task ini, Step 4).

- [ ] **Step 4: Tambah field ke palet Pakta**

Di `src/components/pakta-admin/PaktaPalette.tsx`, ubah:

```ts
const PAKTA_LABELS: Partial<Record<FieldTipe, string>> = {
  nama: 'Nama pegawai',
  nip: 'NIP',
  jabatan: 'Jabatan',
  tandaTangan: 'Tanda Tangan',
};

const PAKTA_FIELDS: FieldTipe[] = ['nama', 'nip', 'jabatan', 'tandaTangan'];
```

menjadi:

```ts
const PAKTA_LABELS: Partial<Record<FieldTipe, string>> = {
  nama: 'Nama pegawai',
  nip: 'NIP',
  jabatan: 'Jabatan',
  namaNip: 'Nama & NIP',
  tandaTangan: 'Tanda Tangan',
};

const PAKTA_FIELDS: FieldTipe[] = ['nama', 'nip', 'jabatan', 'namaNip', 'tandaTangan'];
```

- [ ] **Step 5: Jalankan type-check untuk konfirmasi bersih**

Run: `npx tsc -b --noEmit`
Expected: PASS (tidak ada error)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/components/editor/FieldPalette.tsx src/components/pakta-admin/PaktaPalette.tsx
git commit -m "feat(pakta): daftarkan tipe field namaNip di sistem tipe & palet"
```

---

### Task 2: Render field `namaNip` ke PDF (`pdfRenderer.ts`) — TDD

**Files:**
- Modify: `src/lib/pdfRenderer.ts:106-170`
- Test: `tests/pdfRenderer.test.ts`

- [ ] **Step 1: Tambah helper counter & extractor di test file**

Di `tests/pdfRenderer.test.ts`, tambahkan setelah fungsi `countImages` (setelah baris 73, sebelum `describe('renderPakta', ...)`):

```ts
/** Hitung token operator PDF tertentu (mis. 'Tj' untuk teks, 'S' untuk garis) di content stream. */
function countTokens(content: string, token: string): number {
  return content.split(/\s+/).filter(t => t === token).length;
}

/** Ambil semua nilai Y dari operator text-matrix "1 0 0 1 x y Tm", berurutan sesuai kemunculan. */
function extractTmYValues(content: string): number[] {
  const matches = [...content.matchAll(/^1 0 0 1 [-\d.]+ (-?[\d.]+) Tm$/gm)];
  return matches.map(m => parseFloat(m[1]));
}
```

- [ ] **Step 2: Tulis 4 test yang gagal untuk field `namaNip`**

Tambahkan di dalam `describe('renderPakta', ...)`, setelah test terakhir (`'menempatkan PNG tanda tangan pada koordinat field yang benar'`, sebelum baris penutup `});` di baris 149):

```ts
  it('field namaNip: menggambar 2 baris teks + 1 garis bawah saat nama & NIP terisi', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi Santoso', nip: '198501012010011001' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(countTokens(content, 'Tj')).toBe(2);
    expect(countTokens(content, 'S')).toBe(1);
  });

  it('field namaNip: baris NIP tetap tampil ("NIP. " saja) walau data NIP kosong', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi Santoso' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(countTokens(content, 'Tj')).toBe(2);
    expect(countTokens(content, 'S')).toBe(1);
  });

  it('field namaNip: dilewati total (tanpa teks/garis) bila nama kosong', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nip: '198501012010011001' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(countTokens(content, 'Tj')).toBe(0);
    expect(countTokens(content, 'S')).toBe(0);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(800);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it('field namaNip: baris NIP tepat 1 tinggi-baris (ukuran*1.4) di bawah baris nama', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi Santoso', nip: '198501012010011001' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    const [y1, y2] = extractTmYValues(content);
    expect(y1 - y2).toBeCloseTo(20 * 1.4, 1);
  });
```

- [ ] **Step 3: Jalankan test untuk konfirmasi gagal**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: FAIL — TypeScript akan menolak literal `tipe: 'namaNip'` bila Task 1 belum selesai (harus sudah selesai), dan ke-4 test baru gagal dengan `countTokens(content, 'Tj')` bernilai `0` (bukan `2`), karena `renderPakta` belum tahu cara menangani `namaNip` (field jatuh ke cabang generik `values[field.tipe]` yang mengembalikan `undefined` → teks kosong → dilewati).

- [ ] **Step 4: Implementasikan `drawNamaNipField` di `pdfRenderer.ts`**

Di `src/lib/pdfRenderer.ts`, tambahkan fungsi baru setelah `drawTextField` (setelah baris 126, sebelum komentar `/** Render satu Pakta Integritas ke PDF. ... */` di baris 128):

```ts
/**
 * Gambar field gabungan Nama & NIP: baris nama (bergaris bawah, lebar garis
 * mengikuti lebar teks) lalu baris "NIP. <nip>" satu tinggi-baris di bawahnya.
 */
async function drawNamaNipField(
  page: PDFPage,
  field: Field,
  nama: string,
  nip: string,
  getFont: (family: string, weight: FontWeight) => Promise<PDFFont>,
  pageHeight: number,
): Promise<void> {
  const font = await getFont(field.fontFamily, field.fontWeight);
  const lineHeight = field.ukuran * 1.4;
  const color = hexToRgb(field.warna);

  // Baris 1: nama, bergaris bawah pas selebar teks.
  const namaSize = fitFontSize(nama, field, font);
  const namaAscent = font.heightAtSize(namaSize, { descender: false });
  const namaX = alignedX(nama, field, font, namaSize);
  const namaY = pageHeight - field.y - namaAscent;
  page.drawText(nama, { x: namaX, y: namaY, size: namaSize, font, color });

  const namaWidth = browserTextWidth(
    nama,
    field.fontFamily,
    field.fontWeight,
    namaSize,
    () => font.widthOfTextAtSize(nama, namaSize),
  );
  const underlineY = namaY - namaSize * 0.08;
  page.drawLine({
    start: { x: namaX, y: underlineY },
    end: { x: namaX + namaWidth, y: underlineY },
    thickness: Math.max(0.5, namaSize * 0.04),
    color,
  });

  // Baris 2: "NIP. <nip>", tanpa garis bawah. field.y = TOP baris 1;
  // TOP baris 2 = field.y + lineHeight (satu tinggi-baris di bawahnya).
  const nipText = `NIP. ${nip}`;
  const nipSize = fitFontSize(nipText, field, font);
  const nipAscent = font.heightAtSize(nipSize, { descender: false });
  page.drawText(nipText, {
    x: alignedX(nipText, field, font, nipSize),
    y: pageHeight - (field.y + lineHeight) - nipAscent,
    size: nipSize,
    font,
    color,
  });
}
```

- [ ] **Step 5: Panggil `drawNamaNipField` dari render loop `renderPakta`**

Di `src/lib/pdfRenderer.ts`, ubah loop di `renderPakta` (baris 151-167) dari:

```ts
  for (const field of template.fields) {
    if (field.tipe === 'tandaTangan') {
      if (!sigImage) continue;
      const h = field.tinggi ?? field.lebar / 2;
      // field.y = TOP kotak; konversi ke origin bawah pdf-lib.
      page.drawImage(sigImage, {
        x: field.x,
        y: template.bgHeight - field.y - h,
        width: field.lebar,
        height: h,
      });
      continue;
    }
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    await drawTextField(page, field, text, getFont, template.bgHeight);
  }
```

menjadi:

```ts
  for (const field of template.fields) {
    if (field.tipe === 'tandaTangan') {
      if (!sigImage) continue;
      const h = field.tinggi ?? field.lebar / 2;
      // field.y = TOP kotak; konversi ke origin bawah pdf-lib.
      page.drawImage(sigImage, {
        x: field.x,
        y: template.bgHeight - field.y - h,
        width: field.lebar,
        height: h,
      });
      continue;
    }
    if (field.tipe === 'namaNip') {
      const nama = (values.nama ?? '').toString();
      if (!nama) continue;
      await drawNamaNipField(page, field, nama, (values.nip ?? '').toString(), getFont, template.bgHeight);
      continue;
    }
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    await drawTextField(page, field, text, getFont, template.bgHeight);
  }
```

- [ ] **Step 6: Jalankan test untuk konfirmasi lolos**

Run: `npx vitest run tests/pdfRenderer.test.ts`
Expected: PASS — semua test termasuk 4 test baru lolos.

- [ ] **Step 7: Jalankan seluruh suite test untuk pastikan tidak ada regresi**

Run: `npm run test`
Expected: PASS — semua file test (termasuk `tests/paktaAdmin.test.ts`, `tests/paktaStore.test.ts`, dll.) tetap hijau.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pdfRenderer.ts tests/pdfRenderer.test.ts
git commit -m "feat(pakta): render field namaNip (nama bergaris bawah + baris NIP) ke PDF"
```

---

### Task 3: Preview field `namaNip` di editor (`EditorCanvas.tsx`)

**Files:**
- Modify: `src/components/editor/EditorCanvas.tsx`

- [ ] **Step 1: Import `Group` dari react-konva**

Di `src/components/editor/EditorCanvas.tsx`, ubah baris 2 dari:

```tsx
import { Stage, Layer, Image as KImage, Rect, Text } from 'react-konva';
```

menjadi:

```tsx
import { Stage, Layer, Image as KImage, Rect, Text, Group } from 'react-konva';
```

- [ ] **Step 2: Perluas kalkulasi tinggi zona untuk `namaNip` (2 baris)**

Di `src/components/editor/EditorCanvas.tsx`, ubah blok (baris 75-84) dari:

```tsx
            {event.fields.map(f => {
              const isSelected = selectedId === f.id;
              const sx = f.x * scale;
              const sy = f.y * scale;
              const sw = f.lebar * scale;
              // Zona harus sama persis dengan yang dipakai renderPakta/renderCertificate:
              // field tandaTangan pakai field.tinggi (bukan ukuran font) sebagai tinggi gambar.
              const zoneHeight = f.tipe === 'tandaTangan'
                ? (f.tinggi ?? f.lebar / 2) * scale
                : f.ukuran * scale * 1.4;
```

menjadi:

```tsx
            {event.fields.map(f => {
              const isSelected = selectedId === f.id;
              const sx = f.x * scale;
              const sy = f.y * scale;
              const sw = f.lebar * scale;
              const lineHeight = f.ukuran * scale * 1.4;
              // Zona harus sama persis dengan yang dipakai renderPakta/renderCertificate:
              // - tandaTangan pakai field.tinggi (bukan ukuran font) sebagai tinggi gambar.
              // - namaNip 2 baris teks (nama + NIP), tingginya 2x tinggi satu baris.
              const zoneHeight = f.tipe === 'tandaTangan'
                ? (f.tinggi ?? f.lebar / 2) * scale
                : f.tipe === 'namaNip'
                  ? lineHeight * 2
                  : lineHeight;
```

- [ ] **Step 3: Render Group 2-baris untuk `namaNip`, draggable sebagai satu unit**

Di file yang sama, ubah blok `return (...)` di dalam `.map(f => {...})` (baris 86-121) dari:

```tsx
              return (
                <Fragment key={f.id}>
                  <Rect
                    x={sx - BOUNDARY_PADDING * scale}
                    y={sy - BOUNDARY_PADDING * scale}
                    width={sw + BOUNDARY_PADDING * 2 * scale}
                    height={zoneHeight + BOUNDARY_PADDING * 2 * scale}
                    fill={isSelected ? 'rgba(0,117,222,0.05)' : 'rgba(0,0,0,0.01)'}
                    stroke={isSelected ? '#0075de' : 'rgba(0,117,222,0.4)'}
                    strokeWidth={isSelected ? 2 : 0.8}
                    dash={isSelected ? undefined : [4, 3]}
                    cornerRadius={3}
                    listening={false}
                  />
                  <Text
                    text={FIELD_LABELS[f.tipe]}
                    x={sx}
                    y={sy}
                    fontFamily={f.fontFamily}
                    fontStyle={konvaFontStyle(f.fontWeight)}
                    fontSize={f.ukuran * scale}
                    fill={f.warna}
                    width={sw}
                    align={f.perataan}
                    draggable
                    onClick={() => onSelect(f.id)}
                    onTap={() => onSelect(f.id)}
                    onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                      const x = e.target.x() / scale;
                      const y = e.target.y() / scale;
                      onSelect(f.id);
                      onMove(f.id, x, y);
                    }}
                  />
                </Fragment>
              );
            })}
```

menjadi:

```tsx
              const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
                const x = e.target.x() / scale;
                const y = e.target.y() / scale;
                onSelect(f.id);
                onMove(f.id, x, y);
              };

              return (
                <Fragment key={f.id}>
                  <Rect
                    x={sx - BOUNDARY_PADDING * scale}
                    y={sy - BOUNDARY_PADDING * scale}
                    width={sw + BOUNDARY_PADDING * 2 * scale}
                    height={zoneHeight + BOUNDARY_PADDING * 2 * scale}
                    fill={isSelected ? 'rgba(0,117,222,0.05)' : 'rgba(0,0,0,0.01)'}
                    stroke={isSelected ? '#0075de' : 'rgba(0,117,222,0.4)'}
                    strokeWidth={isSelected ? 2 : 0.8}
                    dash={isSelected ? undefined : [4, 3]}
                    cornerRadius={3}
                    listening={false}
                  />
                  {f.tipe === 'namaNip' ? (
                    <Group
                      x={sx}
                      y={sy}
                      draggable
                      onClick={() => onSelect(f.id)}
                      onTap={() => onSelect(f.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <Text
                        text="Nama Pegawai"
                        x={0}
                        y={0}
                        fontFamily={f.fontFamily}
                        fontStyle={konvaFontStyle(f.fontWeight)}
                        fontSize={f.ukuran * scale}
                        fill={f.warna}
                        width={sw}
                        align={f.perataan}
                        textDecoration="underline"
                      />
                      <Text
                        text="NIP. XXXXXXXXXXXXXXXXXX"
                        x={0}
                        y={lineHeight}
                        fontFamily={f.fontFamily}
                        fontStyle={konvaFontStyle(f.fontWeight)}
                        fontSize={f.ukuran * scale}
                        fill={f.warna}
                        width={sw}
                        align={f.perataan}
                      />
                    </Group>
                  ) : (
                    <Text
                      text={FIELD_LABELS[f.tipe]}
                      x={sx}
                      y={sy}
                      fontFamily={f.fontFamily}
                      fontStyle={konvaFontStyle(f.fontWeight)}
                      fontSize={f.ukuran * scale}
                      fill={f.warna}
                      width={sw}
                      align={f.perataan}
                      draggable
                      onClick={() => onSelect(f.id)}
                      onTap={() => onSelect(f.id)}
                      onDragEnd={handleDragEnd}
                    />
                  )}
                </Fragment>
              );
            })}
```

- [ ] **Step 4: Build untuk pastikan tidak ada error TypeScript/JSX**

Run: `npm run build`
Expected: PASS — 0 error (boleh ada warning ukuran chunk yang sudah ada sebelumnya, itu tidak terkait perubahan ini).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/EditorCanvas.tsx
git commit -m "feat(pakta): preview field namaNip di editor sebagai blok 2-baris draggable"
```

---

### Task 4: Verifikasi visual manual di preview browser

Komponen `EditorCanvas.tsx` tidak punya test otomatis (konvensi proyek — lihat Task 2 di plan sebelumnya `2026-06-30-pakta-03-ui-admin.md` dan riwayat kerja pada fix zona tanda tangan). Verifikasi dilakukan dengan mount komponen memakai data sintetis, tanpa perlu kredensial Supabase.

- [ ] **Step 1: Jalankan dev server**

Gunakan tool `preview_start` dengan config `"dev"` dari `.claude/launch.json` (sudah ada, menjalankan `npm run dev` di port 5173).

- [ ] **Step 2: Mount `EditorCanvas` dengan field `namaNip` lewat `preview_eval`**

Jalankan `preview_eval` dengan ekspresi berikut (mendinamisasi import modul asli lewat Vite dev server, sama seperti teknik verifikasi zona tanda tangan sebelumnya):

```js
(async () => {
  const reactMod = (await import('/node_modules/.vite/deps/react.js').catch(() => import('react'))).default ?? window.__React?.default;
  const rdcMod = (await import('/node_modules/.vite/deps/react-dom_client.js').catch(() => import('react-dom/client'))).default ?? window.__RDC?.default;
  const { EditorCanvas } = await import('/src/components/editor/EditorCanvas.tsx');
  const div = document.createElement('div');
  div.id = 'debug-harness';
  div.style.position = 'fixed'; div.style.top = '0'; div.style.left = '0'; div.style.zIndex = '999999'; div.style.background = '#eee';
  document.body.appendChild(div);
  const bgWidth = 1000, bgHeight = 700;
  const fakeEvent = {
    id: 'x', nama: 'x', tanggal: '', background: '', bgWidth, bgHeight,
    fields: [
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 300, lebar: 400, fontFamily: 'Playfair Display', fontWeight: 'Regular', ukuran: 24, warna: '#000000', perataan: 'center', formatter: 'none' },
      { id: 'sig1', tipe: 'tandaTangan', x: 100, y: 100, lebar: 300, tinggi: 150, fontFamily: 'Playfair Display', fontWeight: 'Regular', ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' },
    ],
    polaNomor: '', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0, penandatangan: { nama: '', jabatan: '' },
  };
  const root = rdcMod.createRoot(div);
  root.render(reactMod.createElement(EditorCanvas, {
    event: fakeEvent, selectedId: null, onSelect: () => {}, onMove: () => {}, showGrid: false,
  }));
  window.__debugRoot = root;
  return 'mounted';
})();
```

Jika `window.__React`/`window.__RDC` belum ada dari sesi sebelumnya (kemungkinan besar tidak ada, karena ini sesi browser baru), jalankan dulu langkah eksplisit berikut sebagai gantinya (mengikuti pola yang terbukti bekerja pada sesi sebelumnya):

```js
const reactMod = await import('/node_modules/.vite/deps/react.js');
window.__React = reactMod;
const rdcMod = await import('/node_modules/.vite/deps/react-dom_client.js');
window.__RDC = rdcMod;
'loaded'
```

lalu jalankan ulang skrip mount di atas.

- [ ] **Step 3: Screenshot & periksa hasil**

Jalankan `preview_screenshot`. Konfirmasi secara visual:
- Blok "Nama Pegawai" (bergaris bawah, garis pas selebar teks) di atas "NIP. XXXXXXXXXXXXXXXXXX".
- Kotak zona putus-putus di sekitar field `namaNip` tingginya kira-kira 2x kotak field satu baris biasa (bandingkan dengan kotak field `tandaTangan` di sampingnya sebagai referensi visual, bukan perbandingan langsung karena tandaTangan pakai `tinggi` bukan `ukuran`).
- Tidak ada error di `preview_console_logs`.

- [ ] **Step 4: Bersihkan harness**

Jalankan `preview_eval` dengan ekspresi:

```js
(() => { window.__debugRoot.unmount(); document.getElementById('debug-harness').remove(); return 'cleaned'; })()
```

---

### Task 5: Validasi akhir & handoff

**Files:**
- Modify: `docs/agent-handoff.md`

- [ ] **Step 1: Jalankan validasi penuh**

```bash
npm run build
npm run test
```

Expected: keduanya PASS. (Catatan: proyek ini tidak punya script `npm run lint` — konsisten dengan temuan sesi sebelumnya, jangan laporkan "lint clean", laporkan "tidak ada script lint".)

- [ ] **Step 2: Perbarui `docs/agent-handoff.md`**

Tulis ulang (overwrite, bukan append) mengikuti format standar proyek (lihat `AGENTS.md` bagian "Handoff Format"), isi ringkas: branch `feat/pakta-nama-nip-field`, task ini, file yang diubah (Task 1-3), hasil build/test, status "menunggu approval user untuk commit dokumen handoff / push".

- [ ] **Step 3: Commit dokumentasi handoff**

```bash
git add docs/agent-handoff.md
git commit -m "docs(pakta): update handoff — field namaNip selesai diimplementasikan"
```

Tidak push, tidak buat PR, tidak merge — tunggu instruksi eksplisit dari user (sesuai `AGENTS.md`: "Do NOT commit or push until user verifies and approves" untuk push/PR/merge; commit lokal untuk dokumentasi diperbolehkan mengikuti pola sesi-sesi sebelumnya).

---

## Ringkasan Urutan Commit

1. `feat(pakta): daftarkan tipe field namaNip di sistem tipe & palet`
2. `feat(pakta): render field namaNip (nama bergaris bawah + baris NIP) ke PDF`
3. `feat(pakta): preview field namaNip di editor sebagai blok 2-baris draggable`
4. `docs(pakta): update handoff — field namaNip selesai diimplementasikan`
