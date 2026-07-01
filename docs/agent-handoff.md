## Agent Handoff

**Branch:** `claude/quizzical-elbakyan-b7f94e`
**Task:** Perbaiki halaman publik pemilihan nama (link tanda tangan Pakta Integritas) — fix overlap NIP di mobile, tambah fitur cari nama, batasi tinggi daftar
**Last agent:** Claude Sonnet 5 (Claude Code), via brainstorming → writing-plans → subagent-driven-development
**Status:** COMPLETE (Task 1-4 dari plan selesai + review bersih) — build ✅, test 83/83 ✅, review akhir Opus: "Ready to merge: Yes". Menunggu approval user untuk push/PR/merge.

### Catatan penting soal branch ini

Branch `claude/quizzical-elbakyan-b7f94e` sebelumnya sudah dipakai untuk fitur SemiBold font weight (lihat commit `785041e`..`d1b2d9a`), yang sudah di-merge ke `main` lewat [PR #23](https://github.com/starismaaw/Sertifikat-Generator/pull/23). Worktree ini melanjutkan memakai nama branch yang sama untuk fitur baru ini — jadi kalau membaca `git log` di branch ini, 6 commit SemiBold di awal riwayat BUKAN bagian dari fitur ini, itu riwayat lama yang sudah shipped. Base yang benar untuk fitur ini adalah `origin/main` di commit `9cd65d1` (tip main setelah PR #23 merge), bukan local `main` yang stale (`110d8a3`) atau `HEAD~1`.

Local `main` ref di worktree ini TIDAK up to date dengan `origin/main` — jangan pakai `git merge-base main HEAD` untuk fitur berikutnya di branch ini tanpa `git fetch origin` dulu.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-01-pakta-signer-name-list-design.md`
- Plan: `docs/superpowers/plans/2026-07-01-pakta-signer-name-list.md`

### Latar Belakang
User melaporkan 3 masalah di halaman publik `/#pakta/<eventId>` (step `pickName` di `PaktaSignPage.tsx`): (1) daftar peserta terlalu panjang ke bawah tanpa fitur cari, (2) angka NIP overlap dengan nama di mobile. Root cause overlap: `.apple-btn` (dipakai sebagai pil nama+NIP) punya `white-space: nowrap` dalam flex-row satu baris — nama panjang mendorong NIP keluar batas pil di layar sempit.

### Ringkasan Perubahan
- `src/lib/signerFilter.ts` (baru) — fungsi murni `matchesSignerQuery(nama, query)`: case-insensitive substring match, query kosong/whitespace = match semua.
- `src/styles/apple-design.css` — tambah 6 class baru (append-only, tidak mengubah rule lama): `.sg-signer-item` (item dua-baris, flex-column — struktural tidak bisa overlap di lebar layar berapa pun), `.sg-signer-item-nama`, `.sg-signer-item-nip`, `.sg-signer-item-done`, `.sg-signer-toggle`, `.sg-signer-list-scroll` (max-height 400px + scroll).
- `src/components/pakta-signer/PaktaSignPage.tsx` — step `pickName` diganti total: search box (state `query`), grup "Sudah menandatangani" jadi collapsed-by-default dengan toggle (state `showSudah`), daftar "Belum" dibungkus scroll container, `totalBelum`/`totalSudah` dihitung dari `signers` mentah (bukan hasil filter) supaya angka di judul stabil saat mengetik.
- Step lain (`loading`, `notFound`, `signing`, `submitting`, `success`, `error`), `listSigners`/`getAcaraPakta`, dan dashboard admin — tidak disentuh, sesuai spec bagian "Hal yang Tidak Berubah".

### Files Changed
- `src/lib/signerFilter.ts` (baru)
- `tests/signerFilter.test.ts` (baru)
- `src/styles/apple-design.css`
- `src/components/pakta-signer/PaktaSignPage.tsx`

### Commands Run
- `npx vitest run` — ✅ 83/83 pass (15 file test, naik dari 78 sebelum fitur ini)
- `npm run build` — ✅ 0 error
- Tidak ada script `npm run lint` di `package.json`
- Verifikasi manual: TIDAK bisa lewat browser dengan data Supabase asli (tidak ada password admin pakta di sesi ini, tidak ada acara pakta dengan peserta yang bisa diakses untuk uji publik). Sebagai gantinya, controller menulis test render komponen sementara (`@testing-library/react`, mocking `paktaStore`) untuk memverifikasi DOM sungguhan: layout dua-baris (nama & NIP jadi `<span>` terpisah dengan class benar), search substring/case-insensitive dengan angka header stabil, pesan "tidak ada hasil", dan toggle grup "Sudah" default tertutup lalu expand/collapse. File test tersebut dihapus setelah dipakai — **bukan bagian dari deliverable plan**, murni verifikasi controller. Fix overlap NIP sendiri terverifikasi struktural lewat CSS (`flex-direction: column` tidak bisa overlap di lebar berapa pun, beda dari bug lama yang pakai `white-space: nowrap` dalam flex-row).

### Validation
- Build: ✅ PASS
- Lint: N/A (tidak ada script lint)
- Test: ✅ 83/83 PASS

### Proses Eksekusi (Subagent-Driven Development)
Task 1-3 dikerjakan oleh implementer subagent (fresh context per task; Task 1 & 2 model haiku karena brief berisi kode lengkap, Task 3 model sonnet karena integrasi 3 edit ke satu file besar) + task reviewer subagent (model sonnet), semua lolos review "Approved" tanpa temuan Critical/Important. Task 4 (verifikasi manual, tidak bisa dilakukan implementer/reviewer karena butuh browser) dikerjakan langsung oleh controller. Final whole-branch review dijalankan model Opus: "Ready to merge: Yes". Ledger progres di `.superpowers/sdd/progress.md` (git-ignored, lokal ke worktree ini).

Commit per task:
1. `68a0b2d` — tambah fungsi filter nama peserta
2. `45d19f0` — tambah CSS item peserta dua-baris, toggle, scroll container
3. `8e85a66` — tambah search, layout dua-baris, toggle sudah-TTD, scroll container

(Base untuk fitur ini: `9cd65d1`, commit docs terakhir sebelum implementasi dimulai.)

### Known Issues
- Task reviewer (Minor, tidak blocking, konsisten dengan pola lama di file yang sama): `belum`/`sudah`/`totalBelum`/`totalSudah` masing-masing memanggil `signers.filter(...)` sendiri-sendiri (4 scan per render) alih-alih satu scan yang digunakan ulang. Ini pola yang sudah ditentukan verbatim di plan, bukan keputusan implementer.
- Fix overlap NIP di mobile TIDAK diverifikasi dengan data Supabase riil di viewport asli — hanya diverifikasi struktural (CSS `flex-direction: column`) dan lewat DOM assertion di test komponen sementara. Kalau ingin verifikasi visual 100% end-to-end, perlu password admin pakta + acara dengan peserta ber-NIP panjang di viewport mobile sungguhan.

### Next Step
- Menunggu approval user untuk push branch dan buat PR baru (branch ini sudah pernah di-PR-kan sekali untuk fitur SemiBold dan sudah di-merge — PR baru diperlukan untuk fitur ini).
- Setelah user approve dan PR dibuat: user disarankan mencoba search & toggle di halaman `/#pakta/<eventId>` sungguhan, dan cek tampilan di HP asli untuk konfirmasi visual fix overlap NIP.
