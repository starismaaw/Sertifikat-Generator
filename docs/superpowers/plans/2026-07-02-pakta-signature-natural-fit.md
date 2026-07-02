# Tanda Tangan Proporsional (Contain-Fit) di PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti stretch-fill (yang membuat tanda tangan gepeng/tebal & terasa salah tempat di mobile) menjadi contain-fit (proporsional, terpusat) saat gambar tanda tangan disisipkan ke PDF akhir.

**Architecture:** Satu perubahan terfokus di `renderPakta()` (`src/lib/pdfRenderer.ts`): pakai method bawaan pdf-lib `PDFImage.scaleToFit(width, height)` untuk menghitung ukuran gambar yang di-scale seragam (mempertahankan rasio asli) agar pas di dalam kotak field TTD, lalu memusatkan hasilnya di dalam kotak itu (menggantikan `width: field.lebar, height: h` yang selalu stretch paksa).

**Tech Stack:** TypeScript, pdf-lib (`PDFImage.scaleToFit`), Vitest.

**Referensi:** `docs/superpowers/specs/2026-07-02-pakta-signature-natural-fit-design.md`

---

### Task 1: Test + implementasi contain-fit di `renderPakta`

**Files:**
- Modify: `tests/pdfRenderer.test.ts:141-159` (update test lama yang mengasumsikan stretch-fill), tambah 2 test baru setelahnya
- Modify: `src/lib/pdfRenderer.ts:202-213` (`renderPakta`, cabang `field.tipe === 'tandaTangan'`)

Context penting: test di file ini pakai `PNG_1x1` (fixture PNG 1×1 piksel, sudah diimpor di baris 3) sebagai gambar tanda tangan pengganti. Karena 1×1 itu **persegi**, memasukkannya ke field **non-persegi** (mis. lebar 300, tinggi 150) adalah skenario yang PAS untuk menguji contain-fit (gambar persegi ke kotak lebar-pendek) — sama seperti kasus mobile yang jadi sumber bug. Memasukkannya ke field **persegi** (mis. 200×200) menguji kasus rasio-cocok (harus identik dengan perilaku lama, tidak boleh regresi).

- [ ] **Step 1: Update test lama & tambah 2 test baru (RED untuk yang lama)**

Di `tests/pdfRenderer.test.ts`, ganti seluruh isi test `'menempatkan PNG tanda tangan pada koordinat field yang benar'` (baris 141-159 saat ini) dengan versi berikut, lalu tambahkan 2 test baru persis setelahnya (sebelum test `'field namaNip: menggambar 2 baris teks...'` di baris 161):

```ts
  it('menempatkan PNG tanda tangan proporsional (contain-fit) & terpusat saat rasio gambar beda dari rasio field', async () => {
    // Gambar sumber PNG_1x1 persegi (1x1) dimasukkan ke field lebar-pendek (300x150).
    // scaleToFit(300, 150) pada gambar 1x1: imgWidthScale=300, imgHeightScale=150,
    // scale=min(300,150)=150 -> hasil 150x150 (persegi, TIDAK stretch jadi 300x150).
    // Dipusatkan secara horizontal (sumbu yang tidak jadi faktor pembatas):
    //   x = field.x + (field.lebar - 150)/2 = 50 + 75 = 125
    //   y_pdf = bgHeight - field.y - h + (h - hh)/2 = 600-100-150 + (150-150)/2 = 350
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 300, tinggi: 150,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(content).toContain('1 0 0 1 125 350 cm');
    expect(content).toContain('150 0 0 150 0 0 cm');
    // Tidak boleh lagi mengandung stretch lama (300x150 non-uniform)
    expect(content).not.toContain('300 0 0 150 0 0 cm');
  });

  it('tidak mengubah hasil saat rasio gambar sudah sama dengan rasio field (tidak regresi)', async () => {
    // Field persegi (200x200) + gambar persegi (PNG_1x1, 1x1) -> scaleToFit tidak
    // perlu memusatkan apa pun (w=200=field.lebar, hh=200=h), identik dengan
    // stretch-fill lama untuk kasus rasio yang sudah cocok (mis. desktop).
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 200, tinggi: 200,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(content).toContain('1 0 0 1 50 300 cm');
    expect(content).toContain('200 0 0 200 0 0 cm');
  });

  it('memakai fallback tinggi (lebar/2) sebagai tinggi kotak untuk scaleToFit saat field.tinggi tidak diisi', async () => {
    // field.tinggi tidak diisi -> h fallback = field.lebar/2 = 300/2 = 150, sama
    // persis dengan test contain-fit di atas -> hasil harus identik (125, 350, 150x150).
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 300,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(content).toContain('1 0 0 1 125 350 cm');
    expect(content).toContain('150 0 0 150 0 0 cm');
  });
```

- [ ] **Step 2: Jalankan test untuk konfirmasi test baru gagal sesuai ekspektasi**

Run: `npx vitest run tests/pdfRenderer.test.ts -t "koordinat field|rasio gambar|fallback tinggi"`

