# Pakta Integritas — Rencana 1: Mesin Dokumen Inti

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan jenis field & renderer PDF yang bisa menempelkan gambar tanda tangan ke dokumen Pakta — murni sisi klien, teruji unit, tanpa backend.

**Architecture:** Perluas `FieldTipe` (tambah `nip`, `jabatan`, `tandaTangan`) dan `Field` (tambah `tinggi?` untuk kotak ttd). Refaktor helper bersama di `src/lib/pdfRenderer.ts` (latar, font getter, gambar teks) lalu tambah `renderPakta()` yang menggambar field teks + menyisipkan PNG tanda tangan pada field `tandaTangan`. Refaktor dijaga oleh tes `renderCertificate` yang sudah ada (tetap hijau).

**Tech Stack:** TypeScript, pdf-lib, @pdf-lib/fontkit, vitest (jsdom). Tidak ada dependensi npm baru di rencana ini.

**Bagian spec yang dicakup:** §5.1 (jenis field baru `nip`/`jabatan`/`tandaTangan`), §3.3 langkah 4 (sisip PNG ttd ke PDF), §7 (tes penyisipan ttd pada koordinat field).

**Catatan ruang lingkup:** Rencana ini TIDAK mencakup Supabase, UI editor, halaman publik, atau pra-isi dari data signer. Itu ada di Rencana 2–4. Tipe `PaktaTemplate` di sini sengaja minimal (background + dimensi + fields) agar renderer tidak bergantung pada tipe backend.

---

## Struktur File

| File | Tanggung jawab | Aksi |
|---|---|---|
| `src/types.ts` | Definisi `FieldTipe`, `Field`, tipe domain | Modify |
| `src/lib/pdfRenderer.ts` | Render dokumen ke PDF (sertifikat + pakta) | Modify |
| `tests/pdfRenderer.test.ts` | Tes renderer (sudah ada untuk sertifikat) | Modify (tambah blok `renderPakta`) |

---

## Task 1: Perluas jenis field (`types.ts`)

**Files:**
- Modify: `src/types.ts:3-9` (`FieldTipe`), `src/types.ts:11-23` (`Field`)

- [ ] **Step 1: Tambah jenis field baru ke `FieldTipe`**

Ganti definisi `FieldTipe` (saat ini baris 3–9) menjadi:

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

- [ ] **Step 2: Tambah `tinggi?` ke `Field`**

Pada interface `Field`, tambahkan satu properti opsional tepat sebelum penutup `}` (setelah baris `formatter: 'none' | 'uppercase';`):

```ts
  /** Tinggi kotak (px natural). Hanya dipakai field tipe 'tandaTangan'. */
  tinggi?: number;
```

- [ ] **Step 3: Verifikasi tipe meng-compile**

Run: `npx tsc -b`
Expected: tidak ada error TypeScript.

- [ ] **Step 4: Jalankan tes yang ada (regresi)**

Run: `npm test`
Expected: PASS (38 tes), karena penambahan ini hanya memperluas union & menambah properti opsional.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat(pakta): tambah jenis field nip, jabatan, tandaTangan + Field.tinggi"
```

---

## Task 2: Refaktor helper bersama di `pdfRenderer.ts`

Tujuan: ekstrak tiga helper agar dipakai ulang oleh `renderCertificate` dan (nanti) `renderPakta`, tanpa mengubah perilaku. Dijaga tes `renderCertificate` yang sudah ada.

**Files:**
- Modify: `src/lib/pdfRenderer.ts`
- Test (regresi): `tests/pdfRenderer.test.ts` (sudah ada, tidak diubah di task ini)

- [ ] **Step 1: Perbarui import pdf-lib**

Ganti baris 1:

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
```

- [ ] **Step 2: Tambah tiga helper privat**

Sisipkan helper berikut tepat sebelum fungsi `renderCertificate` (sebelum komentar `/** Render one certificate ... */`):

