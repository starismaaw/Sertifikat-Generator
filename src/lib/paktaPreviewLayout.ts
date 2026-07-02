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
 * Kotak tanda tangan interaktif, hasil scale field 'tandaTangan'.
 *
 * Tinggi SELALU diusahakan mencapai MIN_SIGNATURE_HEIGHT (supaya nyaman digambar
 * dengan jari) — hanya dibatasi containerH bila dokumen itu sendiri lebih pendek
 * dari itu (kasus langka). Lebar dibesarkan proporsional mengikuti pertumbuhan
 * tinggi (mempertahankan rasio lebar:tinggi asli field bila memungkinkan), tapi
 * DIBATASI TERPISAH agar tidak pernah melebihi lebar dokumen (containerW).
 *
 * Catatan: tinggi & lebar dibatasi secara TERPISAH (bukan satu growFactor
 * bersama) supaya field TTD yang lebar-tapi-pendek (umum untuk area tanda
 * tangan bergaya garis) tidak membuat tinggi ikut terpepet kecil hanya karena
 * lebarnya kena batas dokumen di layar sempit — sebelumnya ini menyebabkan
 * kotak gambar jadi sangat cebol (mis. 105px, bukan 140px) di mobile, sehingga
 * tanda tangan yang digambar terlihat kecil/renggang saat di-stretch ke ukuran
 * field asli di PDF akhir. Trade-off: rasio kotak di layar bisa sedikit beda
 * dari field.lebar:tinggi saat lebar kena batas — dampaknya sekadar sedikit
 * peregangan proporsi coretan tanda tangan, jauh lebih dapat diterima daripada
 * area gambar yang terlalu sempit.
 *
 * Posisi (left/top) tetap dipusatkan pada titik tengah kotak field aslinya,
 * lalu di-clamp agar tidak keluar dari batas dokumen (mis. field dekat pojok).
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

  const targetHeight = Math.max(rawHeight, MIN_SIGNATURE_HEIGHT);
  const height = Math.min(targetHeight, containerH);

  const heightGrowFactor = rawHeight > 0 ? height / rawHeight : 1;
  const proportionalWidth = rawWidth * heightGrowFactor;
  const width = Math.min(proportionalWidth, containerW);

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
