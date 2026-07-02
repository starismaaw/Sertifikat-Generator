import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CertEvent, Field, FieldValues, PaktaTemplate } from '../types';
import { getFontPath, WEIGHT_CSS, type FontWeight } from './fontRegistry';

/** A 1x1 transparent PNG data URL — handy default/test background. */
export const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Shrink font size until the text fits within field.lebar (min 6pt). */
function fitFontSize(text: string, field: Field, font: PDFFont): number {
  let size = field.ukuran;
  while (size > 6 && font.widthOfTextAtSize(text, size) > field.lebar) size -= 1;
  return size;
}

export function toCssFont(fontFamily: string, fontWeight: FontWeight, size: number): string {
  const { weight, italic } = WEIGHT_CSS[fontWeight];
  return `${italic ? 'italic ' : ''}${weight} ${size}px "${fontFamily}"`;
}

// Use browser canvas measurement so PDF centering matches the Konva preview exactly.
// Falls back to pdf-lib AFM metrics when canvas is unavailable (test / SSR env).
export function browserTextWidth(
  text: string,
  fontFamily: string,
  fontWeight: FontWeight,
  size: number,
  afmFallback: () => number,
): number {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return afmFallback();
    ctx.font = toCssFont(fontFamily, fontWeight, size);
    return ctx.measureText(text).width;
  } catch {
    return afmFallback();
  }
}

function alignedX(text: string, field: Field, font: PDFFont, size: number): number {
  const w = browserTextWidth(
    text,
    field.fontFamily,
    field.fontWeight,
    size,
    () => font.widthOfTextAtSize(text, size),
  );
  if (field.perataan === 'center') return field.x + (field.lebar - w) / 2;
  if (field.perataan === 'right')  return field.x + field.lebar - w;
  return field.x;
}

/** Gambar latar (PNG/JPG data URL) memenuhi seluruh halaman. */
async function drawBackground(
  doc: PDFDocument,
  page: PDFPage,
  background: string,
  width: number,
  height: number,
): Promise<void> {
  const bytes = dataUrlToBytes(background);
  const img = background.includes('image/png')
    ? await doc.embedPng(bytes)
    : await doc.embedJpg(bytes);
  page.drawImage(img, { x: 0, y: 0, width, height });
}

/** Buat pengambil font dengan cache + fallback Helvetica untuk satu dokumen. */
function makeFontGetter(doc: PDFDocument) {
  const fontCache = new Map<string, PDFFont>();
  return async (family: string, weight: FontWeight): Promise<PDFFont> => {
    const key = `${family}-${weight}`;
    if (!fontCache.has(key)) {
      try {
        const res = await fetch(getFontPath(family, weight));
        if (!res.ok) throw new Error(`Font fetch failed: ${getFontPath(family, weight)}`);
        const bytes = await res.arrayBuffer();
        fontCache.set(key, await doc.embedFont(bytes, { subset: true }));
      } catch {
        fontCache.set(key, await doc.embedFont(StandardFonts.Helvetica));
      }
    }
    return fontCache.get(key)!;
  };
}

/** Gambar satu field teks (perataan + penyusutan font + konversi koordinat top→baseline). */
async function drawTextField(
  page: PDFPage,
  field: Field,
  text: string,
  getFont: (family: string, weight: FontWeight) => Promise<PDFFont>,
  pageHeight: number,
): Promise<void> {
  const font = await getFont(field.fontFamily, field.fontWeight);
  const size = fitFontSize(text, field, font);
  // field.y = TOP kotak teks (Konva: origin kiri-atas, y ke bawah).
  // pdf-lib drawText y = BASELINE (origin kiri-bawah, y ke atas).
  const ascent = font.heightAtSize(size, { descender: false });
  page.drawText(text, {
    x: alignedX(text, field, font, size),
    y: pageHeight - field.y - ascent,
    size,
    font,
    color: hexToRgb(field.warna),
  });
}

/**
 * Gambar field gabungan Nama & NIP: baris nama (bergaris bawah, lebar garis
 * mengikuti lebar teks) lalu baris "NIP. <nip>" satu tinggi-baris di bawahnya.
 */
