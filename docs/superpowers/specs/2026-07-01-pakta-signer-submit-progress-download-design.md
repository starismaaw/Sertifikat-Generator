# Spec: Progress Bertahap saat Kirim Tanda Tangan + Unduh PDF di Halaman Sukses

**Tanggal:** 2026-07-01
**Status:** Approved
**Scope:** `PaktaSignPage.tsx` step `submitting` dan `success`, serta logic `handleSubmit`

---

## 1. Latar Belakang

Setelah user menekan "Kirim Tanda Tangan", halaman menampilkan teks statis "Mengirim tanda tangan…" (`PaktaSignPage.tsx:257-263`) tanpa indikasi progres apa pun — terlihat plain dan seperti macet, padahal proses di baliknya (`handleSubmit`, `PaktaSignPage.tsx:64-118`) sebenarnya melalui 4 langkah async nyata: minta URL unggah, render PDF di browser, unggah ke storage, simpan status ke database.

Selain itu, halaman sukses (`step: 'success'`, `PaktaSignPage.tsx:265-280`) hanya menampilkan ucapan terima kasih tanpa cara bagi peserta untuk mendapatkan salinan PDF pakta yang baru ditandatangani.

---

## 2. Progress Bertahap saat Submit

### 2.1 State baru

```ts
type SubmitPhase = 'preparing' | 'rendering' | 'uploading' | 'saving';
```

State `submitPhase` disimpan di level komponen (bukan di `PageState`, karena hanya relevan selama proses submit berjalan dan tidak perlu tersimpan di percabangan `state` utama):

```ts
const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('preparing');
```

### 2.2 Titik update di `handleSubmit`

`setSubmitPhase(...)` dipanggil tepat sebelum setiap langkah async nyata dimulai, di dalam `handleSubmit` (`PaktaSignPage.tsx:64-118`):

| Tahap | Dipanggil sebelum | Baris referensi (kondisi sebelum perubahan) |
|---|---|---|
| `preparing` | `fetch('/api/pakta-signer', { action: 'get_pdf_upload_url', ... })` | sebelum baris 84 |
| `rendering` | `renderPakta(templateWithBg, values, signaturePng)` | sebelum baris 95 |
| `uploading` | `fetch(signedUrl, { method: 'PUT', ... })` | sebelum baris 97 |
| `saving` | `updateSignerDone(signer.id, pdfPath)` | sebelum baris 105 |

`submitPhase` di-reset ke `'preparing'` di awal `handleSubmit` (sebelum `setState({ step: 'submitting' })`) supaya kalau user mengulang submit setelah error, tahap dimulai dari awal lagi.

### 2.3 Label tahap

```ts
const SUBMIT_PHASE_LABELS: Record<SubmitPhase, string> = {
  preparing: 'Menyiapkan dokumen…',
  rendering: 'Membuat PDF…',
  uploading: 'Mengunggah dokumen…',
  saving: 'Menyimpan status…',
};
```

### 2.4 Render step `submitting`

Ganti blok render step `submitting` (`PaktaSignPage.tsx:253-263`) dari teks statis menjadi:

