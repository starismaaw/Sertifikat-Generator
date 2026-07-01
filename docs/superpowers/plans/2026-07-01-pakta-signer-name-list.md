# Perbaikan Daftar Nama Halaman Link Tanda Tangan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki halaman publik pemilihan nama (`PaktaSignPage.tsx`, step `pickName`) agar tidak overlap NIP di mobile, punya fitur cari nama, dan daftar tidak memanjang tak berujung.

**Architecture:** Ekstrak logika filter nama ke fungsi murni yang bisa diuji unit (`src/lib/signerFilter.ts`), ubah layout item peserta dari pil satu-baris ke item dua-baris via CSS baru di `apple-design.css`, tambah state `query`/`showSudah` di komponen, bungkus daftar "Belum" dalam container scroll bertinggi tetap.

**Tech Stack:** React (TSX), Vitest untuk unit test fungsi filter, CSS custom properties yang sudah ada di `apple-design.css`, verifikasi visual manual via browser preview (codebase ini belum punya precedent test komponen React — `@testing-library/react` ter-install tapi tidak dipakai di manapun; jangan perkenalkan pattern baru untuk perbaikan UI kecil ini).

---

### Task 1: Fungsi filter nama peserta (murni, TDD)

**Files:**
- Create: `src/lib/signerFilter.ts`
- Test: `tests/signerFilter.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```typescript
import { describe, it, expect } from 'vitest';
import { matchesSignerQuery } from '../src/lib/signerFilter';

