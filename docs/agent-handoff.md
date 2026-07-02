## Agent Handoff

**Branch:** `claude/gallant-lovelace-b6d0ac`
**Task:** Redesain halaman awal jadi Landing Hub netral (2 kartu setara: Sertifikat Generator & Pakta Integritas) — user melapor halaman awal membingungkan, tidak jelas mana menu ke Sertifikat Generator dan mana ke Pakta Integritas.
**Last agent:** Claude Sonnet 5 (Claude Code), via brainstorming → writing-plans → subagent-driven-development
**Status:** Task 1-6 dari plan selesai + semua review task bersih (0 Critical/Important di semua 5 task). Build ✅, test 97/97 ✅, manual browser verification ✅ (desktop + mobile). Final whole-branch review BELUM dijalankan. Menunggu approval user untuk push/PR/merge.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-02-landing-hub-design.md`
- Plan: `docs/superpowers/plans/2026-07-02-landing-hub.md`
- Ledger progres SDD: `.superpowers/sdd/progress.md`

### Latar Belakang
User: "Halaman awal aplikasi terlihat membingungkan, belum terlihat jelas mana menu untuk menuju ke sertifikat generator dan mana menu untuk ke pakta integritas." Audit menemukan halaman `home` sebelumnya langsung merender daftar kegiatan sertifikat (`EventList`), dengan tombol "Pakta Integritas" ditaruh sebagai pill kecil sejajar tombol aksi biasa — tidak ada isyarat visual bahwa itu pintu masuk ke modul terpisah (dengan sistem login admin sendiri).

Brainstorming dengan user menghasilkan 3 opsi (hub netral / hub+shortcut terakhir dibuka / sidebar app-switcher permanen). User memilih **hub netral** — dua kartu besar setara, isi kartu **ikon + nama saja** (tanpa deskripsi/statistik, preferensi eksplisit user untuk minimalis).

### Ringkasan Perubahan
- `src/components/AppRouter.tsx` — tambah view `{ name: 'sertifikat' }` (hash `#sertifikat`); `parseHash` diekspor (sebelumnya privat) supaya unit-testable.
- `src/components/Hub.tsx` (baru) — 2 kartu `<button>` asli (bukan `div onClick`, untuk aksesibilitas keyboard/screen-reader native): "Sertifikat Generator" → `navigate({name:'sertifikat'})`, "Pakta Integritas" → `navigate({name:'pakta-admin'})`. Styling reuse token `sg-*`/`apple-design.css` yang sudah ada (tidak ada bahasa desain baru).
- `src/components/AppTopbar.tsx` — logo "S" diubah dari `<div>` statis jadi `<button aria-label="Beranda">` yang navigasi ke Hub (pola standar "klik logo = pulang ke beranda").
- `src/App.tsx` — `view.name==='home'` sekarang render `<Hub/>` (bukan lagi `EventList`), `view.name==='sertifikat'` render `<EventList/>`. Breadcrumb diperluas: alur sertifikat sekarang `Beranda → Sertifikat Generator → [nama kegiatan] → ...` (sebelumnya langsung `Beranda → [nama kegiatan]`); alur Pakta Integritas TIDAK berubah.
- `src/components/EventList.tsx` — tombol "Pakta Integritas" dihapus (sudah redundan, jalur ke modul itu sekarang lewat Hub/breadcrumb).

### Files Changed
- `src/components/AppRouter.tsx`
- `src/components/Hub.tsx` (baru)
- `src/components/AppTopbar.tsx`
- `src/App.tsx`
- `src/components/EventList.tsx`
- `src/styles/apple-design.css`
- `tests/appRouter.test.ts` (baru)
- `tests/Hub.test.tsx` (baru — component test pertama di repo ini yang pakai `@testing-library/react`)
- `tests/AppTopbar.test.tsx` (baru)

