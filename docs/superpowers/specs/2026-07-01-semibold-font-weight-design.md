# Spec: Opsi Font Weight SemiBold

**Tanggal:** 2026-07-01
**Status:** Approved
**Scope:** Menambah opsi weight `SemiBold` dan `SemiBoldItalic` ke sistem font (editor sertifikat & pakta integritas)

---

## 1. Latar Belakang

Investigasi sebelumnya (lihat sesi debugging Open Sans) mengonfirmasi bahwa PDF sudah meng-embed font Open Sans asli dengan weight yang benar — bukan bug. Namun user ingin opsi weight `SemiBold` (600) sebagai pilihan tambahan di editor, di luar 4 opsi yang ada (`Regular`, `Bold`, `Italic`, `BoldItalic`).

Dicek lewat Google Fonts metadata API (`fonts.google.com/metadata/fonts`): 9 dari 10 family di `FONT_FAMILIES` punya cut 600 (SemiBold) resmi. **Lato tidak punya** — hanya tersedia 100/300/400/700/900. Cinzel tidak punya italic sama sekali (sudah tercermin di `hasItalic: false`), jadi hanya dapat `SemiBold` polos, tidak `SemiBoldItalic`.

---

## 2. Data Model — `src/lib/fontRegistry.ts`

```ts
export type FontWeight =
  | 'Regular' | 'Bold' | 'Italic' | 'BoldItalic'
  | 'SemiBold' | 'SemiBoldItalic';

export const FONT_WEIGHTS = [
  { label: 'Regular',         value: 'Regular' },
  { label: 'SemiBold',        value: 'SemiBold' },
  { label: 'Bold',            value: 'Bold' },
  { label: 'Italic',          value: 'Italic' },
  { label: 'SemiBold Italic', value: 'SemiBoldItalic' },
  { label: 'Bold Italic',     value: 'BoldItalic' },
] as const;

export const FONT_FAMILIES = [
  { label: 'Playfair Display', value: 'Playfair Display', hasItalic: true,  hasSemiBold: true },
  { label: 'EB Garamond',      value: 'EB Garamond',      hasItalic: true,  hasSemiBold: true },
  { label: 'Cinzel',           value: 'Cinzel',            hasItalic: false, hasSemiBold: true },
  { label: 'Merriweather',     value: 'Merriweather',      hasItalic: true,  hasSemiBold: true },
  { label: 'Lato',             value: 'Lato',              hasItalic: true,  hasSemiBold: false },
  { label: 'Montserrat',       value: 'Montserrat',        hasItalic: true,  hasSemiBold: true },
  { label: 'Roboto',           value: 'Roboto',            hasItalic: true,  hasSemiBold: true },
  { label: 'Open Sans',        value: 'Open Sans',         hasItalic: true,  hasSemiBold: true },
  { label: 'Raleway',          value: 'Raleway',           hasItalic: true,  hasSemiBold: true },
  { label: 'Noto Serif',       value: 'Noto Serif',        hasItalic: true,  hasSemiBold: true },
] as const;
```

### Weight → CSS mapping (baru, satu sumber kebenaran)

Saat ini logika "apakah weight ini bold/italic" ter-duplikasi di 3 tempat: `konvaFontStyle()` (di `EditorCanvas.tsx` dan `CertPreviewMini.tsx`, copy-paste identik) dan `toCssFont()` di `pdfRenderer.ts`. Menambah 2 weight baru ke 3 switch terpisah berisiko tidak sinkron. Konsolidasi ke satu map di `fontRegistry.ts`:

```ts
export const WEIGHT_CSS: Record<FontWeight, { weight: number; italic: boolean }> = {
  Regular:        { weight: 400, italic: false },
  SemiBold:       { weight: 600, italic: false },
  Bold:           { weight: 700, italic: false },
  Italic:         { weight: 400, italic: true },
  SemiBoldItalic: { weight: 600, italic: true },
  BoldItalic:     { weight: 700, italic: true },
};

export function toKonvaFontStyle(weight: FontWeight): string {
  const { weight: w, italic } = WEIGHT_CSS[weight];
  const parts = [italic ? 'italic' : '', w !== 400 ? String(w) : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : 'normal';
}
```