async function drawNamaNipField(
  page: PDFPage,
  field: Field,
  nama: string,
  nip: string,
  getFont: (family: string, weight: FontWeight) => Promise<PDFFont>,
  pageHeight: number,
): Promise<void> {
  const font = await getFont(field.fontFamily, field.fontWeight);
  const lineHeight = field.ukuran * 1.4;
  const color = hexToRgb(field.warna);

  // Baris 1: nama, bergaris bawah pas selebar teks.
  const namaSize = fitFontSize(nama, field, font);
  const namaAscent = font.heightAtSize(namaSize, { descender: false });
  const namaX = alignedX(nama, field, font, namaSize);
  const namaY = pageHeight - field.y - namaAscent;
  page.drawText(nama, { x: namaX, y: namaY, size: namaSize, font, color });

  const namaWidth = browserTextWidth(
    nama,
    field.fontFamily,
    field.fontWeight,
    namaSize,
    () => font.widthOfTextAtSize(nama, namaSize),
  );
  const underlineY = namaY - namaSize * 0.08;
  page.drawLine({
    start: { x: namaX, y: underlineY },
    end: { x: namaX + namaWidth, y: underlineY },
    thickness: Math.max(0.5, namaSize * 0.04),
    color,
  });

  // Baris 2: "NIP. <nip>", tanpa garis bawah. field.y = TOP baris 1;
  // TOP baris 2 = field.y + lineHeight (satu tinggi-baris di bawahnya).
  const nipText = `NIP. ${nip}`;
  const nipSize = fitFontSize(nipText, field, font);
  const nipAscent = font.heightAtSize(nipSize, { descender: false });
  page.drawText(nipText, {
    x: alignedX(nipText, field, font, nipSize),
    y: pageHeight - (field.y + lineHeight) - nipAscent,
    size: nipSize,
    font,
    color,
  });
}

/**
 * Render satu Pakta Integritas ke PDF.
 * `values` mengisi field teks; `signaturePng` (data URL) disisipkan pada field
 * bertipe 'tandaTangan'. Bila null, field tanda tangan dilewati.
 */
export async function renderPakta(
  template: PaktaTemplate,
  values: FieldValues,
  signaturePng: string | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([template.bgWidth, template.bgHeight]);
  await drawBackground(doc, page, template.background, template.bgWidth, template.bgHeight);

  const getFont = makeFontGetter(doc);

  const hasTandaTangan = template.fields.some(f => f.tipe === 'tandaTangan');
  const sigImage = (signaturePng && hasTandaTangan)
    ? await doc.embedPng(dataUrlToBytes(signaturePng))
    : null;

  for (const field of template.fields) {
    if (field.tipe === 'tandaTangan') {
      if (!sigImage) continue;
      const h = field.tinggi ?? field.lebar / 2;
      // Scale seragam (contain-fit, bukan stretch-fill) supaya tanda tangan tidak
      // melar/gepeng saat rasio kotak gambar interaktif (mis. persegi di mobile,
      // lihat computeSignatureBox di paktaPreviewLayout.ts) berbeda dari rasio
      // field asli. Lihat docs/superpowers/specs/2026-07-02-pakta-signature-natural-fit-design.md.
      const { width: w, height: hh } = sigImage.scaleToFit(field.lebar, h);
      // field.y = TOP kotak; konversi ke origin bawah pdf-lib. Gambar dipusatkan
      // di dalam kotak field pada sumbu yang tidak jadi faktor pembatas scale.
      page.drawImage(sigImage, {
        x: field.x + (field.lebar - w) / 2,
        y: template.bgHeight - field.y - h + (h - hh) / 2,
        width: w,
        height: hh,
      });
      continue;
    }
    if (field.tipe === 'namaNip') {
      const nama = (values.nama ?? '').toString();
      if (!nama) continue;
      await drawNamaNipField(page, field, nama, (values.nip ?? '').toString(), getFont, template.bgHeight);
      continue;
    }
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    await drawTextField(page, field, text, getFont, template.bgHeight);
  }

  return doc.save();
}

/** Render one certificate to PDF bytes. `values` supplies dynamic field text. */
export async function renderCertificate(
  event: CertEvent,
  values: FieldValues,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([event.bgWidth, event.bgHeight]);
  await drawBackground(doc, page, event.background, event.bgWidth, event.bgHeight);

  const getFont = makeFontGetter(doc);

  for (const field of event.fields) {
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;
    await drawTextField(page, field, text, getFont, event.bgHeight);
  }

  return doc.save();
}
