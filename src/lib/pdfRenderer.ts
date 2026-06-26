import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
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

/** Render one certificate to PDF bytes. `values` supplies dynamic field text. */
export async function renderCertificate(
  event: CertEvent,
  values: FieldValues,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const page = doc.addPage([event.bgWidth, event.bgHeight]);

  const bgBytes = dataUrlToBytes(event.background);
  const img = event.background.includes('image/png')
    ? await doc.embedPng(bgBytes)
    : await doc.embedJpg(bgBytes);
  page.drawImage(img, { x: 0, y: 0, width: event.bgWidth, height: event.bgHeight });

  const fontCache = new Map<string, PDFFont>();

  const getFont = async (family: string, weight: FontWeight): Promise<PDFFont> => {
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

  for (const field of event.fields) {
    const text = (values[field.tipe] ?? '').toString();
    if (!text) continue;

    const font = await getFont(field.fontFamily, field.fontWeight);
    const size = fitFontSize(text, field, font);
    // field.y is the TOP of the text box (Konva origin: top-left, y grows down).
    // pdf-lib drawText y is the BASELINE (origin: bottom-left, y grows up).
    // Subtract ascent so the visual top of the PDF text aligns with field.y.
    const ascent = font.heightAtSize(size, { descender: false });
    page.drawText(text, {
      x: alignedX(text, field, font, size),
      y: event.bgHeight - field.y - ascent,
      size,
      font,
      color: hexToRgb(field.warna),
    });
  }

  return doc.save();
}