### Commands Run
- `npm run test` — ✅ 97/97 pass (18 file test, termasuk 3 file baru). Ada stderr noise dari `HTMLCanvasElement.getContext` di `tests/pdfRenderer.test.ts` — pre-existing (jsdom tidak implementasi canvas), TIDAK terkait perubahan sesi ini, test tetap PASS.
- `npm run build` — ✅ 0 error. Ada warning ukuran chunk >500kB — pre-existing, bundle sudah besar sebelum perubahan ini.
- `npm run lint` — **tidak ada script lint di package.json ini** (bukan gap dari sesi ini, sudah begitu sejak awal).
- `npx tsc -b --noEmit` — gagal dengan `TS6310` (composite project + `--noEmit` tidak kompatibel dengan referenced project `tsconfig.node.json`) — **ini bukan bug dari perubahan sesi ini**, murni ketidakcocokan command dengan struktur tsconfig repo ini. Verifikasi type-check sesungguhnya pakai `npx tsc -b` (persis command yang dipakai `npm run build`) — ✅ 0 error.
- Manual browser verification (preview tool, bukan Bash): Hub tampil 2 kartu di desktop & mobile (375×812, stack vertikal tanpa overlap) → klik kartu Sertifikat Generator masuk ke daftar kegiatan dengan breadcrumb `Beranda → Sertifikat Generator` → klik "Beranda" di breadcrumb kembali ke Hub → klik kartu Pakta Integritas masuk ke halaman login admin dengan breadcrumb `Beranda → Pakta Integritas`, tidak overlap di mobile → kartu Hub bisa di-fokus via keyboard (native `<button>`) → tidak ada console error.

### Validation
- Build: ✅ PASS
- Lint: N/A (tidak ada script lint di proyek ini)
- Test: ✅ 97/97 PASS

### Proses Eksekusi
Subagent-Driven Development, 5 task implementasi + 1 task verifikasi:
- Task 1 (router) — implementer model haiku, reviewer model sonnet, Approved (1 catatan Minor kosmetik).
- Task 2 (Hub.tsx + CSS) — implementer haiku, reviewer sonnet, Approved (1 catatan Minor kosmetik).
- Task 3 (topbar logo) — implementer haiku, reviewer sonnet, Approved (2 catatan Minor).
- Task 4 (wiring App.tsx + breadcrumb) — implementer haiku, reviewer sonnet, Approved (1 catatan Minor soal command tsc, sudah diverifikasi controller — bukan bug nyata).
- Task 5 (hapus tombol lama EventList) — implementer haiku, reviewer sonnet, Approved (0 catatan).
- Task 6 (full suite/build/lint/manual verification) — dikerjakan langsung oleh controller (bukan subagent, karena tidak ada perubahan kode untuk didelegasikan).

Tidak ada Critical/Important di seluruh 5 task review. Final whole-branch review (dispatch terpisah, model paling capable) BELUM dijalankan — ini next step sebelum PR.

Ledger progres lengkap: `.superpowers/sdd/progress.md`.

Commit (urutan kronologis):
1. `830de31` — feat(router): add sertifikat view for the landing hub redesign
2. `37d7fb5` — feat(hub): add Landing Hub component with Sertifikat/Pakta cards
3. `4bff1a6` — feat(topbar): make logo a button that navigates to the hub
4. `34a96f2` — feat(app): render Hub on home and move EventList to the sertifikat view
5. `35b5a60` — chore(event-list): remove Pakta Integritas button, now handled by the Hub

(Base untuk fitur ini: `b46dd81`, tip `main` sebelum implementasi dimulai — juga tip cabang ini sebelum Task 1.)

### Known Issues
- Bookmark/link lama ke root (`#` kosong) sekarang mendarat di Hub, bukan langsung ke daftar sertifikat — perubahan perilaku yang disengaja (tujuan redesign), bukan regresi, sudah didokumentasikan di spec bagian "Non-Tujuan/Perilaku Baru".
- Belum ada test otomatis untuk `App.tsx` (breadcrumb wiring) dan `EventList.tsx` (penghapusan tombol) — sesuai keputusan eksplisit di plan, karena `App.tsx` menarik context Supabase-backed yang membuat unit test tidak proporsional untuk perubahan sekecil ini. Diverifikasi manual lewat browser preview (lihat Commands Run di atas).
- `npx tsc -b --noEmit` (command yang awalnya ditulis di plan Task 4 sebagai verifikasi) tidak bisa dijalankan di repo ini karena error `TS6310` yang sudah ada sebelum sesi ini (bukan disebabkan perubahan Landing Hub) — dicatat di sini supaya agent berikutnya tidak salah kira ini bug baru.
- Belum ada final whole-branch code review (langkah terakhir sebelum PR menurut proses subagent-driven-development).

### Next Step
1. Dispatch final whole-branch code review (model paling capable) atas diff penuh `b46dd81..HEAD`.
2. Kalau review bersih atau temuan sudah diperbaiki: minta approval user untuk push branch dan buat PR baru.
3. Setelah PR & merge: user disarankan mengecek tampilan Hub di perangkat mobile sungguhan (bukan cuma viewport emulasi) untuk konfirmasi visual akhir.
