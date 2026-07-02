# Preview Tanda Tangan Realistis — Pakta Integritas

**Tanggal:** 2026-07-02
**Status:** Disetujui, menunggu implementation plan

## Latar Belakang

Halaman publik penandatanganan Pakta Integritas (`/pakta/{slug}`, komponen `PaktaSignPage.tsx`, step `signing`) saat ini **tidak menampilkan gambar template dokumen sama sekali**. User hanya melihat:

1. Kartu teks ringkasan: `{nama} — {nip} — {jabatan}`.
2. Kotak tanda tangan kosong (`SignaturePad`) yang berdiri sendiri, dengan border putih dan tinggi tetap 180px.

Ini tidak terasa seperti menandatangani dokumen asli, padahal saat submit, sistem sudah merender field-field ini (`nama`, `nip`, `jabatan`, `namaNip`, `tandaTangan`, dll) ke posisi yang presisi di atas gambar template lewat `pdfRenderer.ts`. User tidak pernah melihat pratinjau posisi field yang sebenarnya sebelum menandatangani.

Tujuan: buat pengalaman menandatangani terasa seperti menandatangani dokumen fisik — dokumen penuh ditampilkan dengan semua field sudah terisi data asli di posisi aslinya, dan user menggambar tanda tangan langsung di kotak `tandaTangan` pada dokumen tersebut.

## Keputusan Desain (dari sesi brainstorming)

1. **Render dokumen penuh + tanda tangan overlay** — bukan kartu ringkasan terpisah. Gambar template + field terisi + area TTD semua dalam satu kontainer dokumen.
2. **Gambar langsung di kotak TTD pada dokumen** — bukan modal terpisah. Kanvas tanda tangan adalah bagian dari dokumen itu sendiri, diposisikan tepat di field `tandaTangan`.
3. **Hint visual sebelum menggambar**: border dashed tipis + label kecil pudar "Tanda tangan di sini" di dalam kotak TTD, hilang begitu user mulai menggambar (stroke pertama).
4. **Tombol aksi tetap di bawah, tidak sticky**: "Hapus Tanda Tangan" kecil di pojok kanan-bawah kotak TTD (menyatu di dokumen), "Kirim Tanda Tangan" full-width di bawah seluruh dokumen — layout saat ini dipertahankan.
5. **Mobile: fit-to-width, tanpa pinch-zoom** — dokumen otomatis menyesuaikan lebar layar (skala tunggal), tidak ada zoom kustom.
6. **Minimum ukuran kotak TTD interaktif** — pada layar sempit, `scale` global bisa membuat kotak field `tandaTangan` jadi terlalu kecil untuk digambar nyaman dengan jari (mis. ±150×90px pada field default di HP 375px). Kotak TTD *interaktif* (kanvas `SignaturePad` + hint) diberi batas bawah ukuran (`MIN_SIGNATURE_HEIGHT` ≈ 140px, lebar menyesuaikan proporsi field asli) yang diterapkan hanya pada elemen ini — tidak memengaruhi scale dokumen/field teks lain. Jika kotak field asli (hasil `scale` global) sudah ≥ batas ini, tidak ada perubahan. Jika lebih kecil, kotak TTD ditampilkan sedikit lebih besar dari proporsi field aslinya (tetap di posisi/anchor yang sama, sedikit "keluar" dari outline field pada gambar), sehingga tetap nyaman digambar tanpa memerlukan gesture zoom.

## Arsitektur

### Komponen baru: `PaktaDocumentPreview.tsx`

Lokasi: `src/components/pakta-signer/PaktaDocumentPreview.tsx`

Tanggung jawab:
- Menerima `template` (background + bgWidth/bgHeight + fields), `values` (FieldValues hasil pre-fill: nama/nip/jabatan/tanggal), dan render props untuk slot tanda tangan.
- Menghitung `scale = containerWidth / bgWidth` via `ResizeObserver` pada elemen pembungkus (pola yang sama dengan `EditorCanvas.tsx`), lalu meng-update saat resize.
- Merender `<img>` background dengan `width: 100%` di dalam wrapper `position: relative` yang tingginya di-set ke `bgHeight * scale`.
- Untuk setiap field selain `tandaTangan`, merender elemen teks absolute-positioned:
  - Field `namaNip`: dua baris (nama bergaris-bawah + "NIP. {nip}") — mirror logika `drawNamaNipField` di `pdfRenderer.ts`.
  - Field lain (`nama`, `nip`, `jabatan`, `tanggal`, dst): satu baris teks, alignment (`left`/`center`/`right`) dan `formatter` (`uppercase`) sesuai konfigurasi field.
  - Font-size shrink-to-fit memakai ulang `toCssFont()` dan `browserTextWidth()` yang sudah diekspor dari `src/lib/pdfRenderer.ts`, supaya posisi & ukuran teks identik dengan hasil PDF akhir.
- Untuk field `tandaTangan`: merender sebuah `<div>` absolute-positioned pada posisi & ukuran field (scaled), berisi slot untuk `SignaturePad` (dilewatkan sebagai `children` atau prop `renderSignature`) plus hint dashed-border + label yang disembunyikan lewat state `hasSignature`.
- Ukuran kotak TTD interaktif diberi batas bawah: `const boxHeight = Math.max(scaledFieldHeight, MIN_SIGNATURE_HEIGHT)` (konstanta `MIN_SIGNATURE_HEIGHT ≈ 140`), lebar disesuaikan proporsional agar rasio kotak tidak berubah drastis. Anchor kotak (titik tengah/x,y) tetap sama seperti posisi field asli — hanya ukurannya yang dijaga agar tidak lebih kecil dari batas nyaman digambar. Field teks lain tidak terpengaruh oleh klem ini.

