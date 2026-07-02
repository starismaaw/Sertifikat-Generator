# Spec: Kotak TTD Selalu Persis Ukuran Field (Hapus Minimum Sentuh)

**Tanggal:** 2026-07-02
**Status:** Approved
**Scope:** `src/lib/paktaPreviewLayout.ts` (`computeSignatureBox`, hapus `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT`), `tests/paktaPreviewLayout.test.ts`

---

## 1. Latar Belakang

Setelah PR #33 (fix kotak TTD melebar di mobile) dan PR #34 fix #1 (contain-fit saat embed ke PDF), user melaporkan bug baru: hasil TTD di PDF akhir lebih kecil dari field, dan kotak interaktif di layar lebih tinggi dari field — khusus di mobile (desktop/tablet normal).

### 1.1 Root cause (dikonfirmasi lewat systematic-debugging)

Diverifikasi empiris di browser sungguhan: BUKAN bug DPI/resolusi kanvas (`canvas.width`/`height` selalu cocok dengan `canvas.offsetWidth`/`height × devicePixelRatio`, fix `useLayoutEffect` sebelumnya bekerja benar).

Root cause sebenarnya: `computeSignatureBox` (PR #33) membesarkan lebar & tinggi kotak interaktif SECARA INDEPENDEN ke `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT` (140px masing-masing), sengaja TIDAK mempertahankan rasio field asli — supaya kotak nyaman digambar dengan jari di layar sempit. Ini membuat rasio kotak di layar berbeda dari rasio field. Saat `renderPakta` (PR #34 fix #1) meng-embed pakai `scaleToFit` (scale seragam, tidak pernah stretch), sisi yang tidak match rasio field DISUSUTKAN. Untuk field rasio default editor (2.5:1), hasil embed di mobile hanya ~59% lebar field (diverifikasi dengan render `renderPakta` sungguhan memakai tangkapan tanda tangan asli).

### 1.2 Sudah dicoba & ditolak: pembesaran seragam dengan fallback

Sempat diusulkan: coba pembesaran seragam (mempertahankan rasio field) dulu, fallback ke clamp independen kalau tidak muat di layar. Setelah diverifikasi dengan CSS produksi sungguhan (`.apple-page` padding 24px×2 = 48px total, BUKAN asumsi awal yang lebih longgar), ternyata pendekatan ini HANYA menolong HP berlayar lebar (Pixel ~412px, iPhone Plus/Pro Max ~428px+) — TIDAK menolong ukuran HP paling umum (iPhone 12/13/14 reguler 390px, iPhone SE/mini 375px, Android biasa ~360px), karena lebar yang dibutuhkan untuk pembesaran seragam (350px untuk field rasio 2.5:1) melebihi lebar container sungguhan di HP-HP itu (327-342px). Pendekatan ini DITOLAK user karena tidak benar-benar menyelesaikan laporan bug untuk mayoritas perangkat.

### 1.3 Keputusan final user

User memutuskan: **hapus total** `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT`. Kotak TTD interaktif di SEMUA device (termasuk mobile) harus selalu persis ukuran field asli (di-scale) — sama seperti perilaku desktop/tablet yang sudah baik (di sana minimum ini jarang aktif karena lebar container biasanya cukup besar sehingga tinggi hasil scale sudah alami melebihi 140px). Trade-off yang disetujui secara eksplisit: TIDAK ADA proteksi kenyamanan sentuh lagi untuk field yang didesain kecil di editor — kalau field TTD dibuat kecil, kotak gambarnya di HP kecil juga akan kecil (bisa di bawah 50px tinggi untuk kasus ekstrem), tanpa pembesaran otomatis apapun.

---

## 2. Fix: `computeSignatureBox` Tanpa Minimum

### 2.1 Implementasi baru

```ts
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
 */
export function computeSignatureBox(
  field: Pick<Field, 'x' | 'y' | 'lebar' | 'tinggi'>,
  scale: number,
  bgWidth: number,
  bgHeight: number,
): SignatureBox {
  return {
    left: field.x * scale,
    top: field.y * scale,
    width: field.lebar * scale,
    height: (field.tinggi ?? field.lebar / 2) * scale,
  };
}
```

Parameter `bgWidth`/`bgHeight` tidak lagi dipakai di badan fungsi (tidak ada lagi clamp ke batas dokumen, karena field seharusnya selalu berada di dalam batas dokumen by construction dari editor — field tidak bisa dibuat/digeser keluar kanvas di `PaktaEditor.tsx`). **Tetap dipertahankan di signature fungsi** supaya tidak mengubah pemanggil (`PaktaDocumentPreview.tsx:113`, yang memanggil `computeSignatureBox(sigField, scale, template.bgWidth, template.bgHeight)`) — mengubah signature fungsi di luar scope fix ini.

`clamp()` (helper lokal di file yang sama) jadi tidak lagi dipakai oleh `computeSignatureBox` — **cek dulu di implementasi apakah masih dipakai fungsi lain di file ini sebelum dihapus** (bukan bagian scope fix ini untuk menganalisis, biarkan step implementasi yang mengecek & memutuskan).

`MIN_SIGNATURE_WIDTH` dan `MIN_SIGNATURE_HEIGHT` **dihapus total** dari file (dikonfirmasi lewat grep sebelum spec ini ditulis: hanya dipakai di file ini sendiri & testnya, tidak ada consumer lain).

### 2.2 Kenapa ini memperbaiki kedua gejala

- **"Kotak lebih tinggi dari field":** tidak mungkin lagi terjadi — tinggi kotak SELALU `field.tinggi * scale`, tidak pernah dibesarkan.
- **"Hasil output lebih kecil dari field":** tidak mungkin lagi terjadi — rasio kotak SELALU sama persis dengan rasio field (`width/height` kotak = `field.lebar/field.tinggi`, by construction), jadi `scaleToFit(field.lebar, h)` di `renderPakta` akan SELALU menghasilkan scale yang sama tepat di kedua sumbu → mengisi 100% field, TIDAK PERNAH ada sisi yang jadi faktor pembatas.

### 2.3 Kenapa desktop/tablet tidak berubah perilakunya

Di desktop/tablet, `scale` (rasio lebar container terhadap `bgWidth`) biasanya cukup besar sehingga `field.tinggi * scale` SUDAH alami >= 140px tanpa perlu pembesaran — minimum yang dihapus jarang/tidak pernah aktif di sana. Fix ini murni menghapus jalur kode yang HANYA aktif saat hasil scale field di bawah minimum (kasus mobile) — desktop/tablet secara matematis tidak terpengaruh.

---

## 3. Hal yang Tidak Berubah

- `src/lib/pdfRenderer.ts` (`scaleToFit` + centering, dari PR #34 fix #1) — TIDAK disentuh. Dengan kotak yang sekarang selalu match rasio field, `scaleToFit` otomatis jadi no-op (selalu fill 100%) tanpa perlu logic tambahan apapun di sisi embed.
- `src/components/pakta-signer/SignaturePad.tsx` — TIDAK disentuh.
- `src/components/pakta-signer/PaktaDocumentPreview.tsx` — TIDAK disentuh (pemanggil `computeSignatureBox` tetap sama, parameter tetap sama, hanya hasil kembaliannya yang sekarang lebih sederhana).
- Posisi (`left`/`top`) — sudah tidak butuh logic "pusatkan lalu clamp ke batas dokumen" lagi (tidak ada lagi pembesaran yang perlu dikompensasi), langsung `field.x/y * scale`.

---

## 4. Verifikasi

- Ganti SELURUH isi `describe('computeSignatureBox', ...)` di `tests/paktaPreviewLayout.test.ts` — test lama yang menguji perilaku pembesaran/clamp (termasuk regression guard PR #33 dan test bug lebar-jauh) sudah tidak relevan dengan implementasi baru dan harus diganti dengan test yang menguji perilaku BARU: kotak selalu = `field.x*scale, field.y*scale, field.lebar*scale, (field.tinggi ?? field.lebar/2)*scale`, untuk beberapa kombinasi field & scale (termasuk kasus field kecil di scale kecil — sekarang box HARUS tetap kecil, bukan dibesarkan, sebagai bukti eksplisit trade-off yang disetujui).
- Hapus import `MIN_SIGNATURE_HEIGHT`/`MIN_SIGNATURE_WIDTH` dari test file (sudah tidak diekspor).
- `npm run build` — pastikan tidak ada error TypeScript (termasuk kalau `clamp()` jadi unused function setelah fix, harus dihapus juga supaya tidak jadi dead code / unused-var warning).
- `npm run test` — semua test lain (`tests/PaktaDocumentPreview.test.tsx`, `tests/pdfRenderer.test.ts`) tidak boleh regresi.
- Verifikasi manual di browser sungguhan (viewport mobile 375px & 390px, wrapper CSS produksi `apple-page apple-page-compact` yang sebenarnya, field rasio default 2.5:1 — skenario yang sudah dipakai untuk menemukan & mengukur bug ini): render `renderPakta` sungguhan dengan tanda tangan tangkapan asli, cek `cm` operator PDF — lebar hasil embed harus 100% lebar field (bukan lagi ~59%), di KEDUA lebar viewport (375 dan 390), tidak cuma yang lebar.
