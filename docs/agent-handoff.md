## Agent Handoff

**Branch:** `claude/frosty-gauss-fb09bb`
**Task:** Preview tanda tangan realistis untuk Pakta Integritas — dokumen penuh (background + field nama/NIP/jabatan terisi data asli) ditampilkan saat pegawai menandatangani, dengan kanvas TTD transparan tepat di posisi field `tandaTangan`, supaya terasa seperti menandatangani dokumen asli (bukan kartu ringkasan teks + kotak TTD terpisah seperti sebelumnya).
**Last agent:** Claude Sonnet 5 (Claude Code), via context7 research → brainstorming → writing-plans → subagent-driven-development
**Status:** SELESAI. Semua 7 task dari plan selesai, semua task review bersih (task 4 butuh 2 ronde fix — lihat di bawah). Manual browser verification oleh controller sendiri (lewat harness sementara + `preview_*` tools, tidak dikomit) menemukan dan memperbaiki 1 bug tambahan (lihat "Bug ditemukan lewat verifikasi manual"). Build ✅, test 136/136 ✅. **Belum di-push/PR/merge** — menunggu instruksi eksplisit user.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-02-pakta-realistic-signing-preview-design.md`
- Plan: `docs/superpowers/plans/2026-07-02-pakta-realistic-signing-preview.md`
- Ledger progres SDD: `.superpowers/sdd/progress.md`

### Ringkasan Perubahan
- `tests/setup.ts` — polyfill `ResizeObserver` untuk jsdom (dibutuhkan `SignaturePad` & `PaktaDocumentPreview`).
- `src/lib/pdfRenderer.ts` — `browserTextWidth` diekspor (sebelumnya private) supaya bisa dipakai ulang oleh preview browser, identik dengan pengukuran teks di PDF akhir.
- `src/lib/paktaPreviewLayout.ts` (baru) — fungsi murni: `computeScale`, `computeSignatureBox` (dengan `MIN_SIGNATURE_HEIGHT = 140` — klem ukuran minimum kotak TTD di layar sempit, keputusan UX dari diskusi user soal ergonomi mobile), `fitFontSizeCss`.
- `src/components/pakta-signer/SignaturePad.tsx` — mode "embedded": prop `transparent`, `hideClearButton`, `onStrokeBegin` (fire di SETIAP stroke baru, bukan cuma pertama kali — lihat catatan bug di bawah), `style`. Default tetap perilaku lama (dipakai standalone di path fallback).
- `src/components/pakta-signer/PaktaDocumentPreview.tsx` (baru) — komponen inti: render `<img>` background + field terisi (posisi presisi via scale) + kotak TTD interaktif (SignaturePad transparan + hint dashed "Tanda tangan di sini" + tombol Hapus di pojok kotak). `formatter` field (uppercase) sengaja tidak diterapkan — parity dengan `pdfRenderer.ts` yang juga mengabaikannya untuk Pakta.
- `src/components/pakta-signer/PaktaSignPage.tsx` — step `signing` diganti total: kartu ringkasan teks + kotak TTD terpisah → `PaktaDocumentPreview`. Fallback ke `SignaturePad` standalone bila template belum punya field `tandaTangan`. `handleSubmit` tidak diubah.

### Bug ditemukan & diperbaiki selama proses
1. **Task 4, ronde review 1→3:** `pad.addEventListener('beginStroke', ..., { once: true })` di draft awal berarti hint TTD cuma bisa hilang SEKALI seumur hidup komponen — setelah "Hapus Tanda Tangan" lalu menggambar ulang, hint tidak akan hilang lagi. Ditemukan reviewer, diperbaiki (hapus `{ once: true }`). Fix pertama lolos tapi test pembuktinya ternyata tidak benar-benar menguji perilaku (mock `signature_pad` mengabaikan opsi `once`) — reviewer menangkap ini juga, jadi ada ronde fix ke-2 yang membuat mock benar-benar menghormati semantik `once` (dibuktikan dengan sanity-check manual: reintroduce bug → test gagal, revert fix → test lolos).
2. **Task 7, manual browser verification:** teks field panjang (mis. jabatan) pecah ke baris kedua di layar sempit alih-alih tetap satu baris dan mengecil — `fitFontSizeCss` menghitung ukuran font yang pas, tapi tanpa `white-space: nowrap` browser tetap bisa wrap karena selisih sub-pixel antara pengukuran canvas vs layout DOM. PDF akhir selalu satu baris, jadi ini pecah paritas visual. Diperbaiki: `white-space: nowrap` pada teks + `overflow: hidden` pada wrapper sebagai pengaman (commit `fc1ebbc`).

### Verifikasi manual yang sudah dilakukan
Karena tidak ada `.env` Supabase di worktree ini (hanya `.env.example`), verifikasi end-to-end dengan data Supabase asli TIDAK BISA dilakukan di sini. Sebagai gantinya, dilakukan verifikasi visual lewat harness sementara (`src/main.tsx` di-override sementara untuk me-render `PaktaDocumentPreview` langsung dengan data fixture, lalu dikembalikan via `git checkout` — tidak ada jejak di working tree) memakai `preview_*` tools:
- ✅ Dokumen penuh dengan field jabatan/namaNip terisi tampil presisi.
- ✅ Kotak TTD dengan hint dashed "Tanda tangan di sini" sebelum digambar.
- ✅ Klem `MIN_SIGNATURE_HEIGHT` terbukti bekerja di browser sungguhan: viewport mobile 375px, field TTD kecil yang secara matematis akan jadi ±54px tinggi, tetap dijaga 140px persis (dikonfirmasi lewat `getBoundingClientRect()`).
- ✅ Menggambar (via `PointerEvent` sintetis) → hint hilang, tombol "Hapus Tanda Tangan" muncul di pojok kotak.
- ✅ Klik "Hapus Tanda Tangan" → kanvas kosong, hint muncul lagi.
- ✅ Menggambar lagi setelah hapus → hint hilang lagi (membuktikan fix bug #1 bekerja end-to-end, bukan cuma di unit test).

**Belum diverifikasi:** alur signing end-to-end dengan Supabase asli (pilih nama dari daftar, submit, upload PDF, download) — perlu `.env` terisi kredensial Supabase yang valid dan event/signer nyata di database. Juga belum diverifikasi visual di desktop width penuh dengan template asli (hanya diuji dengan template fixture buatan sendiri).

### Commands Run
```
npm install
npm run build   # tsc -b && vite build — PASS
npx vitest run  # 22 files, 136/136 tests — PASS
```
**Catatan jujur:** tidak ada script `lint` di `package.json` (project-wide, bukan spesifik perubahan ini) — `npm run lint` yang disebut di finish protocol AGENTS.md tidak bisa dijalankan karena scriptnya tidak ada. Ini bukan sesuatu yang saya perbaiki (di luar scope fitur ini) — perlu keputusan user apakah mau ditambahkan.

### Known Issues
- Verifikasi Supabase end-to-end belum bisa dilakukan di worktree ini (lihat di atas) — sangat disarankan dites manual sekali lagi di environment dengan `.env` terisi sebelum merge ke `main`.
- Tidak ada script `lint` di project (pre-existing, di luar scope).
- Bundle JS utama >2MB setelah build (warning dari Vite, pre-existing, tidak terkait perubahan ini).

### Next Step
1. User me-review perubahan (atau minta code review lewat `/code-review`).
2. Task-per-task sudah dikomit oleh subagent selama eksekusi plan (lihat `git log` untuk daftar commit dari `6ae1ba9` sampai `fc1ebbc`), jadi working tree sudah bersih; tidak ada langkah commit tambahan yang tertunda untuk kode.
3. Push branch & buat PR hanya setelah user eksplisit minta.
4. Sebelum atau sesudah merge: uji manual sekali dengan Supabase environment nyata (pilih nama, tanda tangan, submit, download PDF) untuk menutup gap verifikasi di atas.
