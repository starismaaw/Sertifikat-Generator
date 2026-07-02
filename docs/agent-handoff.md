## Agent Handoff

**Branch:** `claude/sharp-chaum-8bf41f`
**Task:** Dua bug laporan user di halaman signing Pakta Integritas versi mobile: (1) kotak tanda tangan melebar sangat jauh dari field template, (2) tombol overlay "Hapus Tanda Tangan" menutupi hasil preview tanda tangan.
**Last agent:** Claude Sonnet 5 (Claude Code), via skill `systematic-debugging`
**Status:** SELESAI. Root cause diinvestigasi & diperbaiki untuk kedua bug. Build ✅, test 139/139 ✅. Verifikasi visual manual di browser (mobile viewport 375px) via harness sementara (tidak dikomit — direvert dengan `git checkout` setelah verifikasi). **Belum di-push/PR/merge** — menunggu instruksi eksplisit user.

### Root cause (bug 1 — kotak TTD melebar jauh dari field template)
Ini adalah patch ke-5 berturut-turut di logic yang sama (`930cad9` → `0d93a71` → `6aea5f2` → `9c31d31` → `6dd2e6b`), masing-masing memperbaiki satu gejala tapi memunculkan gejala lain — pola klasik "growFactor bersama untuk lebar & tinggi" yang saling tarik-menarik. Root cause: `computeSignatureBox` (di `src/lib/paktaPreviewLayout.ts`) menghitung `heightGrowFactor` dari kebutuhan tinggi minimum (`MIN_SIGNATURE_HEIGHT=140px`), lalu memakai faktor yang SAMA untuk membesarkan lebar demi mempertahankan rasio field. Secara aljabar ini membuat lebar hasil = `(field.lebar/field.tinggi) * 140` — rumus yang **device/scale-independent**. Untuk field lebar-tapi-pendek (default field TTD: rasio 2.5:1, atau kasus ekstrem lain), setelah di-clamp ke `containerW`, kotak jadi selebar hampir SELURUH dokumen di layar mobile sempit, walau field aslinya cuma sebagian kecil lebar dokumen. Test lama (`tests/paktaPreviewLayout.test.ts`) bahkan sudah men-dokumentasikan perilaku ini sebagai "expected" (`width: 350` = persis lebar dokumen).

**Fix:** Lebar & tinggi kotak sekarang dihitung SEPENUHNYA INDEPENDEN — masing-masing punya minimum sendiri (`MIN_SIGNATURE_WIDTH=140`, baru; `MIN_SIGNATURE_HEIGHT=140`, sudah ada) dan di-clamp terpisah ke `containerW`/`containerH`. Tidak ada lagi growFactor bersama. Ini juga menyederhanakan kode (menghapus `heightGrowFactor`/`proportionalWidth`).

### Root cause (bug 2 — tombol Hapus Tanda Tangan menutupi preview)
Tombol lama pakai class `apple-btn apple-btn-secondary apple-btn-sm` berisi teks penuh "Hapus Tanda Tangan", diposisikan absolute overlay di pojok kanan-bawah kotak TTD. Class `.apple-btn-sm` punya aturan `min-height: 44px` yang dipaksakan di bawah viewport 480px (aturan touch-target aksesibilitas Apple HIG), sehingga di mobile tombol jadi ±150px lebar × 44px tinggi — di kotak TTD yang (sebelum fix bug 1) sudah kecil, tombol ini menutupi sebagian besar area gambar tanda tangan.

**Fix:** Ganti ke convention icon-only yang sudah ada di codebase (`sg-btn sg-btn-icon`, dipakai di `PaktaEditor.tsx`, `EventCard.tsx`, `PaktaEventList.tsx` — 34×34px, SVG `TrashIcon` lokal per-file, `aria-label`/`title` untuk aksesibilitas). Jauh lebih kecil, tidak lagi tertimpa aturan `min-height:44px` yang khusus untuk `.apple-btn-sm`.

### Ringkasan Perubahan
- `src/lib/paktaPreviewLayout.ts` — `computeSignatureBox` disederhanakan: lebar & tinggi independen, tanpa growFactor bersama. `MIN_SIGNATURE_WIDTH=140` baru diekspor.
- `tests/paktaPreviewLayout.test.ts` — nilai expected diupdate sesuai logic baru; 1 test lama yang men-dokumentasikan bug (`width:350`) diupdate; 1 test regresi baru khusus memastikan kotak tidak melebar jauh melebihi lebar asli field.
- `src/components/pakta-signer/PaktaDocumentPreview.tsx` — tombol hapus TTD diganti dari `apple-btn-sm` teks penuh → `sg-btn sg-btn-icon` (34×34, ikon trash lokal).

### Verifikasi manual yang sudah dilakukan
Harness sementara di `src/App.tsx` (route `?debugSigBox=1` merender `PaktaDocumentPreview` langsung dengan template fixture, background SVG data-URI) dipakai untuk verifikasi visual lewat `preview_*` tools di viewport mobile 375px, lalu DIREVERT (`git checkout -- src/App.tsx`) — tidak ada jejak di working tree:
- ✅ Field TTD 400×120 (rasio lebar-pendek, sama seperti default field TTD di editor) pada dokumen 1000px lebar, container mobile 343px: kotak jadi **140×140px** (dikonfirmasi `getBoundingClientRect()`), BUKAN ±343px (hampir selebar dokumen) seperti sebelum fix.
- ✅ Menggambar tanda tangan (via `PointerEvent` sintetis realistis dengan delay antar-event) → tombol hapus (ikon kecil pojok kanan-bawah) TIDAK menutupi coretan tanda tangan (dikonfirmasi screenshot).
- ✅ Klik tombol hapus → kanvas kosong, hint "Tanda tangan di sini" muncul kembali.

**Belum diverifikasi:** alur signing end-to-end dengan Supabase asli (perlu `.env` kredensial valid + event/signer nyata) dan desktop viewport (perubahan ini menurut analisis matematis tidak berpengaruh di desktop, karena `rawHeight` biasanya sudah ≥ `MIN_SIGNATURE_HEIGHT` di container lebar — konsisten dengan laporan bug sebelumnya bahwa desktop "sudah benar").

### Commands Run
```
npm install
npm run build   # tsc -b && vite build — PASS
npm run test    # 22 files, 139/139 tests — PASS
```
**Catatan jujur:** tidak ada script `lint` di `package.json` (pre-existing, di luar scope perubahan ini).

### Known Issues
- Tidak ada script `lint` di project (pre-existing).
- Bundle JS utama >2MB setelah build (warning Vite, pre-existing, tidak terkait perubahan ini).
- Verifikasi Supabase end-to-end belum bisa dilakukan di worktree ini — disarankan dites manual sekali lagi di environment dengan `.env` terisi sebelum merge ke `main`.

### Next Step
1. User me-review perubahan (atau minta code review lewat `/code-review`).
2. Push branch & buat PR hanya setelah user eksplisit minta.
3. Sebelum atau sesudah merge: uji manual sekali dengan Supabase environment nyata di HP sungguhan untuk menutup gap verifikasi di atas.