describe('matchesSignerQuery', () => {
  it('mengembalikan true untuk semua nama saat query kosong', () => {
    expect(matchesSignerQuery('Ahmad Budiman', '')).toBe(true);
    expect(matchesSignerQuery('Ahmad Budiman', '   ')).toBe(true);
  });

  it('mencocokkan substring, bukan hanya prefix', () => {
    expect(matchesSignerQuery('Ahmad Budiman', 'budi')).toBe(true);
    expect(matchesSignerQuery('Ahmad Budiman', 'man')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(matchesSignerQuery('Ahmad Budiman', 'AHMAD')).toBe(true);
    expect(matchesSignerQuery('Ahmad Budiman', 'ahmad')).toBe(true);
  });

  it('mengembalikan false kalau tidak ada kecocokan', () => {
    expect(matchesSignerQuery('Ahmad Budiman', 'siti')).toBe(false);
  });

  it('mengabaikan spasi di awal/akhir query', () => {
    expect(matchesSignerQuery('Ahmad Budiman', '  ahmad  ')).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/signerFilter.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/signerFilter'` (file belum ada)

- [ ] **Step 3: Tulis implementasi minimal**

```typescript
export function matchesSignerQuery(nama: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return nama.toLowerCase().includes(q);
}
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `npx vitest run tests/signerFilter.test.ts`
Expected: PASS — 5/5 test lolos

- [ ] **Step 5: Commit**

```bash
git add src/lib/signerFilter.ts tests/signerFilter.test.ts
git commit -m "feat(pakta-signer): tambah fungsi filter nama peserta"
```

---

### Task 2: CSS item peserta dua-baris + toggle + scroll container

**Files:**
- Modify: `src/styles/apple-design.css` (tambah blok baru di akhir file)

Blok CSS ini menggantikan pola pil satu-baris (`apple-btn-primary` dipakai di `PaktaSignPage.tsx:164-173`) dengan item dua-baris yang tidak bisa overlap di layar sempit, plus style untuk toggle grup "Sudah" dan container scroll daftar "Belum". Tidak ada test otomatis untuk CSS murni — diverifikasi visual di Task 4.

- [ ] **Step 1: Tambahkan CSS berikut ke akhir `src/styles/apple-design.css`**

```css
/* Daftar nama peserta — halaman publik pilih nama untuk tanda tangan */
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

.sg-signer-item-done {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-separator);
  color: var(--color-ink-faint);
  font-size: 14px;
}

.sg-signer-item-done .sg-signer-item-nip {
  opacity: 1;
  color: var(--color-ink-faint);
}

.sg-signer-toggle {
  display: block;
  width: 100%;
  padding: 4px 0;
  background: none;
  border: none;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-ink);
  cursor: pointer;
}

.sg-signer-list-scroll {
  max-height: 400px;
  overflow-y: auto;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/apple-design.css
git commit -m "feat(pakta-signer): tambah CSS item peserta dua-baris, toggle, scroll container"
```

---

### Task 3: Terapkan search, layout dua-baris, toggle, dan scroll container di `PaktaSignPage.tsx`

**Files:**
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx:1-5` (import)
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx:29-33` (state komponen)
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx:148-207` (render step `pickName`)

Task ini bergantung pada Task 1 (fungsi `matchesSignerQuery`) dan Task 2 (class CSS). Tidak ada unit test React untuk task ini (lihat catatan Tech Stack) — verifikasi dilakukan manual di Task 4.

- [ ] **Step 1: Tambah import `matchesSignerQuery`**

Ubah baris 1-5 dari:

```typescript
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, PaktaTemplate } from '../../types';
import { getAcaraPakta, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
import { renderPakta } from '../../lib/pdfRenderer';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
```

menjadi:

```typescript
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, PaktaTemplate } from '../../types';
import { getAcaraPakta, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
import { renderPakta } from '../../lib/pdfRenderer';
import { matchesSignerQuery } from '../../lib/signerFilter';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
```

- [ ] **Step 2: Tambah state `query` dan `showSudah`**

Ubah baris 29-33 dari:

```typescript
export function PaktaSignPage({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [loadKey, setLoadKey] = useState(0);
  const sigPadRef = useRef<SignaturePadHandle>(null);
```

menjadi:

```typescript
export function PaktaSignPage({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [loadKey, setLoadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [showSudah, setShowSudah] = useState(false);
  const sigPadRef = useRef<SignaturePadHandle>(null);
```

- [ ] **Step 3: Ganti seluruh blok render step `pickName`**

Ganti blok pada baris 148-207 (dari `if (state.step === 'pickName') {` sampai penutup `}` sebelum `if (state.step === 'signing') {`) dari:

```tsx
  if (state.step === 'pickName') {
    const { template, signers } = state;
    const belum = signers.filter(s => s.status === 'belum');
    const sudah = signers.filter(s => s.status === 'sudah');
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <h2 className="apple-h2" style={{ marginBottom: 4 }}>{template.nama}</h2>
          <p style={{ color: 'var(--color-ink-faint)', marginBottom: 24 }}>
            Pilih nama Anda untuk menandatangani Pakta Integritas
          </p>

          {belum.length > 0 && (
            <div className="apple-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Belum menandatangani</p>
              {belum.map(s => (
                <button
                  key={s.id}
                  className="apple-btn apple-btn-primary"
                  style={{ width: '100%', marginBottom: 8, textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => handleSelectSigner(s)}
                >
                  <span style={{ fontWeight: 600 }}>{s.nama}</span>
                  {s.nip && <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 12 }}>{s.nip}</span>}
                </button>
              ))}
            </div>
          )}

          {sudah.length > 0 && (
            <div className="apple-card">
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--color-ink-faint)' }}>
                Sudah menandatangani
              </p>
              {sudah.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-separator)',
                    color: 'var(--color-ink-faint)',
                    fontSize: 14,
                  }}
                >
                  ✓ {s.nama}
                  {s.nip && <span style={{ marginLeft: 8, fontSize: 12 }}>{s.nip}</span>}
                </div>
              ))}
            </div>
          )}

          {signers.length === 0 && (
            <p style={{ color: 'var(--color-ink-faint)', textAlign: 'center' }}>
              Belum ada peserta terdaftar untuk acara ini.
            </p>
          )}
        </div>
      </div>
    );
  }
```

menjadi:

```tsx
  if (state.step === 'pickName') {
    const { template, signers } = state;
    const belum = signers.filter(s => s.status === 'belum' && matchesSignerQuery(s.nama, query));
    const sudah = signers.filter(s => s.status === 'sudah' && matchesSignerQuery(s.nama, query));
    const totalBelum = signers.filter(s => s.status === 'belum').length;
    const totalSudah = signers.filter(s => s.status === 'sudah').length;
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <h2 className="apple-h2" style={{ marginBottom: 4 }}>{template.nama}</h2>
          <p style={{ color: 'var(--color-ink-faint)', marginBottom: 24 }}>
            Pilih nama Anda untuk menandatangani Pakta Integritas
          </p>

          {signers.length > 0 && (
            <div className="apple-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                Belum menandatangani ({totalBelum})
              </p>
              <input
                type="text"
                className="apple-input"
                placeholder="Cari nama…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div className="sg-signer-list-scroll">
                {belum.length === 0 ? (
                  <p className="apple-empty">Tidak ada nama yang cocok dengan pencarian.</p>
                ) : (
                  belum.map(s => (
                    <button
                      key={s.id}
                      className="sg-signer-item"
                      onClick={() => handleSelectSigner(s)}
                    >
                      <span className="sg-signer-item-nama">{s.nama}</span>
                      {s.nip && <span className="sg-signer-item-nip">{s.nip}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {totalSudah > 0 && (
            <div className="apple-card">
              <button
                className="sg-signer-toggle"
                onClick={() => setShowSudah(v => !v)}
              >
                Sudah menandatangani ({totalSudah}) {showSudah ? '▲' : '▼'}
              </button>
              {showSudah && sudah.map(s => (
                <div key={s.id} className="sg-signer-item-done">
                  <span>✓ {s.nama}</span>
                  {s.nip && <span className="sg-signer-item-nip">{s.nip}</span>}
                </div>
              ))}
            </div>
          )}

          {signers.length === 0 && (
            <p style={{ color: 'var(--color-ink-faint)', textAlign: 'center' }}>
              Belum ada peserta terdaftar untuk acara ini.
            </p>
          )}
        </div>
      </div>
    );
  }
```

Catatan perilaku:
- Search box hanya muncul kalau `signers.length > 0` (kalau memang tidak ada peserta sama sekali, pesan lama "Belum ada peserta terdaftar" tetap tampil apa adanya, tidak berubah).
- `totalBelum`/`totalSudah` dihitung dari `signers` mentah (bukan hasil filter) supaya angka di judul grup tidak berubah-ubah saat user mengetik — hanya daftarnya yang terfilter.
- Grup "Sudah" tetap dirender (card + toggle) kalau `totalSudah > 0`, terlepas dari apakah hasil filter `sudah` kosong — supaya toggle tidak hilang mendadak saat user sedang mengetik dan search tidak match apa pun di grup itu. Ini konsisten dengan cara `belum` tidak sembunyikan card-nya, hanya sembunyikan isi listnya lewat empty-state.

- [ ] **Step 4: Build & jalankan test suite penuh**

Run: `npm run build && npx vitest run`
Expected: build 0 error; seluruh test lolos termasuk 5 test baru dari Task 1 (total sebelumnya 78 + 5 = 83)

- [ ] **Step 5: Commit**

```bash
git add src/components/pakta-signer/PaktaSignPage.tsx
git commit -m "feat(pakta-signer): tambah search, layout dua-baris, toggle sudah-TTD, scroll container"
```

---

### Task 4: Verifikasi manual di browser (mobile viewport)

**Files:** tidak ada file yang diubah — task ini murni verifikasi visual, dilakukan controller (implementer tidak punya akses browser).

- [ ] **Step 1: Jalankan dev server dan buka halaman publik pakta**

Gunakan preview tool untuk start dev server, lalu navigasi ke `/#pakta/<eventId>` acara yang punya minimal 1 peserta dengan nama panjang (≥20 karakter) dan NIP 18 digit berstatus `belum`.

- [ ] **Step 2: Resize viewport ke mobile (375px) dan periksa layout item**

Konfirmasi: nama peserta di baris atas, NIP di baris bawah, tidak ada teks yang overlap atau terpotong di luar batas kartu pil.

- [ ] **Step 3: Uji search**

Ketik sebagian nama (case berbeda, mis. huruf besar semua) di kotak "Cari nama…" → konfirmasi daftar "Belum" terfilter sesuai kecocokan substring. Kosongkan kembali → daftar penuh muncul lagi. Ketik string yang tidak cocok dengan siapa pun → pesan "Tidak ada nama yang cocok dengan pencarian." muncul.

- [ ] **Step 4: Uji toggle grup "Sudah menandatangani"**

Konfirmasi grup tertutup secara default saat halaman pertama dimuat, indikator "▼". Klik header → grup expand menampilkan daftar, indikator berubah ke "▲". Klik lagi → collapse kembali.

- [ ] **Step 5: Uji scroll container (kalau acara test punya banyak peserta belum-TTD)**

Kalau tersedia acara dengan >15 peserta status `belum`, konfirmasi daftar dibatasi tinggi (~400px) dengan scrollbar internal, sementara search box tetap terlihat di atas area scroll. Kalau tidak ada acara sebesar itu tersedia untuk diuji, catat sebagai known-limitation di laporan — CSS `max-height`/`overflow-y` sudah benar secara struktural (diverifikasi lewat inspect elemen), hanya belum divalidasi dengan data riil sebanyak itu.

- [ ] **Step 6: Laporkan hasil**

Tulis catatan singkat: item mana yang terverifikasi visual berhasil, item mana yang jadi known-limitation (kalau ada), dan screenshot/inspect findings kalau ada anomali yang perlu diperbaiki sebelum lanjut.

---

## Ringkasan Cakupan Spec

- Layout 2 baris (fix overlap NIP mobile) → Task 2 (CSS) + Task 3 (markup) + Task 4 (verifikasi visual)
- Search nama → Task 1 (fungsi murni + unit test) + Task 3 (pemakaian di komponen) + Task 4 (verifikasi perilaku)
- Grup "Sudah" collapsed default → Task 3 (state `showSudah`) + Task 4 (verifikasi)
- Max-height + scroll daftar "Belum" → Task 2 (CSS `.sg-signer-list-scroll`) + Task 3 (markup) + Task 4 (verifikasi)
- Hal yang tidak berubah (alur `signing`/`submitting`/`success`/`error`, `listSigners`, dashboard admin) → tidak disentuh oleh task manapun di plan ini, sesuai spec bagian 3.
