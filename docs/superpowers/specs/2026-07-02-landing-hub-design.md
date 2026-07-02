# Landing Hub — Redesain Halaman Awal

**Tanggal:** 2026-07-02
**Status:** Disetujui, siap masuk tahap perencanaan implementasi

## Masalah

Halaman awal aplikasi (`view.name === 'home'`) saat ini langsung merender `EventList`
(`src/components/EventList.tsx`), yaitu daftar kegiatan untuk modul **Sertifikat
Generator**. Judul, empty-state, dan onboarding 3-langkah di halaman ini semuanya
membahas sertifikat. Pintu masuk ke modul **Pakta Integritas** hanya berupa satu
tombol sekunder ("Pakta Integritas", `EventList.tsx:112-117`) yang ditaruh sejajar
dengan tombol aksi biasa ("Buat kegiatan"), tanpa perbedaan visual yang menandakan
bahwa tombol itu berpindah ke modul terpisah (dengan sistem login admin sendiri,
`AdminLogin`).

Akibatnya pengguna baru tidak bisa membedakan mana menu untuk Sertifikat Generator
dan mana untuk Pakta Integritas dari tampilan halaman awal.

## Populasi Pengguna

Campuran — sebagian operator memakai kedua modul, sebagian hanya salah satu. Tidak
ada pola tetap siapa memakai modul apa, sehingga tidak tepat menjadikan salah satu
modul sebagai default implisit.

## Keputusan Desain

Halaman awal (`view.name === 'home'`) diubah menjadi **Hub** netral: halaman pemilih
modul dengan dua kartu besar setara — "Sertifikat Generator" dan "Pakta Integritas".
Daftar kegiatan sertifikat (isi `EventList` saat ini, tidak diubah) dipindah ke view
baru `sertifikat` yang diakses lewat kartu Hub.

Kartu Hub berisi **ikon + nama saja** (tanpa deskripsi kalimat, tanpa statistik/angka)
— sesuai preferensi eksplisit pengguna untuk tampilan minimalis.

### Alasan memilih pendekatan ini dibanding alternatif

Dipertimbangkan juga: (a) hub + shortcut "terakhir dibuka", dan (b) sidebar
app-switcher permanen di semua halaman. Hub netral polos dipilih karena:
- Populasi pengguna campuran → tidak ada modul yang layak jadi default.
- Risiko paling rendah terhadap layout mobile yang baru saja diperbaiki
  (`4f26d0a fix(pakta-admin): perbaiki overlap layout di mobile`) — sidebar
  permanen akan mengubah layout semua halaman termasuk editor/generate yang
  sudah stabil.
- Satu keputusan navigasi tunggal saat masuk aplikasi, dengan breadcrumb
  "Beranda" yang sudah ada sebagai jalan kembali dari mana saja.

## Perubahan Teknis

### 1. Routing (`src/components/AppRouter.tsx`)

Tambah satu varian `View` baru:

```ts
| { name: 'sertifikat' }
```

- `parseHash()`: hash `sertifikat` → `{ name: 'sertifikat' }`; hash kosong (`#`)
  tetap → `{ name: 'home' }` (sekarang berarti Hub, bukan daftar kegiatan lagi).
- `navigate()`: tambah cabang `view.name === 'sertifikat'` → `window.location.hash = 'sertifikat'`.
- Semua rute lain (`editor`, `generate`, `pakta-*`) tidak berubah.

**Efek samping yang disengaja:** link/bookmark ke root (`#` kosong) akan mendarat
di Hub, bukan langsung ke daftar sertifikat. Ini adalah tujuan redesign, bukan
regresi — tidak perlu redirect/migrasi karena aplikasi ini internal (bukan
di-bookmark publik secara luas).

### 2. Komponen baru: `src/components/Hub.tsx`

Komponen presentasional statis, tanpa data fetching/state (selain hover/focus).

- Dua kartu, masing-masing elemen `<button>` asli (bukan `div onClick`) —
  memastikan dapat diakses via keyboard (Tab + Enter) dan screen reader tanpa
  ARIA tambahan.