`EditorCanvas.tsx` dan `CertPreviewMini.tsx` menghapus `konvaFontStyle()` lokal masing-masing dan import `toKonvaFontStyle` dari `fontRegistry.ts`. `pdfRenderer.ts`'s `toCssFont()` memakai `WEIGHT_CSS[fontWeight]` untuk membangun string CSS font (`${italic ? 'italic ' : ''}${weight} ${size}px "${family}"`) alih-alih switch bold/italic biner.

Catatan kompatibilitas: `bold` sebagai keyword CSS setara `700`, dan browser menerima weight numerik langsung di font shorthand (`"600 16px Open Sans"`), termasuk di Konva (diteruskan mentah ke `ctx.font`). Tidak ada perubahan visual untuk 4 weight lama karena `400`/`700` tetap dipetakan sama seperti sebelumnya (map menghasilkan string `"bold"`-equivalent hanya lewat angka, browser render identik).

---

## 3. UI — `src/components/editor/FieldProperties.tsx`

Perluas logika disable yang sudah ada (baris ~167-176):

```ts
{FONT_WEIGHTS.map(w => {
  const currentFont = FONT_FAMILIES.find(f => f.value === selected.fontFamily);
  const isItalicVariant = w.value === 'Italic' || w.value === 'BoldItalic' || w.value === 'SemiBoldItalic';
  const isSemiBoldVariant = w.value === 'SemiBold' || w.value === 'SemiBoldItalic';
  const disabled =
    (isItalicVariant && currentFont ? !currentFont.hasItalic : false) ||
    (isSemiBoldVariant && currentFont ? !currentFont.hasSemiBold : false);
  return (
    <option key={w.value} value={w.value} disabled={disabled}>
      {w.label}
    </option>
  );
})}
```

Efek: memilih **Lato** akan men-disable `SemiBold` dan `SemiBoldItalic`. Memilih **Cinzel** tetap men-disable semua varian italic (termasuk `SemiBoldItalic`) tapi `SemiBold` polos tetap aktif.

---

## 4. File Font Baru — `public/fonts/`

Koreksi dari draf awal: file font yang sudah ada **tidak** diunduh manual dari GitHub `google/fonts` — mereka disalin dari paket npm `@fontsource/*` (sudah ada di `dependencies`, lihat `package.json`) oleh `scripts/copy-fonts.mjs`, yang membaca `node_modules/@fontsource/<pkg>/files/<pkg>-latin-<weight>-<style>.woff`. Paket `@fontsource` ini **sudah menyediakan file weight 600** siap pakai — tidak perlu generate/instance manual dari variable font.

Dikonfirmasi langsung dari `node_modules/@fontsource/*/files/` setelah `npm install` (cocok dengan hasil cek Google Fonts metadata API di bagian 1):

| pkg | 600-normal | 600-italic |
|-----|:---:|:---:|
| open-sans | ✓ | ✓ |
| roboto | ✓ | ✓ |
| playfair-display | ✓ | ✓ |
| montserrat | ✓ | ✓ |
| raleway | ✓ | ✓ |
| noto-serif | ✓ | ✓ |
| merriweather | ✓ | ✓ |
| eb-garamond | ✓ | ✓ |
| cinzel | ✓ | — (tidak ada italic sama sekali) |
| lato | — | — |

**17 file baru** di `public/fonts/`, mengikuti konvensi `{FamilyNoSpace}-SemiBold.woff` / `{FamilyNoSpace}-SemiBoldItalic.woff` (mis. `OpenSans-SemiBold.woff`).

