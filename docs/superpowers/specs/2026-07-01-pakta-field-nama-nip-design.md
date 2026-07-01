# Desain: Field Gabungan "Nama & NIP" (Pakta Integritas)

**Tanggal:** 2026-07-01
**Status:** Disetujui (menunggu review spec tertulis)
**Penulis:** Brainstorming session
**Proyek:** Sertifikat Generator — Balai P3KP Jawa III

---

## 1. Latar Belakang & Tujuan

Editor Pakta Integritas saat ini punya field teks terpisah untuk `nama` dan `nip`.
Untuk blok "tanda tangan" pada dokumen pakta, admin butuh menampilkan Nama dan NIP
pegawai sebagai satu blok tunggal dengan format baku dokumen resmi:

```
     Nama Pegawai
     ‾‾‾‾‾‾‾‾‾‾‾‾‾ (garis bawah, pas selebar teks nama)
NIP. XXXXXXXXXXXXXXXXXXX
```

Saat ini format ini harus disusun manual dari dua field terpisah (`nama` + `nip`)
yang mudah tidak sejajar dan tidak punya garis bawah maupun prefiks "NIP. ".

### Tujuan
- Admin bisa menambah **satu field** "Nama & NIP" dari palet editor Pakta, digeser
  sebagai satu blok (bukan dua field yang harus disejajarkan manual).
- Baris nama tampil bergaris bawah (pas selebar teks), baris NIP tampil dengan
  prefiks `"NIP. "`.
- Zona yang terlihat di editor **sama persis** dengan hasil akhir PDF (menerapkan
  prinsip yang sama dengan perbaikan zona tanda tangan sebelumnya).

### Non-Tujuan (YAGNI)
- Sistem field multi-baris generik yang bisa dikonfigurasi bebas (prefix/underline
  per baris, banyak kombinasi). Hanya kombinasi Nama+NIP yang dibutuhkan sekarang.
- Field ini **tidak** tersedia di editor Sertifikat, hanya Pakta Integritas.
- Tidak menghapus field `nama`/`nip` terpisah yang sudah ada — keduanya tetap bisa
  dipakai berdampingan dengan field gabungan ini.
- Tidak ada opsi format HURUF KAPITAL untuk baris nama pada field ini.
- Tidak ada properti baru untuk mengatur lebar garis bawah — selalu auto-fit
  mengikuti panjang teks nama.

---

## 2. Keputusan Desain (hasil brainstorming)

| Aspek | Keputusan |
|---|---|
| Cakupan pemakaian | Hanya palet editor **Pakta Integritas** |
| Relasi dgn field `nama`/`nip` lama | **Tetap ada**, field baru adalah opsi tambahan, bukan pengganti |
| NIP kosong | Baris kedua tetap tampil sebagai `"NIP. "` (tanpa angka), tidak disembunyikan |
| Lebar garis bawah | **Auto-fit** mengikuti lebar teks nama (bukan lebar kotak field) |
| Format nama | Tidak ada toggle HURUF KAPITAL — selalu tampil apa adanya |
| Interaksi geser | Dua baris bergerak **bersama** sebagai satu unit draggable |
| Pendekatan implementasi | Field tipe baru `namaNip`, di-*special-case* di render loop (pola sama dengan `tandaTangan`) — bukan sistem generik, bukan dua field terpisah |

---

## 3. Tipe Field & Sumber Data

- Tambah `'namaNip'` ke union `FieldTipe` di `src/types.ts`.
- **Tidak ada key `FieldValues` baru.** Field ini membaca `values.nama` dan
  `values.nip` langsung dari objek `values` yang sudah ada di alur tanda tangan
  Pakta (`PaktaSignPage.tsx` sudah mengisi keduanya). Tidak ada perubahan skema
  data, `paktaStore.ts`, atau `api/pakta-signer.ts`.
- Properti `Field` yang dipakai: `x`, `y`, `lebar`, `fontFamily`, `fontWeight`,
  `ukuran`, `warna`, `perataan`. Properti `tinggi` tetap eksklusif untuk
  `tandaTangan` (tidak dipakai `namaNip` — tinggi 2 baris dihitung otomatis dari
  `ukuran`, lihat §4).
- Baris 2 selalu berformat `"NIP. " + (values.nip ?? '')`.

---

## 4. Rendering

### 4.1 PDF (`src/lib/pdfRenderer.ts`, cabang baru di `renderPakta`, sejajar `tandaTangan`)

- Kalau `values.nama` kosong → seluruh field dilewati (tidak ada baris nama
  maupun NIP yang dirender), konsisten dengan field teks lain yang di-skip saat
  datanya kosong.
- Baris 1 = `values.nama`, digambar dengan `page.drawText`, lalu digarisbawahi
  dengan `page.drawLine` **selebar teks nama itu sendiri** (diukur lewat
  `browserTextWidth`/AFM fallback yang sudah ada di `alignedX`/`fitFontSize`).
