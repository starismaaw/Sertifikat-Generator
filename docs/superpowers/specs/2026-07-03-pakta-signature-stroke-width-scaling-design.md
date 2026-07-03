# Spec: Kompensasi Lebar Goresan Tanda Tangan (`strokeScale`)

**Tanggal:** 2026-07-03
**Status:** Approved
**Scope:** `src/components/pakta-signer/SignaturePad.tsx`, `src/components/pakta-signer/PaktaDocumentPreview.tsx`, `tests/SignaturePad.test.tsx`

---

## 1. Latar Belakang

Setelah PR #35 (kotak TTD selalu persis ukuran field, hapus `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT`), user melaporkan bug baru: coretan tanda tangan terlalu tebal di halaman signing mobile — baik di preview MAUPUN di hasil output PDF. Desktop/tablet tidak bermasalah.

### 1.1 Root cause (dikonfirmasi lewat systematic-debugging + verifikasi matematis di browser sungguhan)

`SignaturePad.tsx` memakai `minWidth: 1, maxWidth: 3` TETAP (CSS piksel), independen dari `scale` (rasio container-ke-`bgWidth` yang dihitung `PaktaDocumentPreview`). Diverifikasi secara matematis (dan dikonfirmasi lewat instrumentasi langsung di browser, membandingkan urutan eksekusi efek React & nilai `offsetWidth` sungguhan):

