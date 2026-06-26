# Spec: Custom Font System

**Tanggal:** 2026-06-26  
**Status:** Approved  
**Scope:** Menambah pilihan font custom (Google Fonts) dengan dukungan font weight ke Sertifikat Generator

---

## 1. Latar Belakang

Saat ini aplikasi hanya mendukung 3 font PDF Standard (`Helvetica`, `Times`, `Courier`) yang terbatas pada karakter Latin dan tidak memiliki pilihan yang cocok untuk sertifikat pemerintah formal. Tujuan fitur ini adalah menambahkan 10 font Google Fonts populer dengan 4 weight (Regular, Bold, Italic, Bold Italic) yang dapat digunakan secara konsisten di preview Konva.js maupun output PDF melalui pdf-lib.

---

## 2. Arsitektur

Sistem font bekerja di dua layer yang harus sinkron:

```
Editor Preview (Konva.js)          PDF Generator (pdf-lib)
       │                                    │
Google Fonts via <link> di         TTF files di /public/fonts/
index.html (load via browser)      fetch() → ArrayBuffer → embedFont()
       │                                    │
fontFamily + fontStyle CSS         fontBytes di-embed ke PDF (subset: true)
```

### Dependency Baru

```bash
npm install @pdf-lib/fontkit
```

---

## 3. Data Model

### Perubahan `src/types.ts`

Field `font` dihapus dan diganti dua field baru:

```ts
// SEBELUM
font: 'Helvetica' | 'Times' | 'Courier';

// SESUDAH
fontFamily: string;
fontWeight: 'Regular' | 'Bold' | 'Italic' | 'BoldItalic';
```

Default untuk field baru pada pembuatan field baru:
- `fontFamily: 'Playfair Display'`
- `fontWeight: 'Regular'`

Migrasi data lama: field yang masih punya `font` lama (`Helvetica`/`Times`/`Courier`) akan fallback ke `Playfair Display / Regular` saat dibaca.

---

## 4. Font Registry

### File baru: `src/lib/fontRegistry.ts`

```ts
export const FONT_FAMILIES = [
  // Formal & Elegan
  { label: 'Playfair Display', value: 'Playfair Display', hasItalic: true },
  { label: 'EB Garamond',      value: 'EB Garamond',      hasItalic: true },
  { label: 'Cinzel',           value: 'Cinzel',            hasItalic: false },
  { label: 'Merriweather',     value: 'Merriweather',      hasItalic: true },
  { label: 'Lato',             value: 'Lato',              hasItalic: true },
  // Modern & Bersih
  { label: 'Montserrat',       value: 'Montserrat',        hasItalic: true },
  { label: 'Roboto',           value: 'Roboto',            hasItalic: true },
  { label: 'Open Sans',        value: 'Open Sans',         hasItalic: true },
  { label: 'Raleway',          value: 'Raleway',           hasItalic: true },
  // Karakter Indonesia
  { label: 'Noto Serif',       value: 'Noto Serif',        hasItalic: true },
] as const;

export const FONT_WEIGHTS = [
  { label: 'Regular',     value: 'Regular' },
  { label: 'Bold',        value: 'Bold' },
  { label: 'Italic',      value: 'Italic' },
  { label: 'Bold Italic', value: 'BoldItalic' },
] as const;

export type FontWeight = typeof FONT_WEIGHTS[number]['value'];
```

Catatan: `Cinzel` tidak memiliki varian Italic di Google Fonts — dropdown Italic dan Bold Italic di-disable saat font ini dipilih.

---

## 5. File Font (TTF)

### Lokasi: `public/fonts/`

Naming convention: `{FamilyNoBold}-{Weight}.ttf`  
Contoh: `PlayfairDisplay-Regular.ttf`, `EBGaramond-BoldItalic.ttf`

**Daftar file (36 file total, ~3–5MB):**

| Family | Regular | Bold | Italic | BoldItalic |
|--------|---------|------|--------|------------|
| PlayfairDisplay | ✓ | ✓ | ✓ | ✓ |
| EBGaramond | ✓ | ✓ | ✓ | ✓ |
| Cinzel | ✓ | ✓ | — | — |
| Merriweather | ✓ | ✓ | ✓ | ✓ |
| Lato | ✓ | ✓ | ✓ | ✓ |
| Montserrat | ✓ | ✓ | ✓ | ✓ |
| Roboto | ✓ | ✓ | ✓ | ✓ |
| OpenSans | ✓ | ✓ | ✓ | ✓ |
| Raleway | ✓ | ✓ | ✓ | ✓ |
| NotoSerif | ✓ | ✓ | ✓ | ✓ |