```tsx
if (state.step === 'submitting') {
  return (
    <div className="apple-page">
      <div className="apple-page-compact">
        <div className="apple-progress" style={{ marginTop: 64 }}>
          <div className="apple-progress-phase">{SUBMIT_PHASE_LABELS[submitPhase]}</div>
          <div className="apple-progress-track">
            <div className="apple-progress-fill indeterminate" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

Class `.apple-progress`, `.apple-progress-phase`, `.apple-progress-track`, `.apple-progress-fill.indeterminate` sudah ada di `src/styles/apple-design.css` (dipakai di alur generate massal sertifikat, `GenerateBulk.tsx`) — tidak ada CSS baru yang ditulis. Bar bersifat indeterminate (animasi gerak terus-menerus tanpa nilai persentase), karena proses ini tidak punya unit hitungan progres yang bisa diukur secara akurat (bukan proses per-item seperti generate massal) — label tahap yang berganti adalah sinyal progres utamanya.

---

## 3. Unduh PDF di Halaman Sukses

### 3.1 Perluas tipe state `success`

```ts
| { step: 'success'; signerNama: string; pdfBytes: Uint8Array }
```

### 3.2 Simpan `pdfBytes` saat submit berhasil

`renderPakta()` sudah menghasilkan `pdfBytes` di `handleSubmit` (baris 95, `const pdfBytes = await renderPakta(...)`) sebelum diunggah. Ubah pemanggilan `setState` sukses (baris 114) dari:

```ts
setState({ step: 'success', signerNama: signer.nama });
```

menjadi:

```ts
setState({ step: 'success', signerNama: signer.nama, pdfBytes });
```

### 3.3 Tombol unduh

Tambah fungsi di level komponen:

```ts
function downloadSuccessPdf(signerNama: string, pdfBytes: Uint8Array) {
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pakta-${signerNama.replace(/\s+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

Pola dan konvensi nama file (`pakta-${nama.replace(/\s+/g, '_')}.pdf`) identik dengan `downloadPdf` yang sudah dipakai admin di `PaktaDashboard.tsx:52-66`, untuk konsistensi. Bedanya di sini tidak perlu network call (`get_signed_url`) karena `pdfBytes` sudah tersedia di memori — dibungkus jadi `Blob` + object URL lokal, bukan fetch ke storage.

Render step `success` (`PaktaSignPage.tsx:265-280`) mendapat tombol tambahan setelah teks ucapan terima kasih:

```tsx
if (state.step === 'success') {
  return (
    <div className="apple-page">
      <div className="apple-page-compact">
        <div className="apple-card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 className="apple-h2">Tanda Tangan Berhasil</h2>
          <p style={{ color: 'var(--color-ink-faint)', marginTop: 8 }}>
            Terima kasih, <strong>{state.signerNama}</strong>.<br />
            Pakta Integritas Anda telah berhasil ditandatangani dan disimpan.
          </p>
          <button
            className="apple-btn apple-btn-primary"
            style={{ marginTop: 24 }}
            onClick={() => downloadSuccessPdf(state.signerNama, state.pdfBytes)}
          >
            Unduh PDF
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.4 Batasan yang disepakati

`pdfBytes` hanya ada di memori React selama sesi halaman itu berlangsung. Kalau user me-refresh atau menutup lalu membuka ulang link, `pdfBytes` hilang — saat itu status peserta di database sudah `sudah`, sehingga alur `pickName` (`PaktaSignPage.tsx:52-54`, `handleSelectSigner`) akan menampilkan nama itu di grup "Sudah menandatangani" (bukan tombol aktif), bukan mengarah balik ke tombol unduh. Ini adalah batasan yang disengaja — tidak ditambah endpoint API baru untuk kasus unduh-ulang setelah refresh (di luar scope, lihat bagian 4).

---

## 4. Hal yang Tidak Berubah

- `get_pdf_upload_url` (`api/pakta-signer.ts`) — tidak ada action API baru ditambahkan.
- `updateSignerDone`, `listSigners`, `getAcaraPakta` — tidak berubah.
- Step lain: `loading`, `notFound`, `pickName`, `error` — tidak tersentuh.
- Dashboard admin (`PaktaDashboard.tsx`) dan cara admin mengunduh PDF via `get_signed_url` — tetap seperti sekarang, tidak ada perubahan pola di sana.
- Kasus unduh ulang PDF setelah halaman sukses di-refresh — tidak didukung oleh perubahan ini (lihat 3.4).

---

## 5. Verifikasi

- Trigger submit tanda tangan (dengan mock/stub backend) → konfirmasi label tahap berubah berurutan: "Menyiapkan dokumen…" → "Membuat PDF…" → "Mengunggah dokumen…" → "Menyimpan status…", dan bar progress terlihat bergerak (indeterminate), bukan diam.
- Setelah submit sukses → tombol "Unduh PDF" muncul, klik → file `pakta-<nama>.pdf` terunduh dengan konten yang identik dengan file yang diunggah ke storage (`pdfBytes` yang sama dipakai untuk keduanya).
- Refresh halaman setelah sukses → user diarahkan ke `pickName`, nama peserta yang baru TTD muncul di grup "Sudah menandatangani" (perilaku existing, tidak berubah).
- Build + test existing tidak regresi (`npm run build`, `npx vitest run`).
