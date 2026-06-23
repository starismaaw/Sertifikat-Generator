# Spesifikasi Desain — Aplikasi Generator Sertifikat Otomatis

**Tanggal:** 2026-06-23
**Status:** Disetujui untuk perencanaan implementasi

## Ringkasan

Aplikasi web client-side untuk membuat sertifikat secara otomatis dari background
yang diunggah pengguna. Mendukung pembuatan satuan (satu orang via form) maupun
massal (banyak orang via unggah Excel/CSV). Dipakai internal oleh pemilik proyek
dan IT staff untuk acara pelatihan dan webinar. Hasil berupa PDF — satu file untuk
satuan, ZIP untuk massal. Tidak ada backend; semua data disimpan di `localStorage`
browser.

## Tujuan & Lingkup

**Dalam lingkup:**
- Unggah background sertifikat (PNG/JPG) per acara.
- Editor visual drag-and-drop untuk menaruh field di atas background.
- Field dinamis: Nama peserta, Nomor sertifikat (urut otomatis), Nama acara,
  Tanggal acara, Peran (Peserta/Narasumber/Panitia), Tanda tangan + nama
  penandatangan.
- Pola nomor sertifikat yang bisa diatur per acara, dengan nomor urut persisten.
- Mode satuan: isi form → preview → unduh 1 PDF.
- Mode massal: unggah Excel/CSV → pemetaan kolom → pratinjau → unduh ZIP.
- Penyimpanan acara/template/nomor urut di `localStorage`.

**Di luar lingkup (disiapkan untuk upgrade, tidak dibangun sekarang):**
- Backend + database.
- Login/otentikasi.
- Pengiriman otomatis via email.
- QR code verifikasi keaslian.

## Pengguna

Internal: pemilik proyek + IT staff. Bukan portal publik. Tanpa login.

## Arsitektur

SPA client-side murni, di-deploy sebagai static site.

**Stack:** React + Vite + TypeScript, `pdf-lib` (render PDF), `react-konva`
(canvas editor drag-drop), SheetJS/`xlsx` (parsing Excel), PapaParse (parsing CSV),
JSZip (bundel ZIP massal), `localStorage` (persistensi).

**Keputusan teknis kunci:** PDF dibuat dengan `pdf-lib` yang menggambar teks
vektor langsung pada koordinat di atas gambar background yang disematkan. Ini
menghasilkan teks tajam dan posisi presisi, lebih baik daripada merasterisasi
HTML menjadi gambar.

### Komponen terisolasi

| Komponen          | Tugas                                                        | Bergantung pada     |
|-------------------|-------------------------------------------------------------|---------------------|
| `EventStore`      | CRUD acara/template & nomor urut di localStorage            | localStorage        |
| `CertificateEditor` | Canvas drag-drop penempatan & properti field             | react-konva         |
| `PdfRenderer`     | Render field ke PDF di koordinat yang benar                  | pdf-lib             |
| `DataImporter`    | Parsing & validasi Excel/CSV, deteksi header, pemetaan kolom | xlsx, PapaParse     |
| `NumberFormatter` | Bangun nomor sertifikat dari pola + increment               | (murni)             |

## Halaman & Alur

1. **Daftar Acara (Home)** — daftar acara tersimpan; tombol "Acara Baru". Tiap
   acara menyimpan nama, tanggal, background (data URL), posisi & properti field,
   pola nomor, dan nomor urut terakhir.

2. **Editor Template** — tata letak 3 panel:
   - Kiri: daftar field untuk ditambahkan.
   - Tengah: background dengan field yang dapat ditarik bebas.
   - Kanan: properti field terpilih (font, ukuran, warna, perataan).
   - Pengaturan pola nomor sertifikat.

3. **Generate Sertifikat:**
   - **Satuan:** form isian field → preview live → unduh 1 PDF.
   - **Massal:** unggah Excel/CSV → pemetaan kolom → pratinjau tabel (data +
     nomor yang dihasilkan + peringatan baris kosong/duplikat) → generate →
     unduh ZIP.

## Model Data (localStorage)

Setiap acara kira-kira:

```
Event {
  id: string
  nama: string
  tanggal: string
  background: string        // data URL
  fields: Field[]           // posisi & properti tiap field
  polaNomor: string         // mis. "{n}/SERT/P3KP/{bulan}/{tahun}"
  nomorMulai: number
  nomorPadding: number      // mis. 3 -> "001"
  nomorTerakhir: number     // persisten, bertambah otomatis
  penandatangan: { nama, jabatan }  // opsional, statis per acara
}

Field {
  tipe: 'nama' | 'nomor' | 'acara' | 'tanggal' | 'peran' | 'penandatangan' | 'namaPenandatangan'
  x, y, lebar: number
  font, ukuran, warna, perataan
}
```

## Pola Nomor Sertifikat

Placeholder yang didukung: `{n}` (nomor urut, dengan padding), `{bulan}` (romawi),
`{tahun}`. Sisanya teks bebas. Nomor urut tersimpan & bertambah per sertifikat
yang berhasil dibuat. Baris tanpa nama tidak memakai nomor urut.

## Impor Massal

1. Unggah file → baca baris header.
2. Pemetaan kolom file → field aplikasi (mis. "Jabatan" → Peran). Field statis
   (nama acara, tanggal, penandatangan) diambil dari pengaturan acara.
3. Pratinjau tabel: data + nomor yang akan dihasilkan + peringatan baris
   kosong/duplikat.
4. Generate → 1 PDF per baris → bundel ZIP. Nama file mengikuti pola, mis.
   `Sertifikat - {Nama}.pdf`.

## Penanganan Error & Kasus Tepi

- Background bukan gambar / terlalu besar (> ~5 MB) → tolak + pesan jelas (lindungi
  kuota localStorage).
- Excel/CSV kosong, header tak terbaca, atau kolom wajib (Nama) belum dipetakan →
  blokir generate + pesan spesifik.
- Baris tanpa nama → ditandai & dilewati, tidak memakai nomor urut.
- Nama terlalu panjang → auto-shrink font / batasi lebar area teks agar tidak
  keluar dari background.
- localStorage penuh → peringatan + saran hapus acara lama.
- Generate massal → tampilkan progress bar.

## Pengujian (Vitest)

Uji memverifikasi *maksud*, bukan sekadar perilaku:
- `NumberFormatter` — pola menghasilkan string benar; padding & increment benar;
  nomor urut tidak pernah dobel.
- `DataImporter` — parsing Excel & CSV; deteksi header; baris kosong; pemetaan
  kolom.
- `EventStore` — simpan/baca/hapus acara; nomor urut bertambah & persisten.
- `PdfRenderer` — field tergambar di koordinat & konten yang benar.

## Jalur Upgrade Masa Depan

Arsitektur disiapkan agar mudah menambah: backend + database (ganti `EventStore`
ke API), login, pengiriman email otomatis, dan QR code verifikasi — tanpa membongkar
inti aplikasi.