Font diunduh dari Google Fonts dan di-commit ke repo. Tidak ada fetch runtime ke Google CDN untuk PDF.

---

## 6. UI — FieldProperties

### File: `src/components/editor/FieldProperties.tsx`

Dua dropdown menggantikan satu dropdown font lama:

```
[ Font Family          ▼ ]   ← dropdown 1: pilih font family
                               setiap option ditampilkan dengan fontFamily-nya sendiri
[ Weight               ▼ ]   ← dropdown 2: Regular / Bold / Italic / Bold Italic
                               Italic & Bold Italic di-disable jika hasItalic: false
```

Implementasi preview font di dropdown menggunakan inline `style={{ fontFamily: font.value }}` pada setiap `<option>`.

---

## 7. Preview Konva — EditorCanvas

### File: `src/components/editor/EditorCanvas.tsx`

```ts
// Helper: convert fontWeight ke format Konva
function konvaFontStyle(weight: string): string {
  switch (weight) {
    case 'Bold':       return 'bold'
    case 'Italic':     return 'italic'
    case 'BoldItalic': return 'bold italic'
    default:           return 'normal'
  }
}

// Konva Text node
<Text
  fontFamily={field.fontFamily}
  fontStyle={konvaFontStyle(field.fontWeight)}
  ...
/>
```

Google Fonts di-load via `<link>` di `index.html` — Konva otomatis menggunakan font yang benar tanpa logic tambahan.

---

## 8. PDF Renderer

### File: `src/lib/pdfRenderer.ts`

```ts
import fontkit from '@pdf-lib/fontkit'

// Mapping fontFamily + fontWeight → path TTF
function getFontPath(family: string, weight: string): string {
  const name = family.replace(/\s/g, '')  // 'Playfair Display' → 'PlayfairDisplay'
  return `/fonts/${name}-${weight}.ttf`
}

// Di dalam renderCertificate():
pdfDoc.registerFontkit(fontkit)

const fontCache = new Map<string, PDFFont>()
const getFont = async (family: string, weight: string): Promise<PDFFont> => {
  const key = `${family}-${weight}`
  if (!fontCache.has(key)) {
    const bytes = await fetch(getFontPath(family, weight)).then(r => r.arrayBuffer())
    fontCache.set(key, await pdfDoc.embedFont(bytes, { subset: true }))
  }
  return fontCache.get(key)!
}

// Saat render setiap field:
const font = await getFont(field.fontFamily, field.fontWeight)
```

`subset: true` digunakan agar hanya karakter yang dipakai yang di-embed — menjaga ukuran PDF tetap kecil.

---

## 9. index.html — Google Fonts

Tambah `<link>` Google Fonts di `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Cinzel:wght@400;700&family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,400;0,700;1,400;1,700&family=Open+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Raleway:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
```

---

## 10. File yang Diubah

| File | Jenis Perubahan |
|------|----------------|
| `src/types.ts` | Ganti `font` → `fontFamily` + `fontWeight` |
| `src/lib/fontRegistry.ts` | **Baru** — daftar 10 font + weight config |
| `index.html` | Tambah Google Fonts `<link>` |
| `public/fonts/*.ttf` | **Baru** — ~36 file TTF (~3–5MB total) |
| `src/components/editor/FieldProperties.tsx` | Dua dropdown menggantikan satu |
| `src/components/editor/EditorCanvas.tsx` | Gunakan `fontFamily` + `fontStyle` |
| `src/lib/pdfRenderer.ts` | Pakai fontkit + embed TTF custom |
| `package.json` | Tambah `@pdf-lib/fontkit` |

---

## 11. Hal yang Tidak Berubah

- Logika posisi teks (x, y, lebar, perataan) — tidak berubah
- Logika `fitFontSize` — tetap berfungsi, hanya ganti sumber font
- Komponen lain yang tidak terkait font — tidak disentuh
- Database schema Supabase — tidak berubah (field tersimpan sebagai JSON dalam kolom `fields`)
