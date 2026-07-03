## Agent Handoff

**Branch:** `claude/sharp-jennings-88f6ac`
**Task:** Bug report: sebagian user dapat error "the resource already exist" (HTTP 500) di `/api/pakta-signer` walau belum pernah TTD dan masih ada di grup "belum menandatangani".
**Last agent:** Claude Sonnet 5 (Claude Code), via skill `systematic-debugging`
**Status:** SELESAI (root cause fixed + regression test). Build ✅, test 141/141 ✅. Tidak ada script `lint` di project (pre-existing). **Belum di-commit/push** — menunggu instruksi eksplisit user.

### Root Cause

`get_pdf_upload_url` di `api/pakta-signer.ts` memanggil `createSignedUploadUrl(pdfPath)` dengan path deterministik `${eventId}/${signerId}.pdf`, TANPA `upsert: true` (default Supabase Storage = `false`).

Alur signing (`PaktaSignPage.tsx`): (1) minta signed upload URL → (2) render PDF di client → (3) PUT PDF ke signed URL → (4) baru setelah itu `updateSignerDone()` menandai status DB jadi `'sudah'`.

Kalau proses terputus SETELAH langkah 3 (upload storage sukses) tapi SEBELUM langkah 4 selesai — tab ditutup, koneksi hilang, HP terkunci — signer tetap `status = 'belum'` di DB (makanya tampil di grup "belum menandatangani"), tapi file PDF sudah permanen ada di storage pada path itu. Percobaan TTD berikutnya memanggil `createSignedUploadUrl` dengan path yang SAMA, Storage menolak dengan "The resource already exists", endpoint meneruskannya sebagai 500. Signer terkunci permanen sampai fix ini.

### Fix

Satu perubahan: `createSignedUploadUrl(pdfPath, { upsert: true })`. Status DB (dicek tepat di atas pemanggilan ini, baris ~34-39) tetap satu-satunya sumber kebenaran untuk "sudah TTD" (request ditolak 409 kalau `status === 'sudah'`), jadi mengizinkan overwrite object storage yang basi/orphan aman — tidak membuka celah untuk menandatangani ulang dokumen yang sudah selesai.

Self-healing: user yang sudah terlanjur stuck TIDAK perlu perbaikan data manual di Supabase — percobaan TTD berikutnya (setelah fix di-deploy) akan langsung berhasil overwrite file lama dan `updateSignerDone` akan jalan normal.

### Files Changed
- `api/pakta-signer.ts` — tambah `{ upsert: true }` pada `createSignedUploadUrl` (+ komentar WHY).
- `tests/paktaSignerApi.test.ts` — assert `createSignedUploadUrl` dipanggil dengan `{ upsert: true }`. Diverifikasi test ini FAIL kalau fix di-revert (bukan false positive).

### Commands Run
```
npm install
npm run build   # tsc -b && vite build — PASS
npm run test    # 22 file, 141/141 test — PASS
npm run lint    # tidak ada script lint (pre-existing)
```

### Known Issues
- `api/pakta-admin.ts` action `get_template_upload_url` (baris ~214-222) punya bentuk kode yang mirip (`createSignedUploadUrl` tanpa `upsert`), TIDAK disentuh — di luar scope laporan bug ini (jalur admin upload template, bukan jalur signer). Perlu ditinjau terpisah kalau ada laporan serupa di sisi admin.
- Tidak ada script `lint` di project (pre-existing).
- Bundle JS utama >2MB setelah build (warning Vite, pre-existing, tidak terkait perubahan ini).

### Next Step
1. User review perubahan (`api/pakta-signer.ts` + test).
2. Commit & push hanya setelah user eksplisit minta.
3. Setelah deploy: minta user yang sebelumnya kena bug ini coba TTD ulang — seharusnya langsung berhasil tanpa intervensi data manual.