**Kenapa CSS overlay, bukan Konva:** halaman publik (`PaktaSignPage`) saat ini tidak mem-bundle `react-konva`. Memakai CSS absolute-positioning + `<img>` lebih ringan untuk bundle publik, teks native lebih tajam dari canvas-rendered text, dan tetap bisa full-parity dengan PDF karena logika ukur teks (`browserTextWidth`) dipakai ulang dari `pdfRenderer.ts` — bukan didekati ulang secara terpisah.

### Perubahan `SignaturePad.tsx`

Tambahan props (opsional, default mempertahankan perilaku lama untuk konsumen lain bila ada):
- `transparent?: boolean` — jika true, `background: transparent` alih-alih putih dan tanpa border, agar menyatu dengan gambar dokumen di baliknya.
- `hideClearButton?: boolean` — jika true, tombol "Hapus Tanda Tangan" bawaan disembunyikan (karena `PaktaDocumentPreview` akan merender tombol clear-nya sendiri di pojok kotak TTD).
- `onStrokeBegin?: () => void` — dipanggil sekali saat stroke pertama dimulai (via event `beginStroke` dari `signature_pad`), dipakai untuk menyembunyikan hint "Tanda tangan di sini".
- `style`/`className` pass-through supaya `PaktaDocumentPreview` bisa mengatur ukuran kanvas mengikuti field `tinggi`/`lebar` yang sudah di-scale, bukan hardcode `height: 180`.

Method yang sudah ada di `SignaturePadHandle` (`isEmpty`, `toDataURL`, `clear`) tidak berubah.

### Perubahan `PaktaSignPage.tsx`

Step `signing` (baris ±247–289 saat ini) diganti:
- Hapus kartu ringkasan teks nama/NIP/jabatan (data ini sekarang tampil di dalam dokumen itu sendiri via field yang sudah terisi).
- Render `PaktaDocumentPreview` dengan `template` + `backgroundDataUrl` + `values` (dibangun dari `signer.nama/nip/jabatan` + `template.tanggal` — sama seperti yang sudah dibangun di `handleSubmit`, dipindah agar tersedia lebih awal untuk preview) + `sigPadRef`.
- Tombol "Kirim Tanda Tangan" full-width tetap di bawah, logic `handleSubmit` tidak berubah (tetap memakai `sigPadRef.current.toDataURL()` dan `renderPakta()` seperti sekarang).
- Tombol "← Pilih Nama Lain" tetap di atas seperti sekarang.

## Alur Data

```
signer terpilih → values = { nama, nip, jabatan, tanggal }
                → PaktaDocumentPreview(template, values, sigPadRef)
                     → hitung scale via ResizeObserver
                     → render <img background> + field-field terisi (posisi presisi)
                     → render SignaturePad transparan di kotak field tandaTangan
User menggambar → onStrokeBegin → hint hilang
User klik "Kirim" → sigPad.toDataURL() → renderPakta() [tidak berubah] → upload → simpan status
```

## Error Handling

Tidak ada perubahan pada penanganan error yang sudah ada (`get_pdf_upload_url` gagal, upload gagal, simpan status gagal) — semua tetap di `handleSubmit`. Perubahan ini murni pada tampilan step `signing` sebelum submit.

Kasus tepi baru yang perlu ditangani di `PaktaDocumentPreview`:
- Field dengan `tipe: 'tandaTangan'` tidak ditemukan di `template.fields` (admin lupa menempatkan field TTD) → tampilkan pesan singkat di bawah dokumen alih-alih menggantung tanpa area tanda tangan sama sekali (fallback: render `SignaturePad` biasa seperti sekarang, di luar dokumen).

## Testing

- Manual: buka `/pakta/{slug}` dengan berbagai lebar viewport (mobile 375px, tablet, desktop) — pastikan field & kotak TTD tetap presisi selaras dengan `pdfRenderer.ts` (bandingkan preview dengan PDF hasil unduhan).
- Manual: pada viewport sempit (375px) dengan field `tandaTangan` berukuran kecil, pastikan kotak TTD interaktif tidak lebih kecil dari `MIN_SIGNATURE_HEIGHT` dan tetap nyaman digambar dengan jari; pada viewport lebar (desktop), pastikan klem ini tidak aktif (kotak mengikuti proporsi field asli).
- Manual: nama panjang (gelar) — pastikan shrink-to-fit bekerja sama seperti di PDF, tidak overflow keluar field.
- Manual: gambar tanda tangan, klik "Hapus Tanda Tangan", pastikan hint muncul kembali dan submit tetap berfungsi.
- Manual: template lama yang belum punya field `tandaTangan` — pastikan fallback tidak crash.

## Scope

Termasuk: `PaktaDocumentPreview.tsx` baru, perubahan `SignaturePad.tsx`, perubahan step `signing` di `PaktaSignPage.tsx`.

Tidak termasuk (di luar scope): perubahan pada `pdfRenderer.ts`, editor admin (`EditorCanvas.tsx`), skema database, atau API routes.
