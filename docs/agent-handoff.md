## Agent Handoff

**Branch:** `claude/sharp-chaum-8bf41f`
**Task:** Setelah PR #34 (contain-fit + useLayoutEffect) merge ke main, user melaporkan bug lanjutan: kotak TTD di mobile masih lebih tinggi dari template field, dan hasil output TTD di PDF masih lebih kecil dari ukuran seharusnya.
**Last agent:** Claude Sonnet 5 (Claude Code), via skill `systematic-debugging` → `brainstorming` (2 putaran, opsi pertama ditolak setelah verifikasi CSS produksi) → `writing-plans` → `subagent-driven-development`
**Status:** SELESAI. Final whole-branch review: **Ready to merge**, 0 Critical/Important (1 Minor — komentar basi di `pdfRenderer.ts` — sudah diperbaiki langsung oleh controller). Build ✅, test 138/138 ✅. **Belum di-push/PR/merge** — menunggu instruksi eksplisit user.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-02-pakta-signature-box-match-field-design.md`
- Plan: `docs/superpowers/plans/2026-07-02-pakta-signature-box-match-field.md`
- Ledger progres SDD: `.superpowers/sdd/progress.md`

### Ringkasan

**Root cause (dikonfirmasi lewat systematic-debugging, BUKAN bug DPI/canvas):** `computeSignatureBox` (PR #33) membesarkan lebar & tinggi kotak TTD interaktif SECARA INDEPENDEN ke minimum 140px masing-masing (demi kenyamanan sentuh) — sengaja tidak mempertahankan rasio field asli. Setelah PR #34 menambahkan `scaleToFit` (contain-fit, tidak pernah stretch) saat embed ke PDF, box yang rasionya sudah berbeda dari field membuat `scaleToFit` menyusutkan hasil embed — untuk field rasio default editor (2.5:1) di mobile, hasil PDF cuma ~59% lebar field (diverifikasi dengan render `renderPakta` sungguhan memakai tangkapan tanda tangan asli, bukan fixture).

**Opsi yang dieksplorasi & ditolak sebelum keputusan final:**
1. "Coba pembesaran seragam (preserve rasio field) dulu, fallback ke clamp independen kalau tidak muat" — setelah diverifikasi dengan CSS produksi sungguhan (`.apple-page` padding 24px×2=48px, BUKAN asumsi awal yang lebih longgar), ternyata HANYA menolong HP berlayar lebar (Pixel ~412px, iPhone Plus/Pro Max ~428px+), TIDAK menolong ukuran HP paling umum (iPhone 12/13/14 reguler 390px, iPhone SE/mini 375px). Ditolak user.

**Keputusan final:** hapus TOTAL `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT` — kotak TTD interaktif SELALU persis ukuran field asli (di-scale), di SEMUA device, sama seperti desktop/tablet yang sudah baik. Trade-off yang disetujui eksplisit: TIDAK ADA lagi proteksi kenyamanan sentuh untuk field TTD yang didesain kecil di editor.

### Ringkasan Perubahan
- `src/lib/paktaPreviewLayout.ts` — `computeSignatureBox` disederhanakan total: `{ left: field.x*scale, top: field.y*scale, width: field.lebar*scale, height: (field.tinggi ?? field.lebar/2)*scale }`, tanpa cabang logic apapun. `MIN_SIGNATURE_WIDTH`/`MIN_SIGNATURE_HEIGHT` dihapus (dikonfirmasi tidak ada consumer lain). Helper `clamp()` juga dihapus (jadi dead code setelah perubahan ini, dikonfirmasi lewat grep tidak ada pemanggil lain).
- `tests/paktaPreviewLayout.test.ts` — `describe('computeSignatureBox', ...)` ditulis ulang total (4 test baru, termasuk test eksplisit yang membuktikan box TIDAK dibesarkan lagi untuk field kecil — bukti trade-off yang disetujui).
- `src/lib/pdfRenderer.ts` — komentar di `renderPakta` diperbarui (bukan logic) untuk mencerminkan bahwa `scaleToFit` sekarang praktis jadi no-op (rasio box selalu = rasio field), tetap dipertahankan sebagai lapisan pertahanan.

### Verifikasi manual yang sudah dilakukan
Harness sementara di `src/App.tsx` (query param `?debugBoxMatch=1`, DI DALAM wrapper CSS produksi sungguhan `apple-page`/`apple-page-compact`, TIDAK dikomit — dibuat, diverifikasi, `git checkout` setelahnya) + `preview_*` tools, field rasio default editor (600×240, 2.5:1):
- ✅ Viewport 375px (iPhone SE/mini): kotak interaktif 196.2×78.5px (rasio 2.500, persis rasio field). Tanda tangan sungguhan → `renderPakta` sungguhan → embed PDF: lebar 600/600 (100%), tinggi 238.8/240 (99.5%, selisih murni pembulatan sub-piksel buffer kanvas, bukan bug).
- ✅ Viewport 390px (iPhone 12/13/14 reguler — ukuran paling umum, yang PALING TIDAK terbantu opsi lain sebelumnya): kotak 205.2×82.1px (rasio 2.500). Embed PDF: lebar 600/600, tinggi 240/240 — **persis 100% di kedua sumbu**.
- Dibandingkan sebelum fix: ~59% lebar field di mobile → sekarang ~100% di kedua viewport yang diuji.

**Belum diverifikasi:** alur signing end-to-end dengan Supabase asli di HP fisik sungguhan (bukan viewport emulasi browser).

### Commands Run
```
npm install
npm run build   # tsc -b && vite build — PASS
npm run test    # 22 file, 138/138 test — PASS
```
Tidak ada script `lint` di `package.json` (pre-existing, di luar scope).

### Known Issues
- Field TTD yang didesain sangat kecil di editor (mis. tinggi di bawah ~50px hasil scale) akan menghasilkan kotak gambar yang sama kecilnya di HP layar sempit — TIDAK ADA lagi proteksi otomatis (trade-off yang disetujui eksplisit oleh user). Kalau ini jadi keluhan baru, solusinya BUKAN mengembalikan minimum (sudah terbukti 2x menimbulkan bug baru), tapi mendorong desain field TTD yang cukup besar di editor, atau — kalau benar-benar perlu — opsi "crop tangkapan tanda tangan ke bounding box ink" yang sempat dibahas saat brainstorming tapi sengaja tidak diambil di fix ini (lihat spec bagian 3, "Catatan: Opsi yang sengaja tidak diambil").
- Tidak ada script `lint` di project (pre-existing).
- Bundle JS utama >2MB setelah build (warning Vite, pre-existing, tidak terkait perubahan ini).

### Next Step
1. User me-review perubahan (atau minta code review lewat `/code-review`).
2. Push branch & buat PR hanya setelah user eksplisit minta.
3. Sebelum atau sesudah merge: uji manual sekali dengan Supabase environment nyata di HP fisik sungguhan untuk menutup gap verifikasi di atas.
