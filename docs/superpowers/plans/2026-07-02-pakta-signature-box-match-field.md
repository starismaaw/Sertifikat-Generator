# Kotak TTD Selalu Persis Ukuran Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `computeSignatureBox` mengembalikan kotak TTD interaktif yang selalu persis ukuran field asli (di-scale) — hapus total minimum kenyamanan sentuh (`MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT`) dan logic pembesaran/clamp terkait, supaya mobile berperilaku sama seperti desktop/tablet.

**Architecture:** Satu perubahan di `src/lib/paktaPreviewLayout.ts`: `computeSignatureBox` disederhanakan jadi scaling langsung tanpa cabang logic apapun. Fungsi `clamp()` (helper lokal, sudah dikonfirmasi HANYA dipakai oleh `computeSignatureBox`) dan konstanta `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT` dihapus total sebagai dead code.

**Tech Stack:** TypeScript, Vitest.

**Referensi:** `docs/superpowers/specs/2026-07-02-pakta-signature-box-match-field-design.md`

---

### Task 1: Sederhanakan `computeSignatureBox`, hapus minimum & dead code

**Files:**
- Modify: `src/lib/paktaPreviewLayout.ts:1-90` (hapus `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT`, hapus `clamp()`, sederhanakan `computeSignatureBox`)
- Modify: `tests/paktaPreviewLayout.test.ts` (ganti seluruh isi `describe('computeSignatureBox', ...)`, hapus import yang sudah tidak diekspor)

Context penting: `tsconfig.json` mengaktifkan `noUnusedParameters: true` — parameter `bgWidth`/`bgHeight` di `computeSignatureBox` TIDAK BOLEH dibiarkan begitu saja tanpa dipakai di badan fungsi (akan gagal build). TypeScript mengecualikan parameter yang diawali underscore (`_`) dari cek ini — jadi parameter itu di-rename jadi `_bgWidth`/`_bgHeight` (tetap dipertahankan di signature fungsi supaya pemanggil di `PaktaDocumentPreview.tsx:113` — `computeSignatureBox(sigField, scale, template.bgWidth, template.bgHeight)` — tidak perlu diubah sama sekali, hanya TIDAK dipakai lagi di badan fungsi).

- [ ] **Step 1: Tulis test baru untuk `computeSignatureBox` (RED — akan gagal terhadap kode lama)**

Di `tests/paktaPreviewLayout.test.ts`, ganti import (baris 1-9) dari:

```ts
import { describe, it, expect } from 'vitest';
import {
  MIN_SIGNATURE_HEIGHT,
  MIN_SIGNATURE_WIDTH,
  computeScale,
  computeSignatureBox,
  fitFontSizeCss,
  measureFontAscent,
} from '../src/lib/paktaPreviewLayout';
```

