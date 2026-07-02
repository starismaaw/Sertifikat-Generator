# Perbaiki Race Kondisi Resolusi Kanvas TTD (useLayoutEffect) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hilangkan race kondisi di mana kanvas `SignaturePad` menangkap resolusi piksel yang salah (mengunci ukuran field-asli-tanpa-scale) karena diukur sebelum `PaktaDocumentPreview` sempat mengoreksi `scale` dari nilai fallback awal.

**Architecture:** Satu perubahan di `PaktaDocumentPreview.tsx`: ganti hook `useEffect` menjadi `useLayoutEffect` untuk efek yang mengukur container & mengoreksi `scale`. `useLayoutEffect` di React dijamin berjalan sinkron (dan state update di dalamnya di-flush sinkron) sebelum browser paint dan sebelum efek passive (`useEffect`) manapun di komponen turunan — termasuk efek resize kanvas di `SignaturePad` — sempat berjalan. Ini menghilangkan race di level urutan efek React, bukan menambal dengan delay/timing.

**Tech Stack:** React (`useLayoutEffect`), TypeScript, Vitest + @testing-library/react (regresi jsdom), verifikasi manual browser (`preview_*` tools) untuk bug timing yang inheren tidak tertangkap jsdom.

**Referensi:** `docs/superpowers/specs/2026-07-02-pakta-signature-canvas-resolution-race-design.md`

---

### Task 1: Ganti `useEffect` → `useLayoutEffect` untuk koreksi `scale`

**Files:**
- Modify: `src/components/pakta-signer/PaktaDocumentPreview.tsx:1` (import), `:98-107` (hook koreksi scale)

Context penting: `tests/setup.ts` men-stub `ResizeObserver` sebagai no-op (`observe()`/`unobserve()`/`disconnect()` kosong, tidak pernah memanggil callback). Ini berarti test jsdom yang ada TIDAK bergantung pada `ResizeObserver` benar-benar terpicu — mereka bergantung pada pemanggilan `update()` yang terjadi LANGSUNG di dalam body efek (baris terakhir sebelum `return`), yang tetap ada persis sama baik di `useEffect` maupun `useLayoutEffect`. Karena itu, mengganti jenis hook TIDAK diharapkan mengubah hasil test yang sudah ada — task ini murni pergantian jenis hook, tanpa perubahan logic di dalamnya.

Bug yang diperbaiki task ini adalah race kondisi TIMING BROWSER NYATA (urutan `useLayoutEffect` vs `useEffect` React, dan urutan `ResizeObserver` browser sungguhan) yang **tidak bisa direproduksi di jsdom** — jsdom tidak benar-benar melakukan layout/paint browser, dan `ResizeObserverStub` di atas bahkan tidak mengeksekusi callback-nya sama sekali. Karena itu tidak ada test otomatis baru untuk perilaku ini di task ini (dikonfirmasi eksplisit di spec bagian 3) — verifikasi utamanya adalah manual di browser sungguhan (Step 5).

- [ ] **Step 1: Baca kode saat ini untuk konfirmasi baris yang akan diubah**

Run: `sed -n '1,101p' src/components/pakta-signer/PaktaDocumentPreview.tsx | tail -15`

Expected output (baris 91-101, konfirmasi kode belum berubah dari yang diasumsikan plan ini):
```
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
```

Kalau baris tidak persis cocok (nomor baris bergeser atau isi berbeda), STOP dan laporkan sebagai BLOCKED — jangan menebak lokasi yang benar.

- [ ] **Step 2: Ubah import React**