- Kartu "Sertifikat Generator": ikon sertifikat (reuse gaya `CertIcon` dari
  `EventList.tsx`), label "Sertifikat Generator", `onClick` →
  `navigate({ name: 'sertifikat' })`.
- Kartu "Pakta Integritas": ikon baru bergaya sama (garis, stroke, ukuran 40×40,
  warna `var(--color-primary)`) — motif dokumen/tanda tangan, konsisten dengan
  `CertIcon`. `onClick` → `navigate({ name: 'pakta-admin' })`.
- Styling memakai token & konvensi kelas `sg-*` yang sudah ada di
  `EventList.tsx`/`apple-design.css` (radius `--apple-radius-xl`, shadow
  `--shadow-elevated` saat hover, tanpa bahasa desain baru). Grid 2 kolom di
  desktop, stack vertikal di mobile (mengikuti breakpoint yang sudah dipakai di
  `sg-event-grid`).

### 3. `src/components/EventList.tsx`

- Tidak ada perubahan logika/isi.
- Hapus tombol "Pakta Integritas" (baris 112-117) — jalur ke Pakta Integritas
  sekarang lewat Hub atau breadcrumb "Beranda", bukan dari dalam daftar kegiatan.

### 4. `src/App.tsx`

- Import `Hub` dan render saat `view.name === 'home'`.
- Render `EventList` saat `view.name === 'sertifikat'` (bukan lagi saat `home`).
- Update fungsi `breadcrumbs`:
  - Hub: `[{ label: 'Beranda', active: true }]`.
  - Alur `sertifikat`/`editor`/`generate`: sisipkan crumb "Sertifikat Generator"
    (→ `{ name: 'sertifikat' }`) di antara "Beranda" dan nama kegiatan, sehingga
    jadi `Beranda → Sertifikat Generator → [nama kegiatan] → ...` (sebelumnya
    langsung `Beranda → [nama kegiatan]`).
  - Alur `pakta-*` tidak berubah: `Beranda → Pakta Integritas → ...`.

### 5. `src/components/AppTopbar.tsx`

- Logo "S" (`sg-topbar-logo`, baris 43) diubah dari `<div>` statis menjadi
  `<button>` dengan `onClick={() => navigate({ name: 'home' })}` dan
  `aria-label="Beranda"` — shortcut standar "klik logo = pulang ke Hub" dari
  halaman manapun.

## Non-Tujuan / Di Luar Cakupan

- Tidak mengubah apa pun di dalam modul Pakta Integritas (login, dashboard,
  editor pakta) — hanya jalur masuk ke modul tersebut yang berubah.
- Tidak menambah statistik/angka ringkas di kartu Hub (ditolak eksplisit demi
  minimalis).
- Tidak menambah shortcut "terakhir dibuka" (opsi B yang dipertimbangkan lalu
  tidak dipilih).
- Tidak mengubah `EventList.tsx` selain menghapus satu tombol yang sudah tidak
  relevan.

## Verifikasi

Karena Hub murni presentasional tanpa data eksternal, verifikasi dilakukan
manual lewat preview browser:
1. Buka root (`#` kosong) → Hub tampil dengan 2 kartu.
2. Klik kartu "Sertifikat Generator" → masuk ke daftar kegiatan (view
   `sertifikat`), breadcrumb menampilkan `Beranda → Sertifikat Generator`.
3. Klik kartu "Pakta Integritas" → masuk ke alur admin Pakta (login jika belum
   login), breadcrumb `Beranda → Pakta Integritas`.
4. Dari dalam kedua modul (termasuk sub-halaman seperti editor/generate/pakta
   editor/dashboard), klik breadcrumb "Beranda" atau logo "S" → kembali ke Hub.
5. Navigasi kartu Hub via keyboard (Tab lalu Enter/Space) berfungsi.
6. Resize ke lebar mobile → kartu Hub stack vertikal, tidak overlap; layout
   Pakta admin mobile (perbaikan sebelumnya) tidak regresi.