menjadi:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeScale,
  computeSignatureBox,
  fitFontSizeCss,
  measureFontAscent,
} from '../src/lib/paktaPreviewLayout';
```

Lalu ganti SELURUH isi blok `describe('computeSignatureBox', ...)` (baris 22-85 saat ini — mulai dari `describe('computeSignatureBox', () => {` sampai `});` penutupnya, tepat sebelum `describe('fitFontSizeCss', ...)`) dengan:

```ts
describe('computeSignatureBox', () => {
  it('mengembalikan kotak persis ukuran field * scale, tanpa pembesaran apapun', () => {
    const field = { x: 100, y: 50, lebar: 400, tinggi: 150 };
    const box = computeSignatureBox(field, 0.5, 2000, 1500);
    expect(box).toEqual({ left: 50, top: 25, width: 200, height: 75 });
  });

  it('memakai lebar/2 sebagai tinggi default bila field.tinggi tidak diisi', () => {
    const field = { x: 0, y: 0, lebar: 300, tinggi: undefined };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });

  it('TIDAK membesarkan kotak sama sekali walau field & scale kecil (trade-off yang disetujui: tidak ada lagi minimum kenyamanan sentuh)', () => {
    // Field & scale yang sama seperti kasus historis "field TTD kecil di mobile" --
    // versi lama fungsi ini akan membesarkan box ini ke 140x140 (minimum). Sekarang
    // box HARUS tetap kecil (70x21), persis field*scale, tanpa pembesaran apapun --
    // ini adalah bukti eksplisit dari trade-off yang disetujui: field TTD yang
    // didesain kecil di editor akan menghasilkan kotak gambar yang kecil juga di
    // layar sempit.
    const field = { x: 1600, y: 2000, lebar: 400, tinggi: 120 };
    const box = computeSignatureBox(field, 0.175, 2000, 2500);
    expect(box).toEqual({ left: 280, top: 350, width: 70, height: 21 });
  });

  it('tidak meng-clamp ke batas dokumen (bgWidth/bgHeight sudah tidak dipakai sama sekali)', () => {
    // Field yang (secara kontrived) melebihi batas dokumen -- membuktikan tidak ada
    // lagi logic clamp tersembunyi yang bergantung pada bgWidth/bgHeight.
    const field = { x: 900, y: 900, lebar: 200, tinggi: 200 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 900, top: 900, width: 200, height: 200 });
  });
});
```

- [ ] **Step 2: Jalankan test untuk konfirmasi gagal sesuai ekspektasi**

Run: `npx vitest run tests/paktaPreviewLayout.test.ts -t "computeSignatureBox"`

Expected: **FAIL** pada semua 4 test baru (kode lama masih membesarkan/meng-clamp kotak, menghasilkan nilai yang berbeda dari yang diharapkan test baru — mis. test pertama akan gagal karena kode lama menghasilkan `width:200,height:75` dari clamp `Math.min(Math.max(200,140),containerW)` yang MASIH SAMA di kasus ini karena 200>140 — cek betul: untuk test 1, `rawWidth=200>=MIN_WIDTH(140)` dan `rawHeight=75<MIN_HEIGHT(140)` jadi height LAMA akan jadi 140 bukan 75 -> test 1 GAGAL. Test 2 (`tinggi` fallback, `rawHeight=150>=140`) kebetulan TIDAK berubah nilainya dari kode lama (`rawWidth=300>=140` juga) -> test 2 kemungkinan **PASS** bahkan sebelum fix, itu WAJAR (bukan tanda ada yang salah) karena kasus ini kebetulan sudah di atas minimum lama. Test 3 & test 4 harus **FAIL** (kode lama pasti membesarkan/clamp berbeda dari nilai baru yang diharapkan).

Kalau hasil actual berbeda jauh dari penjelasan di atas (mis. SEMUA test tiba-tiba PASS terhadap kode lama), STOP dan re-periksa sebelum lanjut ke Step 3 — berarti ada kesalahan pemahaman soal kode lama yang harus diklarifikasi dulu.

- [ ] **Step 3: Sederhanakan `computeSignatureBox`, hapus `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT` & `clamp()`**

Di `src/lib/paktaPreviewLayout.ts`, ganti SELURUH isi file dari baris 1 sampai baris 90 (dari `import type { Field }...` sampai penutup `computeSignatureBox`, TEPAT SEBELUM komentar `/**\n * Ascent font...`) dengan:

```ts
import type { Field } from '../types';
import { browserTextWidth, toCssFont } from './pdfRenderer';

/** scale = lebar kontainer / lebar natural background. 1 bila belum bisa diukur. */
export function computeScale(containerWidth: number, bgWidth: number): number {
  if (bgWidth <= 0 || containerWidth <= 0) return 1;
  return containerWidth / bgWidth;
}