```ts
/** Gambar latar (PNG/JPG data URL) memenuhi seluruh halaman. */
async function drawBackground(
  doc: PDFDocument,
  page: PDFPage,
  background: string,
  width: number,
  height: number,
): Promise<void> {
  const bytes = dataUrlToBytes(background);
  const img = background.includes('image/png')
    ? await doc.embedPng(bytes)
    : await doc.embedJpg(bytes);
  page.drawImage(img, { x: 0, y: 0, width, height });
}

/** Buat pengambil font dengan cache + fallback Helvetica untuk satu dokumen. */
function makeFontGetter(doc: PDFDocument) {
  const fontCache = new Map<string, PDFFont>();
  return async (family: string, weight: FontWeight): Promise<PDFFont> => {
    const key = `${family}-${weight}`;
    if (!fontCache.has(key)) {
      try {
        const res = await fetch(getFontPath(family, weight));
        if (!res.ok) throw new Error(`Font fetch failed: ${getFontPath(family, weight)}`);
        const bytes = await res.arrayBuffer();
        fontCache.set(key, await doc.embedFont(bytes, { subset: true }));
      } catch {
        fontCache.set(key, await doc.embedFont(StandardFonts.Helvetica));
      }
    }
    return fontCache.get(key)!;
  };
}

/** Gambar satu field teks (perataan + penyusutan font + konversi koordinat top→baseline). */
async function drawTextField(
  page: PDFPage,
  field: Field,
  text: string,
  getFont: (family: string, weight: FontWeight) => Promise<PDFFont>,
  pageHeight: number,
): Promise<void> {
  const font = await getFont(field.fontFamily, field.fontWeight);
  const size = fitFontSize(text, field, font);
  // field.y = TOP kotak teks (Konva: origin kiri-atas, y ke bawah).
  // pdf-lib drawText y = BASELINE (origin kiri-bawah, y ke atas).
  const ascent = font.heightAtSize(size, { descender: false });
  page.drawText(text, {
    x: alignedX(text, field, font, size),
    y: pageHeight - field.y - ascent,
    size,
    font,
    color: hexToRgb(field.warna),
  });
}
```

- [ ] **Step 3: Refaktor `renderCertificate` agar memakai helper**

Ganti isi fungsi `renderCertificate` (mulai baris `const page = doc.addPage(...)` sampai sebelum `return doc.save();`) sehingga keseluruhan fungsi menjadi:

```ts
export async function renderCertificate(
  event: CertEvent,
  values: FieldValues,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([event.bgWidth, event.bgHeight]);
  await drawBackground(doc, page, event.background, event.bgWidth, event.bgHeight);

  const getFont = makeFontGetter(doc);

  for (const field of event.fields) {
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    await drawTextField(page, field, text, getFont, event.bgHeight);
  }

  return doc.save();
}
```

- [ ] **Step 4: Jalankan tes regresi**

