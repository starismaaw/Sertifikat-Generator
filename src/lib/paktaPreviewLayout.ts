import type { Field } from '../types';
import { browserTextWidth } from './pdfRenderer';

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

  const growFactor = rawHeight > 0 ? Math.max(1, MIN_SIGNATURE_HEIGHT / rawHeight) : 1;
  const width = rawWidth * growFactor;
  const height = rawHeight * growFactor;

  const centerX = rawLeft + rawWidth / 2;
  const centerY = rawTop + rawHeight / 2;

  const containerW = bgWidth * scale;
  const containerH = bgHeight * scale;

  const left = clamp(centerX - width / 2, 0, Math.max(0, containerW - width));
  const top = clamp(centerY - height / 2, 0, Math.max(0, containerH - height));

  return { left, top, width, height };
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