export interface SignatureBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Kotak tanda tangan interaktif, hasil scale field 'tandaTangan' APA ADANYA
 * -- tanpa pembesaran/minimum apapun. Rasio & ukuran kotak SELALU sama
 * persis dengan field asli (cuma discale), di SEMUA device (mobile,
 * tablet, desktop) -- sama seperti field teks lain, tidak diperlakukan
 * istimewa. Ini SENGAJA: minimum kenyamanan sentuh yang pernah ada di sini
 * (lihat riwayat git) justru jadi akar penyebab dua bug berikutnya (kotak
 * melebar keluar dokumen, lalu tanda tangan hasil PDF menyusut lebih kecil
 * dari field karena scaleToFit menyusutkan sisi yang rasionya tidak cocok
 * lagi dengan field) -- root cause sebenarnya, bukan solusinya. Trade-off
 * yang diterima: field TTD yang didesain kecil di editor akan menghasilkan
 * kotak gambar yang kecil juga di layar sempit, tanpa proteksi otomatis.
 *
 * `_bgWidth`/`_bgHeight` sengaja dipertahankan di signature (diawali `_`
 * supaya lolos `noUnusedParameters`) walau tidak dipakai lagi di badan
 * fungsi -- supaya pemanggil (`PaktaDocumentPreview.tsx`) tidak perlu
 * diubah.
 */
export function computeSignatureBox(
  field: Pick<Field, 'x' | 'y' | 'lebar' | 'tinggi'>,
  scale: number,
  _bgWidth: number,
  _bgHeight: number,
): SignatureBox {
  return {
    left: field.x * scale,
    top: field.y * scale,
    width: field.lebar * scale,
    height: (field.tinggi ?? field.lebar / 2) * scale,
  };
}
```

- [ ] **Step 4: Jalankan test untuk konfirmasi semua lolos**

Run: `npx vitest run tests/paktaPreviewLayout.test.ts`

Expected: semua test di file ini **PASS**, termasuk 4 test dari Step 1.

- [ ] **Step 5: Jalankan seluruh test suite & build untuk pastikan tidak ada regresi**

Run: `npm run test`

Expected: semua 22 file test **PASS** (khususnya `tests/PaktaDocumentPreview.test.tsx`, yang memakai `computeSignatureBox` secara tidak langsung lewat `PaktaDocumentPreview` — pastikan tidak ada test di file itu yang mengasumsikan kotak dibesarkan ke minimum tertentu; kalau ada dan gagal, itu WAJAR/diharapkan karena perilaku memang berubah, update test tersebut mengikuti perilaku baru sebelum lanjut, JANGAN skip/hapus test).

Run: `npm run build`

Expected: `tsc -b && vite build` selesai TANPA ERROR — khususnya pastikan tidak ada error `noUnusedParameters`/`noUnusedLocals` (parameter `_bgWidth`/`_bgHeight` dan penghapusan `clamp()` sudah menangani ini, tapi WAJIB diverifikasi lewat build sungguhan, bukan diasumsikan).

- [ ] **Step 6: Verifikasi manual di browser sungguhan (WAJIB — bug asli hanya terlihat di viewport mobile sungguhan)**

Task ini TIDAK boleh dianggap selesai hanya dari Step 4-5 lolos — itu cuma membuktikan tidak ada regresi & logic murni benar, BUKAN membuktikan bug yang dilaporkan user (hasil TTD lebih kecil dari field di mobile) sungguh hilang secara end-to-end.

Gunakan `preview_*` tools (server dev via `preview_start`, viewport mobile via `preview_resize`) dengan harness sementara yang me-render `PaktaDocumentPreview` di DALAM wrapper CSS produksi (`className="apple-page"` > `className="apple-page-compact"`, PERSIS seperti `PaktaSignPage.tsx` — supaya lebar container yang terukur akurat, bukan asumsi), pakai field TTD rasio default editor (`lebar: 600, tinggi: 240` pada `bgWidth: 1000` — rasio 2.5:1, sama seperti `PaktaEditor.tsx`'s `newPaktaField`). Harness sementara ini TIDAK dikomit — buat, verifikasi, lalu `git checkout -- <file yang diubah untuk harness>` setelah selesai.

Langkah verifikasi, di viewport **375px** (iPhone SE/mini) DAN **390px** (iPhone 12/13/14 reguler — ukuran paling umum, dan yang PALING TIDAK terbantu oleh opsi lain yang sempat dipertimbangkan sebelum fix ini):
1. Baca lewat `preview_eval`: `document.querySelector('canvas').getBoundingClientRect()` — lebar/tinggi kotak SEKARANG harus sama persis dengan `field.lebar * scale` / `field.tinggi * scale` (rasio kotak = 2.5:1, BUKAN lagi rasio "kotak dipaksa tinggi 140px" dari sebelum fix).
2. Gambar tanda tangan sederhana (`PointerEvent` sintetis dengan delay antar-event, pola yang sudah dipakai di verifikasi-verifikasi sebelumnya di sesi ini).
3. Render lewat `renderPakta` sungguhan (impor `renderPakta` dari `../lib/pdfRenderer` di harness, panggil dengan template + tangkapan tanda tangan asli), decode content stream PDF hasilnya (pola `pageContentText` yang sudah dipakai di verifikasi sebelumnya — pakai `PDFDocument`, `PDFName`, `PDFRawStream`, `PDFRef`, `PDFArray`, `decodePDFRawStream` dari `'pdf-lib'`), cek `cm` operator terakhir sebelum tanda tangan (scale) — lebar & tinggi hasil embed harus **PERSIS** `field.lebar` dan `field.tinggi ?? field.lebar/2` (mengisi 100% field, TIDAK ada lagi penyusutan), di KEDUA viewport (375px dan 390px).

Kalau hasil `cm` operator TIDAK persis 100% field di SALAH SATU viewport, STOP — fix belum benar, jangan lanjut ke Step 7.

- [ ] **Step 7: Commit**

```bash
git add src/lib/paktaPreviewLayout.ts tests/paktaPreviewLayout.test.ts
git commit -m "fix(pakta): kotak TTD selalu persis ukuran field, hapus minimum sentuh

