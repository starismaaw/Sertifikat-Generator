# Spec: Reset Tanda Tangan + Search di Dashboard Admin Pakta

**Tanggal:** 2026-07-02
**Status:** Approved
**Scope:** `api/pakta-admin.ts` (action baru `reset_signer`), `src/components/pakta-admin/PaktaDashboard.tsx`

---

## 1. Latar Belakang

Dashboard admin acara pakta integritas (`PaktaDashboard.tsx`) menampilkan tabel peserta dengan status TTD, tapi tidak punya cara untuk:
1. Membatalkan tanda tangan seorang peserta supaya dia bisa menandatangani ulang (mis. salah tanda tangan, salah data, atau butuh revisi).
2. Mencari peserta tertentu di tabel — untuk acara dengan banyak peserta, admin harus scroll manual.

---

## 2. Reset Tanda Tangan

### 2.1 Backend — action baru `reset_signer`

Tambah case baru di `api/pakta-admin.ts`, setelah case `delete_event` (baris 104-134) dan sebelum `get_signed_url` (baris 136), mengikuti pola yang sama (hapus file storage lalu update database):

```ts
case 'reset_signer': {
  const { id } = body as { id: string };
  if (!id) return res.status(400).json({ error: 'id peserta wajib diisi' });

  const { data: signer } = await sb
    .from('pakta_signers')
    .select('pdf_path')
    .eq('id', id)
    .single();

  if (signer?.pdf_path) {
    await sb.storage.from('pakta-documents').remove([signer.pdf_path]);
  }

  const { error } = await sb
    .from('pakta_signers')
    .update({ status: 'belum', signed_at: null, pdf_path: null })
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
```

Action ini otomatis terlindungi password admin karena `verifyPassword` sudah dicek di awal `handler` (baris 24-26) sebelum switch `action` — tidak perlu pengecekan tambahan.

PDF lama dihapus permanen dari bucket `pakta-documents` (sama seperti pola `delete_event`), bukan dibiarkan menjadi file yatim. Kalau `signer` tidak ditemukan (`select().single()` gagal), `signer?.pdf_path` bernilai `undefined` — langkah hapus storage dilewati (bukan error), lalu `update` di bawahnya akan gagal secara alami (0 baris ter-update, Supabase tidak melempar error untuk update yang tidak match baris manapun) — ini diterima karena `id` yang salah/sudah dihapus adalah kasus tepi yang sangat jarang terjadi dari UI (tombol reset hanya muncul untuk baris yang sudah dimuat dari tabel yang sama).

### 2.2 Frontend — tombol reset di tabel

Tambah fungsi di `PaktaDashboard.tsx` (setelah fungsi `downloadPdf`, baris 52-66):

```ts
async function resetSigner(signer: Signer) {
  if (!confirm(`Reset tanda tangan ${signer.nama}? PDF yang sudah ditandatangani akan dihapus permanen dan pegawai ini bisa TTD ulang.`)) return;
  try {
    await callAdmin('reset_signer', { id: signer.id });
    load();
  } catch (err) {
    alert((err as Error).message);
  }
}
```

Kolom "Unduh" di tabel (`<td>` baris 153-164 saat ini) diperluas: tombol "Unduh" tetap seperti sekarang, ditambah tombol "Reset" di sampingnya — **keduanya hanya muncul kalau `s.status === 'sudah'`** (baris "Belum" di kolom ini tetap `—`, tidak ada perubahan untuk baris yang belum TTD):

```tsx
<td>
  {s.pdf_path ? (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        className="sg-btn sg-btn-outline"
        style={{ fontSize: 12, padding: '2px 10px' }}
        disabled={downloadingId === s.id}
        onClick={() => downloadPdf(s)}
      >
        {downloadingId === s.id ? '…' : 'PDF'}
      </button>
      <button
        className="sg-btn sg-btn-outline"
        style={{ fontSize: 12, padding: '2px 10px' }}
        onClick={() => resetSigner(s)}
      >
        Reset
      </button>
    </div>
  ) : '—'}
</td>
```

Setelah reset berhasil, `load()` (fungsi yang sudah ada, dipakai tombol "Refresh") dipanggil ulang untuk memuat ulang tabel dari database — baris peserta itu akan otomatis pindah status jadi "Belum" tanpa perlu reload halaman.

---

## 3. Search

### 3.1 State dan input

Tambah state `const [query, setQuery] = useState('')` di level komponen `PaktaDashboard`.

