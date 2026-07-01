# Spec: Perbaikan Daftar Nama di Halaman Link Tanda Tangan

**Tanggal:** 2026-07-01
**Status:** Approved
**Scope:** `PaktaSignPage.tsx` step `pickName` (halaman publik yang dibuka peserta lewat link/QR untuk memilih nama & tanda tangan)

---

## 1. Latar Belakang

Halaman ini (`step: 'pickName'`, `src/components/pakta-signer/PaktaSignPage.tsx:148-207`) menampilkan semua peserta sebagai tombol pil (`apple-btn-primary`) yang ditumpuk vertikal. Untuk acara dengan banyak peserta, tiga masalah muncul:

1. **Daftar terlalu panjang** — tidak ada pembatasan tinggi, halaman memanjang ke bawah sesuai jumlah peserta, menyulitkan pencarian nama secara visual.
2. **Tidak ada fitur cari** — peserta harus scroll manual untuk menemukan namanya sendiri.
3. **NIP overlap di mobile** — `.apple-btn` (`src/styles/apple-design.css:306`) memakai `white-space: nowrap`. Nama dan NIP dirender sejajar dalam satu baris pil dengan lebar layar sempit; saat nama panjang, teks tidak bisa wrap sehingga NIP tertimpa/terdorong keluar batas pil.

---

## 2. Perubahan

### 2.1 Item peserta — layout 2 baris (fix overlap)

Ganti `<button className="apple-btn apple-btn-primary">` per peserta dengan item list custom bergaya `.sg-signer-item`:

```tsx
<button className="sg-signer-item" onClick={() => handleSelectSigner(s)}>
  <span className="sg-signer-item-nama">{s.nama}</span>
  {s.nip && <span className="sg-signer-item-nip">{s.nip}</span>}
</button>
```

CSS baru di `src/styles/apple-design.css`:

```css
.sg-signer-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 10px 16px;
  margin-bottom: 8px;
  background: var(--apple-primary);
  color: var(--apple-body-on-dark);
  border: none;
  border-radius: var(--apple-radius-md);
  cursor: pointer;
  text-align: left;
  transition: opacity var(--apple-transition), transform var(--apple-transition-fast);
}

.sg-signer-item:hover {
  opacity: 0.9;
}

.sg-signer-item:active {
  transform: scale(0.98);
}

.sg-signer-item-nama {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  word-break: break-word;
}

.sg-signer-item-nip {
  font-size: 12px;
  opacity: 0.75;
  margin-top: 2px;
}
```

Nama dan NIP berada di baris terpisah (`flex-direction: column`) — tidak lagi berbagi ruang horizontal, sehingga tidak bisa overlap di lebar layar berapa pun. `word-break: break-word` menjaga nama sangat panjang tetap wrap dengan aman di dalam item, bukan meluber.

Item "Sudah menandatangani" (non-interaktif, `<div>`) mendapat treatment serupa tapi dengan warna muted, memakai class `.sg-signer-item-done`:

```css
.sg-signer-item-done {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-separator);
  color: var(--color-ink-faint);
}

.sg-signer-item-done .sg-signer-item-nip {
  opacity: 1;
  color: var(--color-ink-faint);
}
```

### 2.2 Search input

State baru di `PaktaSignPage.tsx`:

```ts
const [query, setQuery] = useState('');
```

Input diletakkan di atas grup "Belum menandatangani", di luar area scroll (lihat 2.4):

```tsx
<input
  type="text"
  className="apple-input"
  placeholder="Cari nama…"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  style={{ marginBottom: 12 }}
/>
```

`.apple-input` sudah ada di `apple-design.css:470` dan dipakai konsisten untuk input teks di app ini — pakai class tersebut, tidak perlu style inline.

Filter diterapkan di render, terhadap `s.nama` (case-insensitive, substring match — bukan hanya prefix, supaya "budi" juga ketemu "Ahmad Budiman"):

```ts
const q = query.trim().toLowerCase();
const matches = (s: SignerRow) => q === '' || s.nama.toLowerCase().includes(q);
const belum = signers.filter(s => s.status === 'belum' && matches(s));
const sudah = signers.filter(s => s.status === 'sudah' && matches(s));
```

Filtering di client — `signers` sudah termuat penuh dari `listSigners(eventId)`, tidak perlu query baru ke backend.

