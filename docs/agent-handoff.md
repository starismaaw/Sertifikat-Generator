## Agent Handoff

**Branch:** `claude/quizzical-elbakyan-b7f94e`
**Task:** Tambah opsi weight `SemiBold` dan `SemiBoldItalic` ke sistem font (editor sertifikat & pakta integritas)
**Last agent:** Claude Sonnet 5 (Claude Code), via brainstorming → writing-plans → subagent-driven-development
**Status:** COMPLETE (Task 1-7 dari plan selesai + review bersih) — build ✅, test 78/78 ✅, diverifikasi end-to-end (dropdown disable state di browser + PDF hasil ekspor sungguhan mengandung font `OpenSans-SemiBold`). Menunggu review akhir seluruh branch sebelum push/PR.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-01-semibold-font-weight-design.md`
- Plan: `docs/superpowers/plans/2026-07-01-semibold-font-weight.md`

### Latar Belakang
Sesi sebelumnya men-debug laporan user "output PDF Open Sans terlihat beda tebalnya dari Canva" — hasil investigasi: PDF sudah meng-embed font Open Sans asli dengan weight benar (bukan bug), perbedaan berasal dari rendering engine (anti-aliasing/hinting) yang berbeda antar viewer, bukan font salah. User kemudian minta ditambahkan opsi weight `SemiBold` sebagai pilihan baru di editor.

### Ringkasan Perubahan
- `src/lib/fontRegistry.ts` — tambah `SemiBold`/`SemiBoldItalic` ke `FontWeight`/`FONT_WEIGHTS`, tambah flag `hasSemiBold` per family (`false` hanya untuk Lato — satu-satunya family tanpa cut 600 resmi di Google Fonts), tambah `WEIGHT_CSS` (map tunggal weight→{weight number, italic}) + `toKonvaFontStyle()` + `isWeightDisabled()`.
- Konsolidasi: `EditorCanvas.tsx` & `CertPreviewMini.tsx` tadinya punya fungsi `konvaFontStyle()` duplikat identik — sekarang keduanya pakai `toKonvaFontStyle` dari fontRegistry. `pdfRenderer.ts`'s `toCssFont()` (di-export) sekarang pakai `WEIGHT_CSS` alih-alih switch bold/italic biner.
- `FieldProperties.tsx` — dropdown weight men-disable SemiBold/SemiBoldItalic via `isWeightDisabled()` (mengganti logic inline lama yang cuma tahu Italic/BoldItalic).
- `scripts/copy-fonts.mjs` — extend untuk copy file weight 600 dari `@fontsource/*` (bukan generate manual dari GitHub — file 600 sudah tersedia langsung di paket npm yang sudah ter-install). Menghasilkan 17 file baru di `public/fonts/` (8 family × 2 file SemiBold+SemiBoldItalic, Cinzel × 1 file SemiBold-only karena tidak punya italic sama sekali; Lato 0 file).
- `index.html` — tambah weight `600` ke query Google Fonts untuk 9 family (bukan Lato), supaya preview browser tidak mensintesis weight 600 dari 400/700.

### Files Changed
- `src/lib/fontRegistry.ts`
- `tests/fontRegistry.test.ts` (baru)
- `src/components/editor/EditorCanvas.tsx`
- `src/components/generate/CertPreviewMini.tsx`
- `src/lib/pdfRenderer.ts`
- `tests/pdfRenderer.test.ts`
- `src/components/editor/FieldProperties.tsx`
- `scripts/copy-fonts.mjs`
- `public/fonts/*-SemiBold*.woff` (17 file baru, generated — bukan ditulis manual)
- `index.html`

### Commands Run
- `npx vitest run` — ✅ 78/78 pass (14 file test)
- `npm run build` — ✅ 0 error (catatan: warning ukuran chunk >500kB sudah ada sebelum perubahan ini, tidak terkait)
- Tidak ada script `npm run lint` di `package.json` (tidak tersedia di proyek ini — sama seperti sesi sebelumnya)
- Verifikasi manual browser: dropdown weight di-disable dengan benar untuk Lato (SemiBold+SemiBoldItalic disabled), Cinzel (SemiBoldItalic disabled karena tidak ada italic sama sekali, SemiBold tetap aktif), Open Sans (semua aktif) — dicek langsung via DOM `option.disabled`.
- Verifikasi manual network: response Google Fonts CSS2 untuk Cinzel & EB Garamond dikonfirmasi mengandung blok `@font-face { font-weight: 600; ... }` asli (bukan sintesis browser).
- Verifikasi manual PDF: field dengan Font Family "Open Sans" + Weight "SemiBold" diekspor via alur Cetak → Unduh PDF sungguhan; byte PDF hasil unduhan diperiksa, resource font-nya bernama `/OpenSans-SemiBold-...` — konfirmasi pdf-lib benar-benar meng-embed file weight 600, bukan fallback diam-diam ke Helvetica.

### Validation
- Build: ✅ PASS
- Lint: N/A (tidak ada script lint)
- Test: ✅ 78/78 PASS

### Proses Eksekusi (Subagent-Driven Development)
Task 1-6 (data model, refactor Konva, refactor pdfRenderer, UI dropdown, generate font asset, index.html) dikerjakan oleh implementer subagent terpisah (fresh context per task, model haiku karena brief berisi kode lengkap) + task reviewer subagent (model sonnet, spec compliance + code quality), semua lolos review "Approved" tanpa temuan Critical/Important. Task 4 dan Task 6 masing-masing punya langkah verifikasi manual berbasis browser yang tidak bisa dilakukan implementer (tidak punya browser tooling) — controller yang menjalankannya langsung. Task 7 (verifikasi end-to-end) dan dokumen ini dikerjakan langsung oleh controller. Ledger progres di `.superpowers/sdd/progress.md` (git-ignored, lokal ke worktree ini).

Commit per task:
1. `785041e` — tambah SemiBold/SemiBoldItalic ke font registry
2. `a60f715` — pakai toKonvaFontStyle bersama, hapus duplikasi konvaFontStyle
3. `bb114d2` — toCssFont pakai WEIGHT_CSS, tambah dukungan SemiBold
4. `a5f7db2` — disable opsi SemiBold di dropdown untuk family tanpa dukungan
5. `4e0d22f` — generate 17 file weight SemiBold dari @fontsource
6. `d1b2d9a` — load weight 600 dari Google Fonts untuk preview SemiBold

### Known Issues
- Selama investigasi ditemukan koreksi terhadap draf spec awal: asumsi awal bahwa file font di-generate manual dari `google/fonts` GitHub repo (via fonttools variable-font instancer) ternyata salah — file sebenarnya disalin dari paket npm `@fontsource/*` oleh `scripts/copy-fonts.mjs`. Spec sudah dikoreksi sebelum implementasi dimulai (lihat bagian "Koreksi dari draf awal" di spec doc).
- Output test `vitest run` mengandung noise `Error: Not implemented: HTMLCanvasElement.prototype.getContext` dari jsdom — ini pre-existing (berasal dari `browserTextWidth()`'s try/catch di `pdfRenderer.ts`, sudah ada sebelum fitur ini, tidak terkait perubahan SemiBold), tertangkap dan tidak menggagalkan test, tapi bukan output yang benar-benar pristine.

### Next Step
- Jalankan review akhir seluruh branch (whole-branch code review) sebelum push/PR/merge.
- Setelah review akhir bersih: tunggu approval user untuk commit/push/PR (belum ada yang di-push ke remote pada branch ini).
- User disarankan mencoba fitur SemiBold di editor sungguhan (bukan hanya event sintetis yang dipakai untuk verifikasi) dan bandingkan hasil PDF dengan ekspektasi.
