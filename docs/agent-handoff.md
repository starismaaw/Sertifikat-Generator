## Agent Handoff

**Branch:** `claude/strange-solomon-2916d0`
**Task:** Fix — zona tanda tangan di editor template tidak sama dengan hasil render PDF
**Last agent:** Claude Sonnet 5 (Claude Code)
**Status:** COMPLETE — build ✅, test 68/68 ✅, diverifikasi visual di preview

### Root Cause
`EditorCanvas.tsx` menghitung tinggi kotak zona field selalu dari `field.ukuran * scale * 1.4` (ukuran font, dipakai untuk field teks). Untuk field `tandaTangan`, `pdfRenderer.ts` (`renderPakta`) justru menggambar gambar tanda tangan dengan `width = field.lebar, height = field.tinggi`. Karena `tinggi` (default ≈ `bgWidth*0.6*0.4`) jauh lebih besar dari `ukuran*1.4` (default ≈ `bgHeight*0.04*1.4`), kotak yang terlihat di editor jauh lebih kecil dari zona sebenarnya — sehingga hasil tanda tangan yang dirender ke PDF melenceng jauh keluar dari posisi yang terlihat di editor.

### Files Changed
- `src/components/editor/EditorCanvas.tsx` — zona field `tandaTangan` sekarang pakai `field.tinggi` (fallback `lebar/2`, sama seperti `pdfRenderer.ts`) sebagai tinggi kotak, bukan `ukuran*1.4`. Field teks lain tidak berubah.

### Commands Run
- `npm install` (node_modules belum ter-install di worktree ini)
- `npm run build` — ✅ 0 error
- `npm run test` — ✅ 68/68 pass (13 file test)
- Tidak ada script `npm run lint` di package.json (tidak tersedia di proyek ini)
- Verifikasi manual: mount `EditorCanvas` dengan data sintetis (field `tandaTangan` tinggi=150 vs field teks ukuran=28) via preview browser — kotak zona tanda tangan terlihat jauh lebih tinggi dan proporsional terhadap `tinggi`, sesuai dengan yang digambar `renderPakta`.

### Validation
- Build: ✅ PASS
- Lint: N/A (tidak ada script lint)
- Test: ✅ 68/68 PASS

### Known Issues
- Tidak ada `.env` di worktree ini (VITE_SUPABASE_URL/ANON_KEY kosong) sehingga editor Pakta/Sertifikat sungguhan (dengan data Supabase asli) tidak bisa dibuka end-to-end di preview lokal; verifikasi dilakukan dengan me-mount komponen `EditorCanvas` langsung memakai data event sintetis.

### Next Step
- User disarankan membuka editor Pakta Integritas asli (dengan template & field tanda tangan yang sudah ada) dan mengonfirmasi kotak zona di editor kini match dengan hasil PDF setelah tanda tangan.
- Belum di-commit/push — menunggu approval user.
