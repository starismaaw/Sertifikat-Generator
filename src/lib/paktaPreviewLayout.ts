import type { Field } from '../types';
import { browserTextWidth, toCssFont } from './pdfRenderer';

/** scale = lebar kontainer / lebar natural background. 1 bila belum bisa diukur. */
export function computeScale(containerWidth: number, bgWidth: number): number {
  if (bgWidth <= 0 || containerWidth <= 0) return 1;
  return containerWidth / bgWidth;
}

export interface SignatureBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Kotak tanda tangan interaktif, hasil scale field 'tandaTangan' APA ADANYA
 * -- tanpa pembesaran/minimum apapun. Rasio & ukuran kotak SELALU sama
 * persis dengan field asli (cuma discale), di SEMUA device (mobile,
 * tablet, desktop) -- sama seperti field teks lain, tidak diperlakukan
 * istimewa. Ini SENGAJA: minimum kenyamanan sentuh yang pernah ada di sini
 * (lihat riwayat git) justru jadi akar penyebab dua bug berikutnya (kotak
 * melebar keluar dokumen, lalu tanda tangan hasil PDF menyusut lebih kecil
 * dari field karena scaleToFit menyusutkan sisi yang rasionya tidak cocok
 * lagi dengan field) -- root cause sebenarnya, bukan solusinya. Trade-off
 * yang diterima: field TTD yang didesain kecil di editor akan menghasilkan
 * kotak gambar yang kecil juga di layar sempit, tanpa proteksi otomatis.
 *
 * `_bgWidth`/`_bgHeight` sengaja dipertahankan di signature (diawali `_`
 * supaya lolos `noUnusedParameters`) walau tidak dipakai lagi di badan
 * fungsi -- supaya pemanggil (`PaktaDocumentPreview.tsx`) tidak perlu
 * diubah.
 */
export function computeSignatureBox(
  field: Pick<Field, 'x' | 'y' | 'lebar' | 'tinggi'>,
  scale: number,
  _bgWidth: number,
  _bgHeight: number,
): SignatureBox {
  return {
    left: field.x * scale,
    top: field.y * scale,
    width: field.lebar * scale,
    height: (field.tinggi ?? field.lebar / 2) * scale,
  };
}

/**
 * Ascent font (jarak baseline ke atas glyph, px) pada ukuran tertentu, diukur lewat
 * canvas — dipakai untuk memposisikan teks SVG persis di baseline yang tepat, sama
 * seperti pdfRenderer.ts (ascent-based) & Konva Text, bukan lewat kotak baris CSS.
 * CSS line-height/line-box TIDAK bisa dipakai untuk ini: font seperti Inter punya
 * ascent+descent bawaan jauh lebih besar dari 1em, jadi walau line-height:1 diset,
 * posisi glyph tetap turun beberapa px dari batas atas kotak (dikonfirmasi manual
 * di browser). Fallback size*0.8 dipakai saat canvas 2d context tidak tersedia
 * (mis. jsdom di lingkungan test).
 */
export function measureFontAscent(
  fontFamily: Field['fontFamily'],
  fontWeight: Field['fontWeight'],
  size: number,
): number {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return size * 0.8;
    ctx.font = toCssFont(fontFamily, fontWeight, size);
    // Teks probe tidak memengaruhi fontBoundingBoxAscent (metrik font, bukan per-glyph).
    const m = ctx.measureText('Hg');
    return m.fontBoundingBoxAscent || size * 0.8;
  } catch {
    return size * 0.8;
  }
}

/** Kecilkan font sampai muat dalam field.lebar (min 6px), sama seperti fitFontSize
 *  di pdfRenderer.ts tapi untuk ukuran CSS yang sudah di-scale untuk layar. */
export function fitFontSizeCss(
  text: string,
  field: Pick<Field, 'fontFamily' | 'fontWeight' | 'ukuran' | 'lebar'>,
): number {
  let size = field.ukuran;
  while (
    size > 6 &&
    browserTextWidth(text, field.fontFamily, field.fontWeight, size, () => text.length * size * 0.5) >
      field.lebar
  ) {
    size -= 1;
  }
  return size;
}