Perubahan: extend `scripts/copy-fonts.mjs` — tambah field `hasSemiBold` ke array `FONTS`, lalu setelah blok `copyFont(400,...)/copyFont(700,...)` tambah blok yang copy weight 600 sebagai `SemiBold`/`SemiBoldItalic` bila `hasSemiBold` true (dan `hasItalic` true untuk varian italic-nya). Jalankan ulang `node scripts/copy-fonts.mjs` untuk generate file-file baru ke `public/fonts/`.

---

## 5. Preview Parity — `index.html`

Link Google Fonts CSS2 saat ini hanya meminta `wght@0,400;0,700;1,400;1,700` (baris 14). Ini menyebabkan browser mensintesis/fallback weight 600 dari 400 atau 700 kalau tidak ditambah — preview editor tidak akan terlihat berbeda dari Bold meskipun PDF sudah pakai file 600 asli.

Tambah `600` (dan `1,600` untuk italic, kecuali Cinzel yang tidak punya axis italic) ke query string setiap family yang `hasSemiBold: true`:

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Cinzel:wght@400;600;700&family=Merriweather:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Roboto:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Raleway:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap" rel="stylesheet" />
```

Lato tetap tanpa 600 (tidak berubah dari sebelumnya).

---

## 6. File yang Diubah

| File | Jenis Perubahan |
|------|----------------|
| `src/lib/fontRegistry.ts` | Tambah `SemiBold`/`SemiBoldItalic` ke `FontWeight`/`FONT_WEIGHTS`, tambah `hasSemiBold` ke `FONT_FAMILIES`, tambah `WEIGHT_CSS` map + `toKonvaFontStyle()` |
| `src/components/editor/FieldProperties.tsx` | Perluas logika disable dropdown weight untuk SemiBold/SemiBoldItalic |
| `src/components/editor/EditorCanvas.tsx` | Hapus `konvaFontStyle()` lokal, pakai `toKonvaFontStyle` dari fontRegistry |
| `src/components/generate/CertPreviewMini.tsx` | Hapus `konvaFontStyle()` lokal, pakai `toKonvaFontStyle` dari fontRegistry |
| `src/lib/pdfRenderer.ts` | `toCssFont()` pakai `WEIGHT_CSS` alih-alih switch bold/italic biner |
| `index.html` | Tambah weight `600` ke query Google Fonts untuk 9 family (bukan Lato) |
| `scripts/copy-fonts.mjs` | Tambah `hasSemiBold` per family + blok copy weight 600 |
| `public/fonts/*.woff` | **Baru** — 17 file SemiBold/SemiBoldItalic (di-generate ulang oleh `copy-fonts.mjs`, bukan di-commit manual) |

---

## 7. Hal yang Tidak Berubah

- 4 weight lama (`Regular`, `Bold`, `Italic`, `BoldItalic`) — tampilan & file tidak berubah, hanya cara kodenya dipetakan (refactor internal, hasil visual identik).
- Lato — tidak dapat opsi SemiBold sama sekali (dropdown disabled), tidak ada file baru untuk Lato.
- `fitFontSize`, alignment, dan koordinat teks — tidak tersentuh.
- Skema data Supabase (`fields` JSON) — `fontWeight` tetap string, tidak perlu migrasi karena field lama otomatis valid di union type baru.

---

## 8. Verifikasi

- Build + typecheck lolos setelah `FontWeight` union bertambah 2 varian.
- Buka editor, pilih field, ganti family ke Open Sans → weight dropdown menampilkan SemiBold aktif; ganti ke Lato → SemiBold & SemiBold Italic ter-disable; ganti ke Cinzel → SemiBold aktif, SemiBold Italic ter-disable.
- Preview canvas untuk SemiBold terlihat visually berbeda dari Regular maupun Bold (bukan hasil sintesis browser).
- Export PDF dengan field ber-weight SemiBold, lalu cek `usWeightClass` file yang di-embed via fontTools (pola verifikasi sama seperti sesi debugging sebelumnya) untuk konfirmasi PDF benar-benar memakai weight 600, bukan fallback Helvetica.
