import type { Field } from '../types';
import { browserTextWidth, toCssFont } from './pdfRenderer';

/** Tinggi minimum (px, sudah di-scale) kotak tanda tangan interaktif, supaya tetap
 *  nyaman digambar dengan jari di layar sempit meski field aslinya kecil. */
export const MIN_SIGNATURE_HEIGHT = 140;

/** Lebar minimum (px, sudah di-scale), setara MIN_SIGNATURE_HEIGHT — area gambar
 *  tetap nyaman dipakai jari walau field aslinya sempit. Independen dari tinggi
 *  (lihat catatan di computeSignatureBox soal kenapa keduanya TIDAK boleh berbagi
 *  satu faktor pembesaran). */
export const MIN_SIGNATURE_WIDTH = 140;

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
 * Lebar & tinggi masing-masing diusahakan mencapai minimumnya sendiri
 * (MIN_SIGNATURE_WIDTH / MIN_SIGNATURE_HEIGHT) SECARA INDEPENDEN, lalu
 * di-clamp terpisah ke containerW/containerH supaya tidak pernah melebihi
 * batas dokumen. Keduanya SENGAJA tidak berbagi satu faktor pembesaran
 * (growFactor) yang mempertahankan rasio lebar:tinggi asli field —
 * pendekatan itu sudah dicoba dan menimbulkan dua bug bolak-balik:
 *
 * 1. Kalau growFactor dihitung dari sisi tinggi lalu dipakai juga untuk
 *    lebar (guna mempertahankan rasio), untuk field lebar-tapi-pendek (mis.
 *    400x120) growFactor bisa sangat besar di layar sempit, sehingga lebar
 *    hasil kali growFactor jadi rumus TANPA scale sama sekali
 *    (rawWidth * (MIN_HEIGHT/rawHeight) = (field.lebar/field.tinggi) *
 *    MIN_HEIGHT) — device-independent, dan setelah di-clamp ke containerW
 *    kotak jadi selebar HAMPIR SELURUH dokumen di layar mobile, walau field
 *    aslinya cuma sebagian kecil lebar dokumen (bug: "kotak TTD melebar
 *    sangat jauh dari field template").
 * 2. Kalau growFactor sebaliknya dibatasi/dipepetkan oleh batas lebar
 *    (containerW), tinggi ikut kepepet kecil (mis. 105px, bukan 140px)
 *    karena berbagi faktor yang sama dengan lebar.
 *
 * Dengan lebar & tinggi independen, kedua bug di atas tidak mungkin terjadi
 * lagi: masing-masing dimensi hanya boleh membesar sampai minimumnya sendiri
 * dan tidak pernah melebihi ukuran dokumen. Trade-off: rasio kotak di layar
 * bisa berbeda dari field.lebar:tinggi saat salah satu dimensi field jauh
 * lebih kecil dari minimumnya — dampaknya sekadar sedikit peregangan
 * proporsi coretan tanda tangan saat di-stretch ke ukuran field asli di PDF,
 * jauh lebih baik daripada kotak yang jauh lebih besar/kecil dari field
 * aslinya.
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

  const width = Math.min(Math.max(rawWidth, MIN_SIGNATURE_WIDTH), containerW);
  const height = Math.min(Math.max(rawHeight, MIN_SIGNATURE_HEIGHT), containerH);

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