Expected:
- `'menempatkan PNG tanda tangan proporsional (contain-fit)...'` → **FAIL** (kode lama masih menghasilkan `'300 0 0 150 0 0 cm'` dan `'1 0 0 1 50 350 cm'`, bukan nilai contain-fit yang baru)
- `'memakai fallback tinggi...'` → **FAIL** (alasan sama, field lebar 300 tanpa tinggi eksplisit)
- `'tidak mengubah hasil saat rasio gambar sudah sama...'` → **PASS** (kasus rasio-cocok, stretch-fill lama & contain-fit baru menghasilkan angka yang sama — ini test regresi, bukan test yang butuh kode baru)

Kalau hasil actual berbeda dari ekspektasi di atas, STOP dan re-periksa perhitungan sebelum lanjut ke Step 3.

- [ ] **Step 3: Implementasi contain-fit di `renderPakta`**

Di `src/lib/pdfRenderer.ts`, ganti blok berikut (baris 202-213 saat ini):

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
```

menjadi:

```ts
  for (const field of template.fields) {
    if (field.tipe === 'tandaTangan') {
      if (!sigImage) continue;
      const h = field.tinggi ?? field.lebar / 2;
      // Scale seragam (contain-fit, bukan stretch-fill) supaya tanda tangan tidak
      // melar/gepeng saat rasio kotak gambar interaktif (mis. persegi di mobile,
      // lihat computeSignatureBox di paktaPreviewLayout.ts) berbeda dari rasio
      // field asli. Lihat docs/superpowers/specs/2026-07-02-pakta-signature-natural-fit-design.md.
      const { width: w, height: hh } = sigImage.scaleToFit(field.lebar, h);
      // field.y = TOP kotak; konversi ke origin bawah pdf-lib. Gambar dipusatkan
      // di dalam kotak field pada sumbu yang tidak jadi faktor pembatas scale.
      page.drawImage(sigImage, {
        x: field.x + (field.lebar - w) / 2,
        y: template.bgHeight - field.y - h + (h - hh) / 2,
        width: w,
        height: hh,
      });
      continue;
    }
```

- [ ] **Step 4: Jalankan test untuk konfirmasi semua lolos**

Run: `npx vitest run tests/pdfRenderer.test.ts`

Expected: semua test di file ini **PASS**, termasuk ketiga test dari Step 1.

- [ ] **Step 5: Jalankan seluruh test suite & build untuk pastikan tidak ada regresi di tempat lain**

Run: `npm run test`
Expected: semua file test **PASS** (22 file, termasuk `tests/pdfRenderer.test.ts` yang baru diubah).

Run: `npm run build`
Expected: `tsc -b && vite build` selesai tanpa error TypeScript.

- [ ] **Step 6: Commit**

```bash
git add tests/pdfRenderer.test.ts src/lib/pdfRenderer.ts
git commit -m "fix(pakta): tanda tangan proporsional (contain-fit) saat embed ke PDF

Ganti stretch-fill (page.drawImage width:field.lebar, height:h langsung)
jadi contain-fit (PDFImage.scaleToFit + centering) di renderPakta().
Root cause bug 'tanda tangan tebal & placement tidak sesuai template' di
mobile: kotak TTD interaktif di HP (PR #33) berbentuk independen dari
field asli (mis. persegi vs field lebar-pendek default 2.5:1), sehingga
gambar hasil tangkapan di-stretch non-uniform saat disisipkan ke PDF --
menggepengkan/menebalkan coretan dan mendistorsi bentuknya relatif
terhadap area TTD template. scaleToFit mempertahankan rasio asli gambar
(seperti object-fit:contain), dipusatkan di kotak field -- menghilangkan
distorsi untuk kedua gejala sekaligus, karena satu akar penyebab yang
sama. Trade-off yang disepakati: tanda tangan mungkin tidak mengisi
100% lebar/tinggi kotak field saat rasionya jauh berbeda dari rasio
kotak gambar (ada ruang kosong transparan di salah satu sumbu).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verifikasi Manual (di luar automated test, dilakukan setelah Task 1 selesai)

Setelah kode di-commit, lakukan verifikasi visual manual (harness sementara + `preview_*` tools seperti pada PR #33, direvert setelah selesai — tidak dikomit):
1. Render dokumen dengan field TTD lebar-pendek (mis. rasio field 2.5:1, meniru default field TTD di editor).
2. Simulasikan tanda tangan di viewport mobile (kotak interaktif ~persegi hasil `computeSignatureBox`).
3. Panggil `renderPakta` dengan `signaturePng` hasil tangkapan itu, buka PDF hasilnya (atau ekstrak `sigImage` info via `PDFDocument.load` + baca content stream `cm` operators seperti pola test Step 1).
4. Konfirmasi: coretan tidak lagi gepeng/tebal, bentuknya proporsional dengan yang digambar, dan berada di tengah area field TTD (bukan menempel di salah satu sisi/melebihi batas field).