Run: `npm test -- pdfRenderer`
Expected: PASS — `renderCertificate` tetap menghasilkan PDF 800×600 dan byte > 100. (Refaktor tidak mengubah perilaku.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdfRenderer.ts
git commit -m "refactor(pdf): ekstrak helper drawBackground/makeFontGetter/drawTextField"
```

---

## Task 3: `renderPakta` — render field teks

**Files:**
- Modify: `src/lib/pdfRenderer.ts` (tambah tipe `PaktaTemplate` + fungsi `renderPakta`)
- Test: `tests/pdfRenderer.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/pdfRenderer.test.ts` (dan perbarui import baris 3 menjadi
`import { renderCertificate, renderPakta, PNG_1x1, type PaktaTemplate } from '../src/lib/pdfRenderer';`):

```ts
function makePaktaTemplate(fields: PaktaTemplate['fields']): PaktaTemplate {
  return { background: PNG_1x1, bgWidth: 800, bgHeight: 600, fields };
}

describe('renderPakta', () => {
  it('menghasilkan PDF seukuran latar dengan field teks terisi', async () => {
    const tpl = makePaktaTemplate([
      { id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' },
      { id: 'f2', tipe: 'nip', x: 100, y: 240, lebar: 600,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 18, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi', nip: '19850101' }, null);
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(800);
    expect(Math.round(page.getHeight())).toBe(600);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Jalankan tes — pastikan gagal**

Run: `npm test -- pdfRenderer`
Expected: FAIL — `renderPakta`/`PaktaTemplate` belum ada (error impor/undefined).

- [ ] **Step 3: Implementasi minimal `renderPakta`**

Tambahkan di akhir `src/lib/pdfRenderer.ts`:

```ts
/** Template Pakta minimal untuk rendering (tanpa ketergantungan tipe backend). */
export interface PaktaTemplate {
  background: string;   // data URL
  bgWidth: number;      // lebar natural px
  bgHeight: number;     // tinggi natural px
  fields: Field[];
}

/**
 * Render satu Pakta Integritas ke PDF.
 * `values` mengisi field teks; `signaturePng` (data URL) disisipkan pada field
 * bertipe 'tandaTangan'. Bila null, field tanda tangan dilewati.
 */
export async function renderPakta(
  template: PaktaTemplate,
  values: FieldValues,
  signaturePng: string | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([template.bgWidth, template.bgHeight]);
  await drawBackground(doc, page, template.background, template.bgWidth, template.bgHeight);

  const getFont = makeFontGetter(doc);

  for (const field of template.fields) {
    if (field.tipe === 'tandaTangan') continue; // ditangani di Task 4
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    await drawTextField(page, field, text, getFont, template.bgHeight);
  }

  return doc.save();
}
```

- [ ] **Step 4: Jalankan tes — pastikan lulus**

Run: `npm test -- pdfRenderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdfRenderer.ts tests/pdfRenderer.test.ts
git commit -m "feat(pakta): renderPakta render field teks ke PDF"
```

---

## Task 4: `renderPakta` — sisipkan PNG tanda tangan

**Files:**
- Modify: `src/lib/pdfRenderer.ts` (`renderPakta`)
- Test: `tests/pdfRenderer.test.ts`

- [ ] **Step 1: Tambah helper penghitung image + tes yang gagal**

Perbarui import pdf-lib di atas `tests/pdfRenderer.test.ts` menjadi:

```ts
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
```

Tambahkan helper ini setelah `makePaktaTemplate`:

```ts
/** Hitung jumlah image XObject (latar + tanda tangan) dalam PDF. */
function countImages(doc: PDFDocument): number {
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream &&
        obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
      n++;
    }
  }
  return n;
}
```

Tambahkan tes di dalam `describe('renderPakta', ...)`:

```ts
it('menyisipkan gambar tanda tangan saat field tandaTangan ada', async () => {
  const tpl = makePaktaTemplate([
    { id: 's1', tipe: 'tandaTangan', x: 500, y: 400, lebar: 200, tinggi: 100,
      fontFamily: 'Playfair Display', fontWeight: 'Regular',
      ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
  ]);

  const tanpa = await PDFDocument.load(await renderPakta(tpl, {}, null));
  const dengan = await PDFDocument.load(await renderPakta(tpl, {}, PNG_1x1));

  // Tanpa ttd: hanya latar (1 image). Dengan ttd: latar + ttd (2 image).
  expect(countImages(tanpa)).toBe(1);
  expect(countImages(dengan)).toBe(2);
});
```

- [ ] **Step 2: Jalankan tes — pastikan gagal**

Run: `npm test -- pdfRenderer`
Expected: FAIL — `countImages(dengan)` = 1 (ttd belum disisipkan), diharapkan 2.

- [ ] **Step 3: Implementasi penyisipan tanda tangan**

Di `renderPakta`, ganti baris `if (field.tipe === 'tandaTangan') continue; // ditangani di Task 4` dengan:

```ts
    if (field.tipe === 'tandaTangan') {
      if (!signaturePng) continue;
      const sig = await doc.embedPng(dataUrlToBytes(signaturePng));
      const h = field.tinggi ?? field.lebar / 2;
      // field.y = TOP kotak; konversi ke origin bawah pdf-lib.
      page.drawImage(sig, {
        x: field.x,
        y: template.bgHeight - field.y - h,
        width: field.lebar,
        height: h,
      });
      continue;
    }
```

- [ ] **Step 4: Jalankan tes — pastikan lulus**

Run: `npm test -- pdfRenderer`
Expected: PASS — `countImages(dengan)` = 2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdfRenderer.ts tests/pdfRenderer.test.ts
git commit -m "feat(pakta): sisipkan PNG tanda tangan pada field tandaTangan"
```

---

## Task 5: `renderPakta` — abaikan ttd bila tak ada field, aman tanpa ttd

Mengunci maksud: gambar tanda tangan hanya muncul bila ada field `tandaTangan`; dokumen tetap valid bila field ttd ada tapi ttd belum digores.

**Files:**
- Test: `tests/pdfRenderer.test.ts` (hanya tambah tes — implementasi sudah benar dari Task 3–4)

- [ ] **Step 1: Tulis tes**

Tambahkan di dalam `describe('renderPakta', ...)`:

```ts
it('mengabaikan signaturePng bila tidak ada field tandaTangan', async () => {
  const tpl = makePaktaTemplate([
    { id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
      fontFamily: 'Playfair Display', fontWeight: 'Regular',
      ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' },
  ]);
  // Walau signaturePng diberi, tanpa field tandaTangan tidak ada image tambahan.
  const doc = await PDFDocument.load(await renderPakta(tpl, { nama: 'Budi' }, PNG_1x1));
  expect(countImages(doc)).toBe(1); // hanya latar
});

it('tetap menghasilkan PDF valid bila field tandaTangan ada tapi belum digores', async () => {
  const tpl = makePaktaTemplate([
    { id: 's1', tipe: 'tandaTangan', x: 500, y: 400, lebar: 200, tinggi: 100,
      fontFamily: 'Playfair Display', fontWeight: 'Regular',
      ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
  ]);
  const bytes = await renderPakta(tpl, {}, null);
  const doc = await PDFDocument.load(bytes);
  expect(Math.round(doc.getPage(0).getWidth())).toBe(800);
  expect(bytes.byteLength).toBeGreaterThan(100);
});
```

- [ ] **Step 2: Jalankan tes — pastikan lulus**

Run: `npm test -- pdfRenderer`
Expected: PASS (kedua tes lulus tanpa perubahan implementasi — perilaku sudah benar).

> Jika `mengabaikan signaturePng...` gagal (image = 2), berarti penyisipan ttd tidak dijaga oleh keberadaan field — perbaiki `renderPakta` agar penyisipan hanya di dalam cabang `field.tipe === 'tandaTangan'`.

- [ ] **Step 3: Commit**

```bash
git add tests/pdfRenderer.test.ts
git commit -m "test(pakta): kunci perilaku ttd hanya pada field tandaTangan"
```

---

## Verifikasi Akhir Rencana 1

- [ ] Jalankan seluruh tes: `npm test` → semua hijau (38 lama + 4 baru `renderPakta`).
- [ ] Build: `npx tsc -b && npm run build` → tanpa error.
- [ ] Hasil: `renderPakta(template, values, signaturePng)` siap dipakai Rencana 4 (halaman publik) untuk membuat PDF di perangkat pegawai.

---

## Self-Review (penulis rencana)

- **Cakupan spec:** §5.1 jenis field → Task 1. §3.3(4) sisip PNG ttd → Task 4. §7 tes penempatan ttd → Task 4–5. ✔
- **Placeholder:** tidak ada TODO/TBD; semua langkah berisi kode lengkap. ✔
- **Konsistensi tipe:** `PaktaTemplate` (background/bgWidth/bgHeight/fields), `renderPakta(template, values, signaturePng)`, `Field.tinggi`, dan jenis `tandaTangan` dipakai konsisten di Task 1–5 dan tes. ✔
- **DRY:** helper `drawBackground`/`makeFontGetter`/`drawTextField` dipakai bersama `renderCertificate` & `renderPakta`. ✔

## Rencana berikutnya (belum ditulis)
- **Rencana 2:** Backend Supabase — skema tabel, RLS, bucket, `supabaseClient.ts`, `paktaStore.ts` (jalur publik anon), `api/pakta-admin.ts` (verifikasi sandi + service-role).
- **Rencana 3:** UI Admin — daftar acara pakta, editor (reuse + field ttd), impor daftar pegawai, dashboard status + QR.
- **Rencana 4:** Halaman publik `/ttd/:id` — pilih nama → pra-isi → canvas `signature_pad` → kirim (renderPakta + upload) → unduh mandiri; + routing.
