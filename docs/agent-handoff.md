## Agent Handoff

**Branch:** `claude/sharp-chaum-8bf41f`
**Task:** Setelah PR #35 (kotak TTD selalu persis ukuran field), user melaporkan bug baru: coretan tanda tangan terlalu tebal di halaman signing mobile (preview MAUPUN hasil output PDF).
**Last agent:** Claude Sonnet 5 (Claude Code), via skill `systematic-debugging` → `brainstorming` → `writing-plans` → `subagent-driven-development`
**Status:** SELESAI. Final whole-branch review: **Ready to merge**, 0 Critical/Important (2 Minor/observasi — 1 sudah diperbaiki controller lewat komentar cross-reference, 1 dicatat sebagai future improvement, tidak blocking). Build ✅, test 141/141 ✅. **Belum di-push/PR/merge** — menunggu instruksi eksplisit user.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-03-pakta-signature-stroke-width-scaling-design.md`
- Plan: `docs/superpowers/plans/2026-07-03-pakta-signature-stroke-width-scaling.md`
- Ledger progres SDD: `.superpowers/sdd/progress.md`

### Ringkasan

**Root cause (dikonfirmasi lewat systematic-debugging + verifikasi matematis di browser sungguhan):** `SignaturePad.tsx` memakai `minWidth: 1, maxWidth: 3` (CSS piksel) TETAP, independen dari `scale` layar-ke-dokumen. Setelah PR #35 (kotak TTD persis ukuran field, tanpa minimum lagi), kotak capture di mobile jadi jauh lebih kecil secara absolut. Diverifikasi matematis: lebar goresan FINAL setelah di-embed ke PDF = `W_css / scale` — **`dpr` terbukti saling meniadakan sepenuhnya dari perhitungan**, tidak perlu dikompensasi terpisah. Untuk `scale` khas mobile (~0.1-0.4, tergantung resolusi template & lebar layar), faktor `1/scale` bisa 2.5x-10x — goresan yang dulu pas jadi terlalu tebal, baik di preview (lebih dominan relatif ke kotak kecil) maupun output PDF (di-scale-up proporsional).

**Insight kunci:** `minWidth: 1, maxWidth: 3` yang SUDAH ADA justru adalah target lebar goresan FINAL yang benar (itu kenapa desktop terlihat baik — `scale` desktop cukup dekat ke 1). Tidak perlu menebak angka baru — cukup terapkan kompensasi `scale` secara konsisten di semua device.

**Ini bug ke-4 di saga yang sama** (contain-fit → useLayoutEffect race → box-match-field → stroke-width-scaling), masing-masing root cause BERBEDA tapi saling terkait dalam satu rantai matematis: ukuran kotak (fix #3) → resolusi capture (fix #2) → faktor scale saat embed (fix #1) → kompensasi lebar goresan (fix ini). Final reviewer memverifikasi seluruh rantai ini secara matematis terhadap kode sungguhan dan mengonfirmasi semuanya konsisten.

### Ringkasan Perubahan
- `src/components/pakta-signer/SignaturePad.tsx` — prop baru `strokeScale?: number` (default `1`). Konstanta `BASE_MIN_WIDTH=1`, `BASE_MAX_WIDTH=3` (target final, bukan cuma nilai constructor). `minWidth`/`maxWidth` dikalikan `strokeScale` saat pembuatan pad, DAN dimutasi lewat efek terpisah (`[strokeScale]` deps) saat scale berubah — TIDAK membuat ulang pad (supaya goresan yang sedang digambar tidak hilang saat resize kontainer).
- `src/components/pakta-signer/PaktaDocumentPreview.tsx` — satu baris: `<SignaturePad ... strokeScale={scale} />`, meneruskan `scale` yang sudah dihitung komponen ini.
- `src/components/pakta-signer/PaktaSignPage.tsx` — TIDAK disentuh. Fallback standalone (`!hasSigField`) tidak diberi `strokeScale`, default `1` berlaku — dikonfirmasi benar oleh final reviewer: signature di jalur itu tidak pernah di-embed lewat field manapun (`renderPakta` skip total kalau tidak ada field `tandaTangan`), jadi tidak ada scale untuk dikompensasi.
- `tests/SignaturePad.test.tsx` — mock `signature_pad` diperbarui untuk meng-capture `minWidth`/`maxWidth` sebagai instance property (bukan cuma di `options`), + 3 test baru.
- `src/lib/pdfRenderer.ts` — komentar diperbarui (bukan logic) untuk menjelaskan ketergantungan `scaleToFit` terhadap `strokeScale` (ditemukan final reviewer sebagai Minor: komentar lama menyiratkan `scaleToFit` "cuma no-op defensif", padahal sekarang faktor pembesarannya adalah kebalikan tepat dari `strokeScale` — kalau `scaleToFit` dihapus tanpa meninjau ulang `strokeScale`, jaminan lebar goresan konsisten akan rusak diam-diam).

### Verifikasi manual yang sudah dilakukan
Harness sementara di `src/App.tsx` (query param `?debugStroke=1`, wrapper CSS produksi sungguhan, `bgWidth=2000` — skenario resolusi template TINGGI yang sengaja dipilih sebagai kasus PALING EKSTREM untuk faktor pembesaran, TIDAK dikomit — dibuat, diverifikasi, `git checkout` setelahnya) + `preview_*` tools:
- ✅ Gambar tanda tangan di kotak native (kecil, ~205×82px di viewport 390px) — goresan terlihat tipis/wajar di layar.
- ✅ Tangkapan PNG di-stretch ke simulasi ukuran FINAL embed (rasio field asli, 500px lebar tampilan) — goresan TETAP tipis/bersih, TIDAK melebar jadi blok tebal, konsisten dengan prediksi matematis (sebelum fix, skenario 2000px ini akan menghasilkan faktor pembesaran ~2.9x, jelas terlihat tebal).

**Belum diverifikasi:** alur signing end-to-end dengan Supabase asli di HP fisik sungguhan (bukan viewport emulasi browser), dan belum ada automated test yang mengunci INVARIAN penuh (lebar goresan final = konstan, independen device) — saat ini hanya diverifikasi manual + matematis, dicatat final reviewer sebagai potensi improvement masa depan (bukan blocking).

### Commands Run
```
npm install
npm run build   # tsc -b && vite build — PASS
npm run test    # 22 file, 141/141 test — PASS
```
Tidak ada script `lint` di `package.json` (pre-existing, di luar scope).

### Known Issues
- Tidak ada automated test yang mengunci invarian penuh "lebar goresan final = konstan di semua device/resolusi" — saat ini rantai matematisnya (box size → capture resolution → embed scale → stroke compensation) hanya diverifikasi lewat kombinasi unit test per-fix + verifikasi manual browser. Kalau nanti ada yang menyederhanakan `scaleToFit` di `pdfRenderer.ts` (terlihat seperti no-op) tanpa membaca komentar barunya, jaminan ini bisa rusak diam-diam tanpa CI menangkapnya. Dicatat final reviewer sebagai Minor/future improvement.
- Tidak ada script `lint` di project (pre-existing).
- Bundle JS utama >2MB setelah build (warning Vite, pre-existing, tidak terkait perubahan ini).

### Next Step
1. User me-review perubahan (atau minta code review lewat `/code-review`).
2. Push branch & buat PR hanya setelah user eksplisit minta.
3. Sebelum atau sesudah merge: uji manual sekali dengan Supabase environment nyata di HP fisik sungguhan untuk menutup gap verifikasi di atas.
4. Pertimbangkan (tidak mendesak): tambah automated test yang mengunci invarian lebar goresan final secara end-to-end (lintas `computeSignatureBox` + `SignaturePad` + `scaleToFit`), supaya perubahan di salah satu bagian rantai matematis ini tertangkap otomatis oleh CI, bukan cuma verifikasi manual.
