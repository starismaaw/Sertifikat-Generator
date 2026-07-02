## Agent Handoff

**Branch:** `claude/gallant-lovelace-b6d0ac`
**Task:** Slug custom untuk link tanda tangan Pakta Integritas — user melapor link tanda tangan per-kegiatan tidak human-readable (UUID mentah), minta bisa di-custom admin.
**Last agent:** Claude Sonnet 5 (Claude Code), via context7 research → brainstorming → writing-plans → subagent-driven-development
**Status:** SELESAI. Task 1-8 dari plan selesai + semua review task bersih. Final whole-branch review: **Ready to merge: Yes** (round 1 menemukan 1 bug Important lintas-task — lihat di bawah — diperbaiki, round 2 approved). Build ✅, test 113/113 ✅ (dikonfirmasi ulang independen oleh controller setelah fix terakhir), manual browser verification admin-side ✅ (mocked fetch). Menunggu approval user untuk push/PR/merge. **Migration SQL belum dijalankan di Supabase produksi** — itu tindakan manual user, WAJIB sebelum fitur ini berfungsi.

### Referensi
- Spec: `docs/superpowers/specs/2026-07-02-pakta-link-slug-design.md`
- Plan: `docs/superpowers/plans/2026-07-02-pakta-link-slug.md`
- Ledger progres SDD: `.superpowers/sdd/progress.md` (bagian "Pakta Link Slug")

### Latar Belakang
User: "pada Link Tanda Tangan unik untuk user/pegawai saat ini link nya tidak human-readable, terlalu unik. Apakah bisa di buat custom oleh admin?"

Riset kode (sebelum brainstorming) menemukan link Pakta Integritas sebenarnya **per-kegiatan (event)**, bukan per-pegawai — semua pegawai memakai URL yang sama (`#pakta/{eventId}`, UUID mentah dari `gen_random_uuid()`), lalu memilih nama dari dropdown. Klarifikasi dengan user mengonfirmasi scope: tetap SATU link per kegiatan (bukan link individual per pegawai), tapi bagian identifier di URL bisa diganti admin jadi teks yang mudah dibaca.

Keputusan desain kunci (dari brainstorming): slug otomatis dibuat dari nama kegiatan saat dibuat, admin bisa edit kapan saja inline di dashboard; kegiatan lama otomatis dapat slug lewat migration (link UUID lama berhenti berfungsi setelahnya); mengubah slug langsung mematikan slug lama (tanpa redirect).

### Ringkasan Perubahan
- `supabase/migrations/0002_pakta_event_slug.sql` (baru) — tambah kolom `slug` (unique, format-terbatas), backfill kegiatan lama dari nama (dengan disambiguasi `-2`/`-3` untuk nama kembar, fallback untuk nama terlalu pendek/panjang). **Belum dijalankan di produksi.**
- `src/lib/slug.ts` (baru) — `slugify()` (server-side auto-generate) dan `isValidSlug()` (validasi format, dipakai server+client).
- `api/pakta-admin.ts` — `create_event` auto-generate slug dari nama dengan retry-on-collision (`-2`, `-3`, dst, maks 30 percobaan); `update_event` validasi format + terjemahkan konflik unique-constraint Postgres jadi pesan "Slug ini sudah dipakai kegiatan lain".
- `src/lib/paktaStore.ts` — `getAcaraPakta(id)` → `getAcaraByLink(slug)`, query `.eq('slug', ...)` bukan `.eq('id', ...)`.
- `src/components/pakta-signer/PaktaSignPage.tsx` — prop `eventId` → `slug`; resolve slug ke event asli (dapat UUID asli) dulu, baru query daftar signer & kirim `get_pdf_upload_url` pakai UUID asli (bukan slug).
- `src/components/pakta-admin/PaktaDashboard.tsx` — link/QR dibangun dari `event.slug`; UI edit inline di kartu "Link Tanda Tangan" (tombol Ubah → input+validasi realtime → Simpan/Batal).
- `src/App.tsx` / `src/components/AppRouter.tsx` — wiring prop `slug` + komentar penjelas (routing struktural tidak berubah).

### Files Changed
- `supabase/migrations/0002_pakta_event_slug.sql` (baru, tidak dijalankan)
- `src/lib/slug.ts` (baru)
- `api/pakta-admin.ts`
- `src/lib/paktaStore.ts`
- `src/components/pakta-signer/PaktaSignPage.tsx`
- `src/components/pakta-admin/PaktaDashboard.tsx`
- `src/App.tsx`
- `src/components/AppRouter.tsx`
- `tests/slug.test.ts` (baru)
- `tests/paktaAdmin.test.ts`
- `tests/paktaStore.test.ts`