computeSignatureBox() disederhanakan: kotak TTD interaktif sekarang selalu
= field.x/y/lebar/tinggi * scale, tanpa pembesaran/clamp apapun -- sama
di semua device (mobile, tablet, desktop). MIN_SIGNATURE_WIDTH/HEIGHT
(dari PR #33, dimaksudkan untuk kenyamanan sentuh) dihapus total, beserta
helper clamp() yang jadi dead code setelahnya -- keduanya justru jadi
akar penyebab bug berikutnya: rasio kotak berbeda dari rasio field,
sehingga scaleToFit (fix contain-fit sebelumnya) menyusutkan hasil embed
PDF (~59% lebar field untuk rasio field default 2.5:1 di mobile).

Trade-off yang disetujui eksplisit: tidak ada lagi proteksi kenyamanan
sentuh untuk field TTD yang didesain kecil di editor -- kotak gambar di
HP kecil akan ikut kecil untuk field seperti itu, tanpa pembesaran
otomatis.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Catatan untuk Controller (bukan bagian task subagent)

Step 6 (verifikasi manual browser) memerlukan `preview_*` tools yang HANYA tersedia di sesi controller (bukan di subagent implementer biasa). Kalau task ini dijalankan lewat `subagent-driven-development`, controller perlu:
1. Membiarkan implementer subagent menyelesaikan Step 1-5 dan Step 7 (commit), MELEWATI Step 6 dengan melaporkannya sebagai `DONE_WITH_CONCERNS` (concern: "Step 6 verifikasi manual browser memerlukan preview_* tools yang tidak tersedia untuk subagent — perlu dilakukan controller setelah commit").
2. Controller sendiri menjalankan Step 6 SETELAH implementer commit, SEBELUM task dianggap benar-benar selesai dan sebelum task reviewer di-dispatch (atau sertakan hasil verifikasi manual controller sebagai bagian dari bukti yang diberikan ke task reviewer).
