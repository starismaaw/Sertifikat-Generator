# Spec: Perbaiki Race Kondisi Resolusi Kanvas Tanda Tangan (useLayoutEffect)

**Tanggal:** 2026-07-02
**Status:** Approved
**Scope:** `src/components/pakta-signer/PaktaDocumentPreview.tsx`

---

## 1. Latar Belakang

Selama verifikasi manual untuk fix contain-fit (`docs/superpowers/specs/2026-07-02-pakta-signature-natural-fit-design.md`), ditemukan bug baru yang lebih mendasar: resolusi internal `<canvas>` `SignaturePad` di dalam `PaktaDocumentPreview` bisa terkunci pada ukuran yang SALAH sejak render pertama, dan tidak pernah tersinkronisasi ulang — meski kotak TTD yang terlihat di layar (CSS) sudah benar.

### 1.1 Bukti empiris

Diverifikasi lewat harness sementara (browser sungguhan, `preview_*` tools, direvert setelah selesai) dengan field TTD lebar-pendek (lebar=480, tinggi=192, rasio 2.5:1):
- Kotak TTD di layar (CSS `offsetWidth`/`offsetHeight`) settle dengan benar ke ukuran yang sudah dihitung `computeSignatureBox` (mis. 177×140px pada satu percobaan) — sisi CSS/layout ini SUDAH BENAR.
- TAPI resolusi internal kanvas (`canvas.width`/`canvas.height`, yang menentukan piksel yang sebenarnya ditangkap `toDataURL()`) tetap terkunci di 960×384px — persis `field.lebar × field.tinggi × devicePixelRatio` (480×192×2), rasio 2.5:1, BUKAN rasio kotak yang terlihat (1.26:1).
- Kondisi ini reproducible di berbagai skenario: reload penuh halaman, DAN setelah resize viewport sungguhan (375px → 400px) — bukan sekadar race sesaat yang hilang sendiri, tapi kondisi permanen selama komponen itu tidak di-remount.

### 1.2 Mekanisme (root cause)

1. `PaktaDocumentPreview` mount dengan `const [scale, setScale] = useState(1)` (fallback, `paktaPreviewLayout.ts:87`) — SELALU salah di produksi karena `template.bgWidth` (lebar natural gambar template yang diunggah, umumnya 1000-3000px) hampir tidak pernah sama dengan lebar container yang dirender (umumnya 300-800px).
2. Koreksi `scale` yang benar dihitung lewat `useEffect` + `ResizeObserver` di `PaktaDocumentPreview.tsx:90-101` — efek ini **passive** (`useEffect`), berjalan ASINKRON setelah browser sempat commit & (berpotensi) paint dengan `scale=1`.
3. `SignaturePad.tsx:30-64` JUGA memakai `useEffect` (passive) untuk mengukur `canvas.offsetWidth`/`offsetHeight` dan menetapkan `canvas.width`/`canvas.height` (`resizeCanvas()`, baris 42-51).
4. React menjalankan SEMUA passive effect dalam satu "commit" yang sama secara berurutan dari child ke parent, tapi **child (`SignaturePad`) dan parent (`PaktaDocumentPreview`) berada dalam KOMMIT PERTAMA yang sama** — pada commit ini, `scale` MASIH `1` (fallback), sehingga kotak TTD (dan karenanya kanvas `SignaturePad`, yang mengisi 100% kotak itu) masih berukuran field-asli-tanpa-scale (mis. 480×192). `SignaturePad`'s efek berjalan DI SINI, menangkap ukuran yang salah ini ke `canvas.width`/`height`.
5. `PaktaDocumentPreview`'s efek berjalan setelahnya (parent, giliran berikutnya), memanggil `setScale(nilai_benar)` → memicu re-render/commit KEDUA dengan kotak yang sudah benar (mis. 177×140).
6. `SignaturePad`'s efek TIDAK berjalan ulang pada commit kedua ini (dependency array-nya `[transparent]`, tidak berubah) — dan meski `ResizeObserver` yang dipasangnya SEHARUSNYA independen mendeteksi perubahan ukuran box kanvas secara native-browser, secara empiris hal ini TIDAK terjadi (diverifikasi: kanvas tetap 960×384 walau menunggu 2 detik dan walau viewport benar-benar di-resize).
7. Akibatnya: kanvas menangkap piksel dengan rasio 2.5:1 (mengikuti field asli) padahal yang terlihat & disentuh pengguna adalah kotak 1.26:1 — coretan yang digambar sudah TERDISTORSI SECARA NON-UNIFORM sejak titik penangkapan, sebelum sempat sampai ke logic embed PDF manapun (termasuk fix contain-fit yang baru saja dibuat — fix itu tetap perlu & benar, tapi tidak bisa memperbaiki distorsi yang sudah terjadi di sumbernya).

