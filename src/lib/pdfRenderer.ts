import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { CertEvent, Field, FieldValues } from '../types';
import { getFontPath, type FontWeight } from './fontRegistry';

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

function toCssFont(fontFamily: string, fontWeight: FontWeight, size: number): string {
  const italic = fontWeight === 'Italic' || fontWeight === 'BoldItalic';
  const bold   = fontWeight === 'Bold'   || fontWeight === 'BoldItalic';
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px "${fontFamily}"`;
}

// Use browser canvas measurement so PDF centering matches the Konva preview exactly.
// Falls back to pdf-lib AFM metrics when canvas is unavailable (test / SSR env).
function browserTextWidth(
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

/** Template Pakta minimal untuk rendering (tanpa ketergantungan tipe backend). */
export interface PaktaTemplate {
  background: string;   // data URL
  bgWidth: number;      // lebar natural px
  bgHeight: number;     // tinggi natural px
  fields: Field[];
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

  for (const field of template.fields) {
    if (field.tipe === 'tandaTangan') {
      if (!signaturePng) continue;
      const sig = await doc.embedPng(dataUrlToBytes(signaturePng));
      const h = field.tinggi ?? field.lebar / 2;
      // field.y = TOP kotak; konversi ke origin bawah pdf-lib.
      page.drawImage(sig, {
        x: field.x,
        y: template.bgHeight - field.y - h,
        width: field.lebar,
        height: h,
      });
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
