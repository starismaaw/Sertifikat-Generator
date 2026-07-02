## Agent Handoff

**Branch:** `claude/sharp-chaum-8bf41f`
**Task:** Setelah PR #33 (kotak TTD melebar/tombol Hapus menutupi preview di mobile) merge ke main, user melaporkan 2 bug baru: (1) hasil tanda tangan di PDF akhir tidak sesuai placement/bentuk dengan template saat ditandatangani dari mobile, (2) coretan tanda tangan di mobile terlihat sangat tebal & tidak natural.
**Last agent:** Claude Sonnet 5 (Claude Code), via skill `systematic-debugging` → `brainstorming` → `writing-plans` → `subagent-driven-development`
**Status:** SELESAI (2 fix terpisah, root cause berbeda). Final whole-branch review: **Ready to merge**, 0 Critical/Important. Build ✅, test 141/141 ✅. **Belum di-push/PR/merge** — menunggu instruksi eksplisit user (lihat PR #33 untuk pola commit sebelumnya di sesi yang sama).

### Referensi
- Spec fix #1: `docs/superpowers/specs/2026-07-02-pakta-signature-natural-fit-design.md`
- Plan fix #1: `docs/superpowers/plans/2026-07-02-pakta-signature-natural-fit.md`
- Spec fix #2: `docs/superpowers/specs/2026-07-02-pakta-signature-canvas-resolution-race-design.md`
- Plan fix #2: `docs/superpowers/plans/2026-07-02-pakta-signature-canvas-resolution-race.md`
- Ledger progres SDD: `.superpowers/sdd/progress.md`

### Ringkasan: Dua Root Cause Terpisah, Satu Gejala Laporan User

Investigasi (manual browser verification, bukan cuma baca kode) menemukan gejala yang dilaporkan user disebabkan **dua bug independen di layer berbeda**, keduanya harus diperbaiki bersama:

**Fix #1 — Contain-fit saat embed ke PDF** (`src/lib/pdfRenderer.ts`, `renderPakta`, commit `8cee4e9`):
`page.drawImage` sebelumnya stretch gambar tanda tangan paksa ke `field.lebar × field.tinggi` tanpa peduli rasio asli gambar. Diganti pakai `sigImage.scaleToFit(field.lebar, h)` (bawaan pdf-lib, setara `object-fit:contain`) + di-centering manual — gambar sekarang di-scale seragam (rasio terjaga) lalu dipusatkan di kotak field, bukan di-stretch non-uniform.

**Fix #2 — Race kondisi resolusi kanvas** (`src/components/pakta-signer/PaktaDocumentPreview.tsx`, commit `8b5c48e`):
Ditemukan SAAT verifikasi manual fix #1 — kanvas `SignaturePad` bisa mengunci resolusi internal (`canvas.width`/`height`) ke ukuran SALAH (rasio field asli, mis. 960×384) sejak render pertama, walau kotak yang TERLIHAT di layar sudah benar (mis. 177×140) — karena `PaktaDocumentPreview` mengoreksi `scale` lewat `useEffect` (passive/async) yang bisa berjalan SETELAH `SignaturePad`'s sendiri `useEffect` (juga passive) sudah telanjur mengukur & mengunci ukuran salah. Diverifikasi empiris REPRODUCIBLE (bukan race sesaat) lewat reload penuh & resize viewport sungguhan. Fix: ganti `useEffect`→`useLayoutEffect` di efek koreksi scale — menjamin koreksi selesai SINKRON sebelum browser paint & sebelum efek passive turunan manapun berjalan.

**Kenapa keduanya perlu, tidak cukup salah satu** (dikonfirmasi final reviewer): fix #1 saja tidak bisa memperbaiki distorsi yang SUDAH terjadi di piksel sumber (kanvas capture salah resolusi sejak awal). Fix #2 saja tidak cukup karena `computeSignatureBox` (PR #33) SENGAJA membuat rasio kotak layar ≠ rasio field asli (touch-target usability) — begitu kanvas capture benar, embed-nya tetap perlu contain-fit supaya tidak di-stretch ulang saat rasio box vs field legitimately berbeda.

### Bug ditemukan & diperbaiki selama proses
1. **Contain-fit (fix #1):** ditemukan lewat systematic-debugging awal atas laporan user — bukti: test lama (`tests/paktaPreviewLayout.test.ts`, sebelum sesi ini) sudah men-dokumentasikan stretch-fill sebagai "expected" untuk kotak yang di-clamp PR #33.
2. **Canvas resolution race (fix #2):** ditemukan TIDAK LEWAT baca kode, tapi lewat verifikasi manual browser sungguhan untuk fix #1 (harness sementara + `preview_*` tools) — nilai `canvas.width`/`height` ternyata tidak cocok dengan `canvas.offsetWidth`/`height × devicePixelRatio`, reproducible di berbagai kondisi. Root-caused ke urutan efek React (`useEffect` vs `useLayoutEffect`) sebelum diperbaiki.

### Verifikasi manual yang sudah dilakukan
Semua lewat harness sementara di `src/App.tsx` (query param `?debugSigFit=1` / `?debugCanvasRace=1`, TIDAK dikomit — dibuat, diverifikasi, lalu `git checkout` setiap kali) + `preview_*` tools:
- ✅ Fix #1: render `renderPakta` sungguhan dengan signature PNG hasil tangkap real (bukan fixture 1×1), cek `cm` operator PDF — bentuk yang di-embed proporsional & tersentral, bukan stretch.
- ✅ Fix #2, saat mount: `canvas.width`/`height` (330×280) SAMA dengan `canvas.offsetWidth`/`height × dpr` (330×280) — sebelum fix, ini 960×384 (salah, mengikuti rasio field 2.5:1, bukan rasio kotak layar).
- ✅ Fix #2, setelah resize viewport sungguhan (375→400px): tetap sinkron (354×280 = 354×280) — konfirmasi `ResizeObserver` untuk resize LANJUTAN tetap berfungsi, fix hanya menghilangkan race di INISIALISASI.
- ✅ End-to-end kedua fix bersama: gambar tanda tangan sederhana (PointerEvent sintetis) → screenshot menunjukkan coretan tipis & tidak terdistorsi.

**Belum diverifikasi:** alur signing end-to-end dengan Supabase asli (perlu `.env` kredensial valid + event/signer nyata) dan pengujian di perangkat mobile fisik sungguhan (bukan emulasi viewport).

### Commands Run
```
npm install
npm run build   # tsc -b && vite build — PASS
npm run test    # 22 file, 141/141 test — PASS
```
Tidak ada script `lint` di `package.json` (pre-existing, di luar scope).

### Known Issues
- Fix #2 (`useLayoutEffect`) tidak punya automated test coverage — dicatat eksplisit di spec sebagai keterbatasan sengaja (race timing browser nyata tidak tereproduksi di jsdom, `ResizeObserverStub` di `tests/setup.ts` no-op). Final reviewer menandai ini sebagai risiko regresi jangka panjang (Minor, tidak blocking): kalau nanti ada yang tanpa sadar mengubah `useLayoutEffect` balik ke `useEffect`, tidak ada test yang akan gagal untuk menangkapnya.
- Tidak ada script `lint` di project (pre-existing).
- Bundle JS utama >2MB setelah build (warning Vite, pre-existing, tidak terkait perubahan ini).

### Next Step
1. User me-review perubahan (atau minta code review lewat `/code-review`).
2. Push branch & buat PR hanya setelah user eksplisit minta (pola commit yang sama seperti PR #33 di sesi sebelumnya — commit sudah dilakukan bertahap oleh subagent, working tree bersih, tinggal push+PR+merge kalau diminta).
3. Sebelum atau sesudah merge: uji manual sekali dengan Supabase environment nyata di HP fisik sungguhan (bukan viewport emulasi) untuk menutup gap verifikasi di atas.
