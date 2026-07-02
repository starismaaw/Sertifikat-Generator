import type { Field } from '../types';
import { browserTextWidth, toCssFont } from './pdfRenderer';

/** Tinggi minimum (px, sudah di-scale) kotak tanda tangan interaktif, supaya tetap
 *  nyaman digambar dengan jari di layar sempit meski field aslinya kecil. */
export const MIN_SIGNATURE_HEIGHT = 140;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Kotak tanda tangan interaktif, hasil scale field 'tandaTangan' dengan batas
 * bawah ukuran MIN_SIGNATURE_HEIGHT. Bila kotak hasil scale lebih kecil dari batas,
 * kotak dibesarkan proporsional (mempertahankan rasio lebar:tinggi asli) dan
 * dipusatkan pada titik tengah kotak aslinya, lalu di-clamp agar tidak keluar
 * dari batas dokumen (mis. field yang dekat pojok kiri/atas).
 *
 * Pembesaran itu sendiri juga dibatasi supaya kotak tidak pernah melebihi lebar/
 * tinggi dokumen (containerW/containerH) — di layar sempit dengan field kecil,
 * growFactor untuk mencapai MIN_SIGNATURE_HEIGHT bisa membuat width jauh lebih
 * lebar dari dokumen itu sendiri. Bila dibatasi, tinggi akhir boleh kurang dari
 * MIN_SIGNATURE_HEIGHT — lebih baik daripada kotak "melebar keluar dari template".
 */
export function computeSignatureBox(
  field: Pick<Field, 'x' | 'y' | 'lebar' | 'tinggi'>,
  scale: number,
  bgWidth: number,
  bgHeight: number,
): SignatureBox {
  const rawWidth = field.lebar * scale;
  const rawHeight = (field.tinggi ?? field.lebar / 2) * scale;
  const rawLeft = field.x * scale;
  const rawTop = field.y * scale;

  const containerW = bgWidth * scale;
  const containerH = bgHeight * scale;

  const growFactorForHeight = rawHeight > 0 ? Math.max(1, MIN_SIGNATURE_HEIGHT / rawHeight) : 1;
  const growFactorWidthCap = rawWidth > 0 ? containerW / rawWidth : growFactorForHeight;
  const growFactorHeightCap = rawHeight > 0 ? containerH / rawHeight : growFactorForHeight;
  const growFactor = Math.max(1, Math.min(growFactorForHeight, growFactorWidthCap, growFactorHeightCap));

  const width = rawWidth * growFactor;
  const height = rawHeight * growFactor;

  const centerX = rawLeft + rawWidth / 2;
  const centerY = rawTop + rawHeight / 2;

  const left = clamp(centerX - width / 2, 0, Math.max(0, containerW - width));
  const top = clamp(centerY - height / 2, 0, Math.max(0, containerH - height));

  return { left, top, width, height };
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