Input diletakkan di atas tabel, sebelum blok tombol aksi "Impor Pegawai"/"Refresh" (atau tepat di atas `<table>`, di dalam kondisi `signers.length === 0 ? ... : (...)` yang sudah ada di baris 124-170) — memakai class `.apple-input` yang sudah dipakai konsisten di halaman lain (mis. `PaktaSignPage.tsx`):

```tsx
<input
  type="text"
  className="apple-input"
  placeholder="Cari nama atau NIP…"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  style={{ width: '100%', marginBottom: 12 }}
/>
```

### 3.2 Filter

Import `matchesSignerQuery` dari `../../lib/signerFilter` (fungsi murni yang sudah ada dan sudah diuji — dipakai juga di halaman publik pemilihan nama). Filter diterapkan sebelum `.map()` tabel:

```ts
const filteredSigners = signers.filter(s =>
  matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query)
);
```

Reuse `matchesSignerQuery` dua kali (nama, lalu NIP) — tidak menulis ulang logic pencarian atau menambah fungsi baru ke `signerFilter.ts`, karena fungsi yang ada sudah generik (menerima string field mana pun + query).

`sudahCount`/`totalCount` (baris 82-83, dipakai di kartu statistik "Sudah menandatangani X/Y") tetap dihitung dari `signers` mentah, BUKAN `filteredSigners` — supaya angka ringkasan statistik tidak berubah saat admin mengetik di kotak cari (konsisten dengan pola yang sama yang sudah dipakai di halaman publik pemilihan nama untuk `totalBelum`/`totalSudah`).

Tabel (`<tbody>`, baris 139-166) me-render `filteredSigners.map(...)` alih-alih `signers.map(...)`.

### 3.3 Empty state pencarian

Kalau `signers.length > 0` tapi `filteredSigners.length === 0` (ada peserta tapi tidak ada yang cocok dengan pencarian), tampilkan pesan `.apple-empty` (class yang sudah ada di codebase) alih-alih tabel kosong:

```tsx
{filteredSigners.length === 0 ? (
  <p className="apple-empty">Tidak ada peserta yang cocok dengan pencarian.</p>
) : (
  <div className="apple-table-wrap">
    {/* ...table markup dengan filteredSigners.map(...)... */}
  </div>
)}
```

Kondisi `signers.length === 0` (belum ada peserta sama sekali di acara ini) yang sudah ada di baris 124-125 tetap dipertahankan sebagai kondisi terluar, tidak berubah — pesan "Tidak ada peserta yang cocok" hanya muncul kalau memang ada peserta tapi search tidak menemukan kecocokan.

---

## 4. Hal yang Tidak Berubah

- Kolom tabel lain (Nama, NIP, Jabatan, Status, Waktu TTD) — tidak berubah.
- `downloadPdf`, `copyLink`, QR code, statistik kartu — tidak berubah strukturnya (hanya `sudahCount`/`totalCount` yang tetap dihitung dari data mentah, lihat 3.2).
- `ImportSignersModal`, halaman publik `PaktaSignPage.tsx`, `signerFilter.ts` (tidak ada fungsi baru ditambahkan ke file ini) — tidak disentuh.
- Action admin lain di `api/pakta-admin.ts` (`list_events`, `create_event`, `update_event`, `get_event`, `import_signers`, `delete_event`, `get_signed_url`, `get_template_upload_url`) — tidak berubah.

---

## 5. Verifikasi

- Buka dashboard acara dengan peserta campuran status "Sudah"/"Belum" → tombol "Reset" hanya muncul di baris "Sudah", berdampingan dengan tombol "PDF".
- Klik "Reset" → `window.confirm` muncul dengan nama peserta yang benar → klik Cancel → tidak ada perubahan. Klik OK → status peserta berubah jadi "Belum", waktu TTD hilang, tombol Reset/PDF hilang dari baris itu (kembali ke `—`).
- Setelah reset, buka halaman publik `/#pakta/<eventId>` → peserta yang di-reset muncul kembali di grup "Belum menandatangani" dan bisa memilih namanya untuk TTD ulang.
- Ketik nama sebagian di kotak cari → tabel terfilter sesuai substring, case-insensitive. Ketik NIP sebagian → juga match. Kosongkan → tabel penuh kembali.
- Statistik "Sudah menandatangani X/Y" di kartu atas TIDAK berubah saat mengetik di kotak cari, tetap mencerminkan total sungguhan.
- Search tanpa hasil → pesan "Tidak ada peserta yang cocok dengan pencarian." muncul, bukan tabel kosong.
- Build + test existing tidak regresi (`npm run build`, `npx vitest run`).