### Commands Run
- `npm run test` — ✅ 112/112 pass (19 file test, termasuk `tests/slug.test.ts` baru). Stderr noise dari `HTMLCanvasElement.getContext` pre-existing (jsdom), tidak terkait sesi ini.
- `npm run build` — ✅ 0 error. Warning chunk >500kB pre-existing.
- `npm run lint` — N/A, tidak ada script lint di proyek ini.
- `npx tsc -b` — ✅ 0 error di seluruh project (bukan `tsc -b --noEmit`, yang gagal karena ketidakcocokan flag pre-existing dengan tsconfig composite — sudah didokumentasikan di sesi Landing Hub sebelumnya).
- Manual browser verification (preview tool, mocked `window.fetch` untuk `/api/pakta-admin` — tidak ada kredensial Supabase di sandbox ini):
  - Login admin (mocked) → dashboard kegiatan mocked → kartu "Link Tanda Tangan" menampilkan `#pakta/pelatihan-juli-2026` (slug, bukan UUID) ✅
  - Klik "Ubah" → input inline muncul terisi slug saat ini, tombol Simpan/Batal ✅
  - Ketik slug format salah ("Ada Spasi Besar!") → Simpan → error inline "Slug harus huruf kecil, angka, dan tanda hubung saja (3-60 karakter)", TIDAK ada network call (validasi client-side blokir sebelum submit) ✅
  - Ketik slug valid baru ("pelatihan-agustus-2026") → Simpan → link & QR code di kartu berubah, keluar dari mode edit ✅
  - Ketik slug yang di-mock sebagai "sudah dipakai" → Simpan → error inline "Slug ini sudah dipakai kegiatan lain" (409 dari mock), input TIDAK hilang, tombol Simpan/Batal TIDAK stuck-disabled, link lama TIDAK berubah ✅
  - Tidak ada console error di sepanjang alur ini.
  - **Halaman publik** (`PaktaSignPage`, alur pegawai buka link) TIDAK bisa diverifikasi live browser end-to-end di sandbox ini — tidak ada file `.env` (tidak ada `VITE_SUPABASE_URL`), jadi panggilan Supabase asli hang tanpa respons (bukan bug dari perubahan ini — perilaku sama akan terjadi dengan lookup UUID lama juga). Logika resolve-slug-lalu-query-signer sudah diverifikasi lewat unit test (`tests/paktaStore.test.ts`, memastikan query pakai kolom `slug`) dan code review manual (Task 5, trace lengkap alur `getAcaraByLink` → `listSigners(template.eventId)` → `get_pdf_upload_url` pakai UUID asli).

### Validation
- Build: ✅ PASS
- Lint: N/A (tidak ada script lint di proyek ini)
- Test: ✅ 112/112 PASS

### Proses Eksekusi
Subagent-Driven Development, 7 task implementasi + 1 task verifikasi:
- Task 1 (migration SQL) — implementer haiku, reviewer sonnet. **Round 1: Needs fixes** — reviewer menemukan bug Important: nama kegiatan pendek (mis. "AB") menghasilkan slug 2 karakter yang melanggar CHECK constraint `length(slug) between 3 and 60` yang ditambahkan migration yang sama, membuat migration gagal di produksi. Controller juga menemukan risiko serupa untuk nama sangat panjang (tidak ada batas atas). Fix subagent memperbaiki backfill CTE (fallback 'acara' untuk nama <3 karakter, potong ke 55 karakter untuk nama panjang). **Round 2: Approved**, kedua bug diverifikasi benar-benar teratasi lewat trace manual independen.
- Task 2 (slug.ts utility) — implementer haiku, reviewer sonnet, Approved (3 catatan Minor soal cakupan test).
- Task 3 (api/pakta-admin.ts) — implementer haiku, reviewer sonnet, Approved (2 catatan Minor).
- Task 4 (paktaStore.ts) — implementer haiku, reviewer sonnet, Approved (1 catatan Minor).
- Task 5 (PaktaSignPage.tsx) — implementer haiku, reviewer sonnet, Approved (0 catatan).
- Task 6 (PaktaDashboard.tsx, task terbesar) — implementer haiku, reviewer sonnet, Approved (2 catatan Minor).
- Task 7 (wiring App.tsx/AppRouter.tsx) — implementer haiku, reviewer sonnet, Approved (0 catatan), diverifikasi independen `tsc -b` bersih.
- Task 8 (full suite/build/manual verification) — dikerjakan langsung controller.
- **Final whole-branch review** (model Opus, dispatch terpisah dari 8 task di atas) — **Round 1: Needs fixes**. Menemukan 1 bug Important **lintas-task** yang tidak terlihat oleh review per-task manapun: migration (Task 1) sudah menangani nama pendek/panjang dengan aman, tapi jalur runtime `create_event` (Task 3) TIDAK meniru pengamanan yang sama — nama seperti "K3" atau "PI" (singkatan umum instansi pemerintah, "PI" bahkan singkatan dari "Pakta Integritas" itu sendiri) akan menghasilkan slug 2 karakter yang melanggar CHECK constraint, membuat pembuatan acara gagal dengan error 500 yang membingungkan. Fix subagent menyamakan logika clamp `create_event` persis dengan migration (fallback 'acara' untuk <3 karakter, potong ke 55 karakter) + tambah test regresi. **Round 2: Ready to merge: Yes**, fix diverifikasi benar lewat trace independen (`"K3"` → fallback 'acara'; `"Pakta Baru"` → tidak berubah, tidak ada regresi), tidak ada temuan baru.