Di `src/components/pakta-signer/PaktaDocumentPreview.tsx` baris 1, ganti:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
```

menjadi:

```ts
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
```

(`useEffect` dihapus dari import karena setelah Step 3 tidak ada lagi pemakaiannya di file ini — hanya ada SATU efek di komponen ini, yaitu efek koreksi scale yang diubah jadi `useLayoutEffect`.)

- [ ] **Step 3: Ganti `useEffect` jadi `useLayoutEffect` di efek koreksi scale**

Di file yang sama, cari blok (saat ini baris 98-107):

```ts
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
```

Ganti HANYA nama hook-nya (isi blok, urutan baris, dan dependency array TIDAK berubah):

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

- [ ] **Step 4: Jalankan test suite untuk pastikan tidak ada regresi**

Run: `npx vitest run tests/PaktaDocumentPreview.test.tsx`

Expected: semua test di file ini **PASS** (perilaku test tidak berubah — lihat catatan "Context penting" di atas soal kenapa ini diharapkan tidak berubah).

Run: `npm run test`

Expected: semua 22 file test **PASS**, tidak ada regresi di file lain.

Run: `npm run build`

Expected: `tsc -b && vite build` selesai tanpa error TypeScript (termasuk tidak ada import yang tidak terpakai — `useEffect` sudah dihapus dari import di Step 2, pastikan tidak ada sisa pemakaian `useEffect` lain di file ini yang akan menyebabkan `ReferenceError`/error TypeScript "cannot find name 'useEffect'").

Kalau ada kegagalan yang TIDAK diharapkan (bukan sekadar output yang berbeda formatnya), STOP — jangan lanjut ke Step 5 sebelum akar masalahnya jelas.

- [ ] **Step 5: Verifikasi manual di browser sungguhan (WAJIB — bug ini tidak tertangkap otomatis)**

Task ini TIDAK boleh dianggap selesai hanya dari Step 4 lolos — Step 4 cuma membuktikan tidak ada regresi, BUKAN membuktikan bug race-nya sungguh hilang (jsdom tidak mereproduksi race timing browser nyata, lihat "Context penting" di atas).

Gunakan `preview_*` tools (server dev via `preview_start`, viewport mobile via `preview_resize`) dengan harness sementara yang me-render `PaktaDocumentPreview` langsung dengan field TTD yang rasionya jauh berbeda dari kotak hasil `computeSignatureBox` (mis. `lebar: 480, tinggi: 192` pada `bgWidth: 1000`, viewport ~375-400px — kombinasi yang sudah terbukti mereproduksi bug ini saat root-causing). Harness sementara ini TIDAK dikomit — buat, verifikasi, lalu `git checkout -- <file yang diubah untuk harness>` setelah selesai.

Langkah verifikasi:
1. Segera setelah komponen mount (tanpa interaksi tambahan), baca lewat `preview_eval`:
   ```js
   (() => {
     const canvas = document.querySelector('canvas');
     const ratio = window.devicePixelRatio || 1;
     return {
       canvasPixel: { w: canvas.width, h: canvas.height },
       canvasCssTimesRatio: { w: Math.round(canvas.offsetWidth * ratio), h: Math.round(canvas.offsetHeight * ratio) },
     };
   })()
   ```
   Expected: `canvasPixel.w`/`h` **SAMA** (atau sangat dekat, toleransi pembulatan ±1px) dengan `canvasCssTimesRatio.w`/`h` — SEBELUM fix, `canvasPixel` akan menunjukkan resolusi field-asli (mis. 960×384 untuk field 480×192 pada dpr=2) yang TIDAK cocok dengan `canvasCssTimesRatio` dari kotak yang sudah dikoreksi (mis. ~354×280 untuk kotak ~177×140 pada dpr=2).
2. Ulangi pengecekan yang sama setelah resize viewport sungguhan (mis. `preview_resize` ke lebar berbeda, atau reload penuh) — kanvas harus tetap sinkron (`ResizeObserver` untuk resize LANJUTAN, di luar race inisialisasi, tetap harus berfungsi seperti sebelumnya).
3. Gambar tanda tangan sederhana (`PointerEvent` sintetis dengan delay antar-event, seperti pola yang dipakai di verifikasi PR sebelumnya), lalu bandingkan proporsi hasil gambar dengan proporsi kotak yang terlihat di layar — tidak boleh ada distorsi non-uniform yang terlihat.

Kalau `canvasPixel` masih tidak cocok dengan `canvasCssTimesRatio` setelah fix, STOP — root cause belum sepenuhnya teratasi, jangan lanjut ke commit.

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-signer/PaktaDocumentPreview.tsx
git commit -m "fix(pakta): hilangkan race kondisi resolusi kanvas TTD (useLayoutEffect)

Ganti useEffect->useLayoutEffect untuk efek koreksi scale di
PaktaDocumentPreview. Root cause: scale mulai dari fallback useState(1)
(hampir selalu salah karena bgWidth template jarang sama dengan lebar
container) dan baru dikoreksi lewat useEffect (passive, async) --
SignaturePad's canvas resize effect (juga useEffect/passive) bisa
berjalan LEBIH DULU, mengukur & mengunci resolusi kanvas ke ukuran
field-asli-tanpa-scale sebelum scale sempat dikoreksi, dan tidak pernah
tersinkronisasi ulang setelahnya (diverifikasi empiris: reproducible
lewat reload penuh & resize viewport sungguhan, bukan race sesaat).
useLayoutEffect menjamin koreksi scale (dan state update-nya) selesai
SINKRON sebelum browser paint dan sebelum efek passive turunan manapun
(termasuk SignaturePad) sempat berjalan -- menghilangkan race di level
urutan efek React, bukan menambal dengan delay/timing.

Diverifikasi: npm run test (22 file, semua PASS, tidak ada regresi),
npm run build (PASS), dan manual di browser mobile viewport sungguhan
-- resolusi kanvas sekarang selalu cocok dengan ukuran kotak yang
terlihat, baik saat mount pertama maupun setelah resize viewport.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Catatan untuk Controller (bukan bagian task subagent)

Step 5 (verifikasi manual browser) memerlukan akses ke `preview_*` tools yang HANYA tersedia di sesi controller (bukan di subagent implementer biasa). Kalau task ini dijalankan lewat `subagent-driven-development`, controller perlu:
1. Membiarkan implementer subagent menyelesaikan Step 1-4 dan Step 6 (commit), MELEWATI Step 5 dengan melaporkannya sebagai `DONE_WITH_CONCERNS` (concern: "Step 5 verifikasi manual browser memerlukan preview_* tools yang tidak tersedia untuk subagent — perlu dilakukan controller setelah commit").
2. Controller sendiri menjalankan Step 5 SETELAH implementer commit, SEBELUM task dianggap benar-benar selesai dan sebelum task reviewer di-dispatch (atau sertakan hasil verifikasi manual controller sebagai bagian dari bukti yang diberikan ke task reviewer).