- Lebar goresan yang ditangkap di kanvas (CSS piksel) = `W_css` (1-3, dari `minWidth`/`maxWidth`).
- Kanvas ditangkap pada resolusi = `boxCssWidth × devicePixelRatio` (dijamin benar oleh fix `useLayoutEffect` sebelumnya).
- Saat di-embed ke PDF, `scaleToFit(field.lebar, h)` men-scale gambar tangkapan itu naik dengan faktor `field.lebar / (boxCssWidth × dpr)`.
- Karena `boxCssWidth = field.lebar × scale` (PR #35), faktor scale embed = `field.lebar / (field.lebar × scale × dpr) = 1 / (scale × dpr)`.
- Lebar goresan FINAL di PDF = `W_css × dpr × 1/(scale×dpr) = W_css / scale` — **`dpr` saling meniadakan sepenuhnya**, tidak perlu dikompensasi terpisah.

Untuk `scale` khas mobile (container ~330-380px dibagi `bgWidth` template yang bisa 1000-3000px → `scale` ~0.1-0.4), faktor `1/scale` bisa 2.5x sampai 10x — `minWidth`/`maxWidth` yang dulu pas (saat kotak dijamin minimal 140px lewat `MIN_SIGNATURE_HEIGHT`, sebelum PR #35) sekarang jadi terlalu tebal setelah pembesaran ini. Ini juga menjelaskan kenapa PREVIEW (bukan cuma output PDF) terlihat tebal: kotak yang sekarang lebih kecil (PR #35) membuat lebar goresan (piksel absolut sama, `W_css` tetap 1-3) terlihat proporsional lebih dominan/tebal relatif terhadap area gambar yang tersedia.

Desktop/tablet baik-baik saja karena `scale` di sana biasanya lebih besar (container lebih lebar relatif ke `bgWidth`), sehingga faktor `1/scale` jauh lebih kecil — kadang malah <1 (downscale, bukan upscale).

### 1.2 Insight kunci: target kalibrasi sudah ada, tidak perlu ditebak

`minWidth: 1, maxWidth: 3` yang SUDAH ADA saat ini justru adalah target lebar goresan FINAL yang benar (itulah kenapa desktop terlihat baik — `scale` desktop cukup dekat ke nilai yang membuat kompensasi hampir tidak diperlukan). Solusinya BUKAN mencari angka baru, tapi menerapkan kompensasi `scale` secara konsisten: `minWidth = 1 × scale`, `maxWidth = 3 × scale` — sehingga `finalWidth = (1×scale)/scale = 1`, `(3×scale)/scale = 3`, KONSTAN di semua device, bukan cuma "kebetulan mendekati" seperti di desktop sekarang.

**Trade-off yang disetujui eksplisit:** karena sebelumnya desktop TIDAK mendapat kompensasi apapun (efektif `scale_desktop_khas ≈ 0.7` menghasilkan `finalWidth` sekarang `1/0.7=1.43` sampai `3/0.7=4.29`, bukan persis `1`-`3`), setelah fix ini goresan di desktop akan sedikit LEBIH TIPIS dari sekarang (menuju target `1`-`3` yang presisi). Dampaknya kecil/nyaris tidak terlihat, diterima demi konsistensi lebar goresan final yang sama persis di semua device.

---

## 2. Fix: `strokeScale` Prop di `SignaturePad`

### 2.1 `SignaturePad.tsx`

Tambah dua konstanta modul-level (menggantikan literal `1`/`3` yang sebelumnya inline di constructor):

```ts
const BASE_MIN_WIDTH = 1;
const BASE_MAX_WIDTH = 3;
```

Tambah prop baru `strokeScale?: number` (default `1`) ke `SignaturePadProps`. Constructor `SignaturePadLib` memakai `minWidth: BASE_MIN_WIDTH * strokeScale, maxWidth: BASE_MAX_WIDTH * strokeScale` alih-alih literal `1`/`3` langsung.

Tambah efek BARU (terpisah dari efek pembuatan pad, yang tetap hanya bergantung pada `[transparent]` seperti sekarang — TIDAK boleh membuat pad baru saat `strokeScale` berubah, supaya goresan yang sedang digambar tidak hilang):

```ts
useEffect(() => {
  const pad = padRef.current;
  if (!pad) return;
  pad.minWidth = BASE_MIN_WIDTH * strokeScale;
  pad.maxWidth = BASE_MAX_WIDTH * strokeScale;
}, [strokeScale]);
```

`signature_pad`'s `minWidth`/`maxWidth` adalah instance property publik yang bisa di-assign langsung tanpa perlu re-create instance (dikonfirmasi lewat `.d.ts` library) — efek ini memutasi pad yang SUDAH ADA, konsisten dengan pola yang sudah ada di file ini (`resizeCanvas` juga memutasi kanvas & mengembalikan goresan lewat `toData()`/`fromData()`, bukan membuat pad baru).

### 2.2 `PaktaDocumentPreview.tsx`

Satu baris berubah: `<SignaturePad ref={innerSigRef} transparent hideClearButton onStrokeBegin={...} />` menjadi `<SignaturePad ref={innerSigRef} transparent hideClearButton onStrokeBegin={...} strokeScale={scale} />` — memakai `scale` yang SUDAH dihitung komponen ini (dipakai juga oleh `computeSignatureBox`), tidak ada perhitungan baru.

### 2.3 `PaktaSignPage.tsx` — TIDAK disentuh

Fallback standalone `<SignaturePad ref={sigPadRef} />` (dipakai saat template belum punya field `tandaTangan`) TIDAK diberi `strokeScale` — default `1` berlaku, PERSIS perilaku saat ini. Ini benar secara desain: signature yang ditangkap lewat jalur ini tidak pernah di-embed lewat `scaleToFit` field manapun (tidak ada field `tandaTangan` di template), jadi tidak ada faktor scale untuk dikompensasi.

---

## 3. Hal yang Tidak Berubah

- `src/lib/pdfRenderer.ts` (`scaleToFit` + centering) — TIDAK disentuh. Fix ini bekerja murni di sisi CAPTURE (menyesuaikan lebar goresan SEBELUM ditangkap), bukan di sisi embed.
- `src/lib/paktaPreviewLayout.ts` (`computeSignatureBox`, dari PR #35) — TIDAK disentuh. Ukuran kotak tetap persis ukuran field, keputusan itu tetap berlaku; fix ini hanya menambah kompensasi lebar goresan di dalam kotak itu.
- Resize kanvas (`resizeCanvas` di `SignaturePad.tsx`) — logic-nya TIDAK berubah, tetap memutasi `canvas.width`/`height` & mengembalikan goresan lewat `toData()`/`fromData()` seperti sekarang.

---

## 4. Verifikasi

- Test baru di `tests/SignaturePad.test.tsx`:
  1. Tanpa `strokeScale` (default) → pad dibuat dengan `options.minWidth === 1`, `options.maxWidth === 3` — regresi: perilaku default TIDAK berubah.
  2. `strokeScale={0.3}` → pad dibuat dengan `options.minWidth === 0.3`, `options.maxWidth` mendekati `0.9` (pakai `toBeCloseTo` karena floating point: `3*0.3` di JS = `0.8999999999999999`, bukan persis `0.9`).
  3. Re-render dengan `strokeScale` baru (mis. dari `1` ke `0.5`) memutasi `minWidth`/`maxWidth` pada instance yang SAMA (`instances.length` tetap `1`, TIDAK ada instance kedua dibuat) — membuktikan goresan yang sedang digambar tidak hilang saat scale berubah (mis. resize kontainer).
- Mock `MockSignaturePadInstance` di test file perlu ditambah field `minWidth: number` dan `maxWidth: number` (mutable, bukan `readonly`) supaya test bisa membaca nilai SETELAH efek kedua memutasinya (constructor mock yang sudah ada TIDAK secara eksplisit set instance property `minWidth`/`maxWidth` dari `options` — perlu ditambahkan di constructor mock, `this.minWidth = options.minWidth; this.maxWidth = options.maxWidth;`, supaya test bisa membaca DAN memverifikasi mutasi berikutnya).
- `npm run build` dan `npm run test` — tidak boleh ada regresi pada test lain. Dikonfirmasi sebelum spec ini ditulis: mock `SignaturePad` di `tests/PaktaDocumentPreview.test.tsx` (baris 6-18) mengetik parameter `props` secara longgar (`{ onStrokeBegin?: () => void }`) dan tidak membaca prop lain apapun — menambah `strokeScale` di pemanggilan (`PaktaDocumentPreview.tsx`) TIDAK memengaruhi mock ini sama sekali (prop baru sekadar diteruskan & diabaikan mock, bukan error).
- Verifikasi manual di browser sungguhan (viewport mobile, field rasio default 2.5:1, sama seperti verifikasi bug sebelumnya): gambar tanda tangan sederhana, render lewat `renderPakta` sungguhan, EKSPOR hasil PDF atau screenshot kanvas preview — goresan harus terlihat proporsional/tipis, TIDAK lagi tebal, di preview MAUPUN saat di-zoom hasil PDF-nya.