Bug ini KEMUNGKINAN BESAR sudah ada sejak fitur preview realistis pertama kali dibuat (PR #30, commit `ebfc16b`/`19c5133`), bukan sesuatu yang baru diperkenalkan oleh PR #33 atau fix contain-fit — severity-nya saja yang lebih terlihat di mobile karena rasio field vs container di mobile jauh lebih ekstrem.

---

## 2. Fix: `useLayoutEffect` untuk koreksi `scale`

### 2.1 Perubahan di `PaktaDocumentPreview.tsx`

Ganti `useEffect` (baris 90-101, blok yang menghitung & mengoreksi `scale`) menjadi `useLayoutEffect` — isi blok TIDAK berubah, hanya jenis hook-nya:

```ts
useLayoutEffect(() => {
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
```

Tambah `useLayoutEffect` ke import React di baris 1 (saat ini: `import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';`).

### 2.2 Kenapa ini memperbaiki root cause

React menjalankan SEMUA `useLayoutEffect` secara SINKRON setelah DOM ter-mutasi tapi SEBELUM browser sempat paint — dan state update yang dipicu di dalam layout effect (`setScale(...)`) di-flush sinkron juga sebelum paint (bukan dijadwalkan async seperti dari passive effect). Dengan perubahan ini, urutan yang terjadi menjadi:

1. Commit pertama (scale=1) — layout effect `PaktaDocumentPreview` berjalan SINKRON di sini (sebelum passive effect manapun, termasuk punya `SignaturePad`, sempat berjalan), langsung mengukur `containerRef.current.offsetWidth` (yang SUDAH akurat karena browser sudah selesai layout untuk commit ini) dan memanggil `setScale(nilai_benar)`.
2. React me-render & commit ulang SECARA SINKRON (masih sebelum paint) dengan `scale` yang sudah benar — kotak TTD & kanvas `SignaturePad` di DOM sekarang sudah berukuran final yang benar.
3. Browser paint (pengguna hanya pernah melihat ukuran yang SUDAH benar, tidak ada kedipan ukuran salah).
4. SEKARANG passive effect berjalan (children dulu): `SignaturePad`'s efek mengukur `canvas.offsetWidth`/`offsetHeight` — nilainya SUDAH benar karena layout effect + re-render di atas sudah selesai duluan.

Race hilang total karena urutan efek dijamin oleh spesifikasi React, bukan bergantung pada timing `ResizeObserver` yang tidak deterministik.

### 2.3 Kenapa BUKAN pendekatan lain

- **Passing box dimensions sebagai props ke `SignaturePad` + masukkan ke dependency array efeknya**: juga memperbaiki bug, tapi menambah coupling `SignaturePad` ke detail sizing parent-nya yang saat ini tidak perlu diketahuinya, menyentuh 2 file untuk hasil yang sama.
- **Menunda `resizeCanvas()` pertama lewat `requestAnimationFrame`/delay**: patch berbasis timing, bukan fix deterministik — persis pola "quick fix, investigate later" yang ingin dihindari. Tidak menjamin selalu benar di semua kondisi (perangkat lambat, dsb).

### 2.4 Yang TIDAK berubah

- `SignaturePad.tsx` — tidak disentuh sama sekali. Logic resize-nya sudah benar secara ISOLATED (mengukur `canvas.offsetWidth`/`height` miliknya sendiri); masalahnya murni WAKTU efek itu dipanggil relatif terhadap parent, yang sekarang diperbaiki dari sisi parent.
- `computeScale`/`computeSignatureBox` (`paktaPreviewLayout.ts`) — logic perhitungan ukuran & posisi kotak sudah benar (diverifikasi PR #33); yang salah adalah KAPAN nilai itu sampai ke kanvas, bukan nilai itu sendiri.
- Fix contain-fit di `renderPakta` (`pdfRenderer.ts`, sudah di-commit `8cee4e9`) — tetap diperlukan & benar sebagai lapisan perlindungan tambahan (mis. untuk kasus rasio kotak vs field yang secara sah berbeda meski kanvas sudah menangkap resolusi yang benar), tidak ada perubahan.

---

## 3. Verifikasi

- Test otomatis: `PaktaDocumentPreview.tsx` tidak punya test unit khusus untuk timing efek React (sulit diuji lewat `@testing-library/react` + jsdom karena `ResizeObserver` di-mock di lingkungan test — lihat `tests/setup.ts`). Verifikasi utama untuk task ini adalah **manual, di browser sungguhan**, karena bug ini secara inheren adalah masalah timing browser nyata yang tidak tertangkap jsdom.
- Verifikasi manual (harness sementara + `preview_*` tools, direvert setelah selesai, sama seperti yang dipakai untuk menemukan bug ini):
  1. Render `PaktaDocumentPreview` dengan field TTD lebar-pendek (rasio jauh dari kotak yang akan dihasilkan `computeSignatureBox`, mis. lebar=480, tinggi=192) di viewport mobile.
  2. Segera setelah mount (tanpa interaksi tambahan), baca `canvas.width`/`canvas.height` vs `canvas.offsetWidth`/`offsetHeight × devicePixelRatio` — harus SAMA (rasio kanvas piksel = rasio kotak CSS), TIDAK lagi 960×384 yang salah.
  3. Gambar tanda tangan (via `PointerEvent` sintetis), render lewat `renderPakta` sungguhan, cek isi `cm` operator di content stream PDF — bentuk yang di-embed harus mencerminkan proporsi asli coretan (tidak melar/gepeng), konsisten dengan fix contain-fit yang sudah ada.
  4. Ulangi setelah resize viewport sungguhan (misalnya rotate orientasi) — kanvas harus re-sync ke ukuran baru yang benar (perilaku `ResizeObserver` untuk resize LANJUTAN, di luar race inisialisasi, harus tetap berfungsi seperti sebelumnya).
- `npm run build` dan `npm run test` — tidak boleh ada regresi pada test yang sudah ada (khususnya `tests/PaktaDocumentPreview.test.tsx`, yang me-mount komponen ini di jsdom; perlu dipastikan mock `ResizeObserver` di `tests/setup.ts` tetap kompatibel dengan `useLayoutEffect`, karena keduanya adalah mekanisme React yang berbeda dari `ResizeObserver` browser itu sendiri — mengganti jenis hook tidak mengubah cara `ResizeObserver` dipakai/dipasang, jadi seharusnya tidak berdampak ke mock yang ada).
