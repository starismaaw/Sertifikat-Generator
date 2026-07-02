# Spec: Tanda Tangan Proporsional (Tidak Melar) saat Disisipkan ke PDF

**Tanggal:** 2026-07-02
**Status:** Approved
**Scope:** `src/lib/pdfRenderer.ts` (`renderPakta`)

---

## 1. Latar Belakang

Setelah PR #33 (fix kotak TTD melebar di mobile — lihat `docs/agent-handoff.md`), kotak tanda tangan interaktif di layar sempit sekarang berukuran independen dari bentuk field aslinya (mis. 140×140px, persegi), demi kenyamanan menggambar dengan jari. Ini memperbaiki bug ukuran kotak di layar, tapi memunculkan efek samping yang sudah diprediksi di komentar kode PR #33 namun ternyata cukup parah: field TTD standar berbentuk lebar-pendek (rasio default 2.5:1), sedangkan kotak gambar di HP sekarang persegi. Saat PDF akhir dirender, gambar tanda tangan yang ditangkap dari kotak persegi itu di-**stretch non-uniform** (dilebarkan lebih banyak secara horizontal daripada vertikal) supaya pas mengisi kotak field yang lebar-pendek.

Dampaknya, dilaporkan user:
1. Coretan tanda tangan terlihat **sangat tebal dan tidak natural** — stretch horizontal yang jauh lebih besar dari vertikal membuat garis tipis yang digambar jadi terlihat gepeng/tebal.
2. Tanda tangan terasa **tidak sesuai placement dengan template** — bentuk yang terdistorsi membuat tanda tangan terlihat "salah tempat" relatif terhadap garis/area TTD pada template, meski koordinat `field.x`/`field.y` yang dipakai untuk menempatkan gambar sebenarnya tidak berubah sama sekali dan selalu benar (dikonfirmasi lewat penelusuran kode — tidak ada nilai turunan device/scale yang masuk ke `page.drawImage()`).

Kedua gejala berasal dari **akar penyebab yang sama**: stretch non-uniform saat embed ke PDF.

---

## 2. Fix: Contain-fit (bukan stretch-fill) saat embed ke PDF

### 2.1 Perubahan di `renderPakta` (`src/lib/pdfRenderer.ts`, sekitar baris 202-213)

Ganti stretch-fill (`width: field.lebar, height: h` langsung) dengan **scale seragam** (mempertahankan proporsi asli gambar tanda tangan) memakai `PDFImage.scaleToFit()` bawaan pdf-lib — method ini menghitung scale terbesar yang membuat gambar pas di dalam kotak tanpa distorsi (setara `object-fit: contain` di CSS), lalu hasilnya dipusatkan di dalam kotak field:

```ts
if (field.tipe === 'tandaTangan') {
  if (!sigImage) continue;
  const h = field.tinggi ?? field.lebar / 2;
  const { width: w, height: hh } = sigImage.scaleToFit(field.lebar, h);
  // field.y = TOP kotak; konversi ke origin bawah pdf-lib.
  page.drawImage(sigImage, {
    x: field.x + (field.lebar - w) / 2,
    y: template.bgHeight - field.y - h + (h - hh) / 2,
    width: w,
    height: hh,
  });
  continue;
}
```

`scaleToFit(field.lebar, h)` memakai dimensi natural piksel gambar PNG yang sudah di-embed (`sigImage.width`/`sigImage.height` — otomatis diisi pdf-lib dari file PNG, sama seperti dimensi kanvas tangkapan `SignaturePad`) untuk menghitung `scale = min(field.lebar / sigImage.width, h / sigImage.height)`, lalu mengembalikan `{ width, height }` yang sudah di-scale seragam (rasio lebar:tinggi gambar asli selalu terjaga).

### 2.2 Kenapa ini memperbaiki kedua gejala sekaligus