Empty state saat search tidak menemukan apa pun di grup "Belum": tampilkan pesan "Tidak ada nama yang cocok dengan pencarian." memakai class `.apple-empty` yang sudah ada di codebase (`apple-design.css:647`), konsisten dengan empty state lain di app.

### 2.3 Grup "Sudah menandatangani" — collapsed default

Ganti render list langsung dengan toggle expand/collapse:

```tsx
const [showSudah, setShowSudah] = useState(false);
// ...
{sudah.length > 0 && (
  <div className="apple-card">
    <button
      className="sg-signer-toggle"
      onClick={() => setShowSudah(v => !v)}
    >
      Sudah menandatangani ({sudah.length}) {showSudah ? '▲' : '▼'}
    </button>
    {showSudah && sudah.map(s => (
      <div key={s.id} className="sg-signer-item-done">
        <span>✓ {s.nama}</span>
        {s.nip && <span className="sg-signer-item-nip">{s.nip}</span>}
      </div>
    ))}
  </div>
)}
```

Default `showSudah = false` (tertutup). Grup ini tetap ikut filter `matches()` yang sama — kalau user sedang mencari dan grup "Sudah" di-expand, hasil pencarian tetap konsisten. `sg-signer-toggle` adalah tombol full-width sederhana (reuse pola header clickable, style minimal: `background: none; border: none; width: 100%; text-align: left; font-weight: 600; font-size: 13px; cursor: pointer; padding: 4px 0;`).

### 2.4 Tinggi daftar "Belum menandatangani" — max-height + scroll

Bungkus daftar item "Belum" (bukan search input, bukan card "Sudah") dalam container:

```css
.sg-signer-list-scroll {
  max-height: 400px;
  overflow-y: auto;
}
```

```tsx
<div className="apple-card" style={{ marginBottom: 16 }}>
  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Belum menandatangani</p>
  <input ... /> {/* search, di luar area scroll */}
  <div className="sg-signer-list-scroll">
    {belum.length === 0 ? (
      <p className="apple-empty">Tidak ada nama yang cocok dengan pencarian.</p>
    ) : (
      belum.map(s => <button className="sg-signer-item" ...>...</button>)
    )}
  </div>
</div>
```

Search input tetap terlihat di atas saat daftar di-scroll (posisinya di luar `.sg-signer-list-scroll`, jadi otomatis "sticky" secara struktural tanpa perlu `position: sticky`).

---

## 3. Hal yang Tidak Berubah

- `handleSelectSigner`, alur `signing`/`submitting`/`success`/`error` — tidak tersentuh.
- `listSigners`, `getAcaraPakta`, dan semua pemanggilan backend — tidak berubah, filtering murni di client.
- Step lain (`loading`, `notFound`, `signing`, dll.) di `PaktaSignPage.tsx` — tidak berubah.
- Halaman admin (`PaktaDashboard.tsx`, tabel signer) — di luar scope, tidak disentuh oleh perbaikan ini.
- Jika `signers.length === 0` (belum ada peserta terdaftar sama sekali) — pesan yang sudah ada tetap dipakai apa adanya, tidak dipengaruhi oleh fitur search.

---

## 4. Verifikasi

- Buka halaman via link publik (`/#pakta/<eventId>`) di viewport mobile sempit (≤375px) dengan peserta yang punya nama panjang + NIP 18 digit → pastikan NIP tampil di baris kedua, tidak overlap/terpotong.
- Ketik sebagian nama di search box → daftar "Belum" dan "Sudah" (setelah di-expand) terfilter sesuai, case-insensitive, substring match.
- Kosongkan search box → seluruh daftar kembali muncul.
- Grup "Sudah menandatangani" default tertutup saat halaman pertama dibuka; klik toggle → expand/collapse dengan benar, indikator ▲/▼ berubah.
- Dengan peserta banyak (mis. >15 belum TTD) dan search kosong → daftar "Belum" dibatasi tinggi ~400px dengan scroll internal, search box tetap terlihat di atas.
- Search tanpa hasil pada grup "Belum" → pesan "Tidak ada nama yang cocok dengan pencarian." muncul memakai style `.apple-empty` yang konsisten dengan empty state lain di app.
- Build + test existing tidak regresi (`npm run build`, `npx vitest run`).