Tidak ada Critical/Important yang belum diperbaiki — baik di 7 task review maupun final whole-branch review (setelah fix round 2). Test suite dikonfirmasi ulang independen oleh controller: 113/113 pass.

Ledger progres lengkap: `.superpowers/sdd/progress.md` (bagian "Pakta Link Slug — SDD Progress Ledger").

Commit (urutan kronologis, base `af1f96b`):
1. `58cbaa7` — feat(pakta): add slug column migration for custom signing links (not executed)
2. `8cc9e2e` — fix(pakta): handle short and overlong names in slug backfill migration
3. `b8c39a6` — feat(pakta): add slugify/isValidSlug utility for custom signing links
4. `b28b83d` — feat(pakta): auto-generate unique slug on create, validate + map conflicts on update
5. `c694a9e` — feat(pakta): look up public event by slug instead of UUID
6. `55ea30b` — feat(pakta): resolve public signer page by slug, use real UUID downstream
7. `af84271` — feat(pakta): show slug-based public link, add inline slug editing
8. `1665db8` — feat(pakta): wire slug prop from router into PaktaSignPage
9. `652f9a6` — fix(pakta): clamp auto-generated slug length in create_event to satisfy DB constraint (dari final whole-branch review round 1)

(Base untuk fitur ini: `af1f96b`, commit terakhir sebelum implementasi dimulai — juga commit "docs: tambah spec, plan, dan handoff untuk Landing Hub" dari sesi sebelumnya.)

### Known Issues
- **Migration SQL belum dijalankan di Supabase produksi** — `supabase/migrations/0002_pakta_event_slug.sql` sudah ditulis dan direview (termasuk 1 putaran fix), tapi TIDAK dieksekusi oleh agent (sesuai aturan proyek soal database produksi). User perlu menjalankannya manual di Supabase SQL Editor SEBELUM fitur ini berfungsi — sebelum migration dijalankan, kolom `slug` tidak ada di database, jadi kode baru yang query `.eq('slug', ...)` akan gagal.
- Halaman publik (`PaktaSignPage`) tidak bisa diverifikasi end-to-end lewat browser sungguhan di sandbox ini (tidak ada `.env`/kredensial Supabase) — lihat detail di Commands Run.
- `PaktaSignPage.tsx` dan `PaktaDashboard.tsx` tidak punya test otomatis (keputusan eksplisit di plan — kedua file menarik context Supabase-backed yang membuat unit test tidak proporsional) — diverifikasi lewat `tsc` + manual browser (dashboard) dan code review (signer page).
- Minor (dari final review, tidak di-fix, tidak mendesak): batas 3 karakter dan pemotongan 55 karakter terduplikasi di tiga tempat (`api/pakta-admin.ts`, `src/lib/slug.ts`, migration SQL) — konstanta bersama bisa mengurangi risiko drift di masa depan, tapi bukan bug.

### Next Step
1. Minta approval user untuk push branch dan buat PR baru (semua review sudah bersih, siap merge).
2. **Sebelum atau segera setelah merge:** user WAJIB menjalankan `supabase/migrations/0002_pakta_event_slug.sql` manual di Supabase SQL Editor produksi — fitur ini tidak akan berfungsi tanpa migration ini (kolom `slug` belum ada).
3. Setelah migration jalan: user disarankan mencoba alur lengkap di kegiatan sungguhan (buat kegiatan baru → cek slug otomatis → ubah slug → buka link baru sebagai pegawai → tanda tangan) untuk konfirmasi end-to-end yang tidak bisa diuji di sandbox ini.