- **Tebal/tidak natural:** karena scale sekarang seragam (satu faktor untuk lebar & tinggi, bukan dua faktor berbeda), ketebalan goresan hasil scale proporsional dengan ukuran aslinya di kedua arah — tidak ada arah yang "digepengkan" lebih dari arah lainnya.
- **Placement tidak sesuai:** bentuk tanda tangan tidak lagi terdistorsi, jadi visualnya cocok dengan apa yang digambar user, dan diposisikan tepat di tengah kotak field (bukan menempel di salah satu sisi) — secara visual terasa "pas" dengan area TTD template.

### 2.3 Trade-off yang disepakati

Tanda tangan mungkin tidak lagi mengisi 100% lebar ATAU tinggi kotak field (tergantung mana yang jadi faktor pembatas) — akan ada sedikit ruang kosong (transparan) di kiri-kanan atau atas-bawah saat rasio kotak gambar (di HP: persegi) berbeda jauh dari rasio field asli (lebar-pendek). Ini disetujui sebagai trade-off yang lebih baik daripada tanda tangan yang melar/gepeng.

### 2.4 Kompatibilitas ke belakang (desktop)

Di desktop, rasio kotak interaktif sudah mendekati rasio field asli (karena `computeSignatureBox` jarang perlu membesarkan tinggi di container lebar — lihat `paktaPreviewLayout.ts`), jadi `scaleToFit` akan menghasilkan `{width, height}` yang mendekati `field.lebar`/`h` persis seperti sebelumnya — perubahan ini secara visual nyaris tidak terlihat di desktop, hanya mempengaruhi kasus mobile yang jadi sumber laporan bug.

---

## 3. Hal yang Tidak Berubah

- `paktaPreviewLayout.ts` / `computeSignatureBox` (ukuran & posisi kotak interaktif di layar, hasil PR #33) — logic ukuran kotak di preview browser sudah benar untuk tujuannya (kenyamanan sentuh), tidak disentuh.
- `SignaturePad.tsx` — tidak ada perubahan `minWidth`/`maxWidth` goresan; ketebalan goresan yang terlihat tebal adalah efek stretch saat embed PDF, bukan setting kanvas itu sendiri, jadi cukup diperbaiki di titik embed.
- `PaktaDocumentPreview.tsx` — preview di browser saat menandatangani tidak berubah tampilannya (sudah benar, karena hanya menampilkan kanvas apa adanya, tidak melakukan stretch apapun).
- `renderCertificate` (fungsi render sertifikat non-Pakta) dan field tipe lain (`namaNip`, teks biasa) — tidak disentuh, hanya cabang `field.tipe === 'tandaTangan'` di `renderPakta` yang berubah.

---

## 4. Verifikasi

- Unit test baru di `tests/pdfRenderer.test.ts`:
  1. Gambar PNG persegi (mis. 140×140) disisipkan ke field lebar-pendek (mis. lebar 600, tinggi 240) → hasil `drawImage` terpanggil dengan `width`/`height` yang mempertahankan rasio 1:1 (bukan 600×240), dan `x`/`y` bergeser dari `field.x`/top field supaya gambar berada di tengah kotak field pada sumbu yang tidak jadi faktor pembatas.
  2. Gambar PNG yang rasionya sudah sama persis dengan field (mis. 600×240 vs field 600×240) → hasil `width`/`height`/`x`/`y` identik dengan perilaku lama (`field.lebar`, `h`, `field.x`, top asli) — tidak ada regresi untuk kasus desktop/rasio-cocok.
  3. Field tanpa `tinggi` (pakai fallback `field.lebar/2`) tetap dihitung benar dengan `h` fallback tersebut sebagai tinggi kotak untuk `scaleToFit`.
- `npm run build` dan `npm run test` tidak regresi (semua test lama tetap pass).
- Verifikasi visual manual (harness sementara + `preview_*` tools seperti sebelumnya, tidak dikomit): render PDF dari signing flow mobile-sized dengan field lebar-pendek, buka PDF hasil, konfirmasi tanda tangan tidak lagi gepeng/tebal dan terlihat proporsional & tersentral di area field.