- Baris 2 = `"NIP. " + (values.nip ?? '')`, tanpa garis bawah.
- Posisi X tiap baris dihitung independen via `alignedX()` yang sudah ada
  (mengikuti `field.perataan`), sehingga blok tetap rapi meski panjang teks
  kedua baris berbeda.
- Ukuran font tiap baris mengecil otomatis via `fitFontSize` (sudah ada),
  dihitung independen per baris.
- Jarak antar baris = `ukuran * 1.4` (konvensi tinggi-baris yang sudah dipakai
  di `EditorCanvas`). Baris 2 top = `field.y + ukuran*1.4`.

### 4.2 Preview editor (`src/components/editor/EditorCanvas.tsx`)

- Field `namaNip` dirender sebagai **satu Konva Group** berisi 2 `Text` anak:
  - Baris 1: placeholder `"Nama Pegawai"`, `textDecoration="underline"`.
  - Baris 2: placeholder `"NIP. XXXXXXXXXXXXXXXXXXX"` (18 karakter `X`, sesuai
    panjang format NIP PNS Indonesia).
- **Group itu sendiri yang `draggable`** (bukan `Text` individual seperti field
  lain) — sehingga admin menggeser satu blok dan kedua baris ikut bergerak
  bersama. `onDragEnd` pada Group memperbarui `field.x`/`field.y` seperti field
  lain.
- Tinggi kotak zona (Rect putus-putus) untuk `namaNip` = `ukuran * scale * 1.4 * 2`
  (2 baris), bukan 1 baris seperti field teks biasa — menerapkan prinsip yang
  sama dengan perbaikan zona `tandaTangan` sebelumnya: **zona di editor harus
  merepresentasikan ruang yang benar-benar dipakai hasil render.**

---

## 5. Komponen yang Diubah

| File | Perubahan |
|---|---|
| `src/types.ts` | Tambah `'namaNip'` ke `FieldTipe` |
| `src/lib/pdfRenderer.ts` | Cabang render baru untuk `namaNip` di `renderPakta` (dua baris + garis bawah) |
| `src/components/editor/EditorCanvas.tsx` | Cabang render Group 2-baris untuk `namaNip`; tinggi zona 2x baris |
| `src/components/editor/FieldPalette.tsx` | Tambah `namaNip: 'Nama & NIP'` ke `FIELD_LABELS` (wajib agar `Record<FieldTipe,string>` tetap lengkap) — tidak ditambahkan ke `SECTIONS` (tidak tampil di palet Sertifikat) |
| `src/components/pakta-admin/PaktaPalette.tsx` | Tambah `'namaNip'` ke `PAKTA_FIELDS` + label `"Nama & NIP"` |
| `src/components/editor/FieldProperties.tsx` | **Tidak ada perubahan** — kontrol X/Y/Lebar/Ukuran/Huruf/Perataan/Warna yang ada sudah cukup |

---

## 6. Penanganan Error / Edge Case

| Situasi | Perilaku |
|---|---|
| `values.nama` kosong | Field dilewati total di PDF (baris NIP juga tidak muncul) |
| `values.nip` kosong | Baris 2 tetap tampil sebagai `"NIP. "` |
| Nama/NIP lebih lebar dari `field.lebar` | Font mengecil otomatis per baris (`fitFontSize`) |
| Admin juga pakai field `nama`/`nip` terpisah di template yang sama | Tidak konflik, dua sistem independen |

---

## 7. Strategi Testing (vitest)

Menambah kasus di `tests/pdfRenderer.test.ts` (pola sama seperti test `tandaTangan`
yang sudah ada), memverifikasi **maksud bisnis** bukan sekadar snapshot:

1. Field `namaNip` dengan nama+NIP terisi → 2 baris teks muncul di PDF, garis
   bawah hanya di bawah baris nama (gagal bila garis muncul di baris NIP atau
   tidak muncul sama sekali).
2. `values.nip` kosong → baris `"NIP. "` tetap muncul, bukan hilang (gagal bila
   field disembunyikan total padahal nama ada).
3. `values.nama` kosong → field dilewati total, tidak ada teks/garis apa pun.
4. Baris 2 berada tepat `ukuran*1.4` di bawah baris 1 (gagal bila jarak antar
   baris salah, menyebabkan tumpang tindih atau kejauhan).

Tidak ada test otomatis untuk `EditorCanvas.tsx` — komponen Konva ini memang
belum punya test sama sekali di proyek (konvensi yang sudah ada), diverifikasi
manual lewat preview browser.

---

## 8. Urutan Implementasi (garis besar)

1. `types.ts` — tambah `'namaNip'` ke `FieldTipe`.
2. `pdfRenderer.ts` — cabang render `namaNip` (dua baris + garis bawah + skip
   bila nama kosong) + test unit.
3. `EditorCanvas.tsx` — cabang render Group 2-baris + zona 2x tinggi.
4. `PaktaPalette.tsx` + `FieldPalette.tsx` — daftarkan field baru + label.
5. Verifikasi manual di preview browser (mount `EditorCanvas` dengan data
   sintetis, bandingkan dengan hasil `renderPakta`).

(Rincian langkah teknis dibuat pada tahap *writing-plans*.)
