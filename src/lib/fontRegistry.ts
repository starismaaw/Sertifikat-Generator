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

export const FONT_WEIGHTS = [
  { label: 'Regular',         value: 'Regular' },
  { label: 'SemiBold',        value: 'SemiBold' },
  { label: 'Bold',            value: 'Bold' },
  { label: 'Italic',          value: 'Italic' },
  { label: 'SemiBold Italic', value: 'SemiBoldItalic' },
  { label: 'Bold Italic',     value: 'BoldItalic' },
] as const;

export type FontWeight = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic' | 'SemiBold' | 'SemiBoldItalic';

export const DEFAULT_FONT_FAMILY = 'Playfair Display';
export const DEFAULT_FONT_WEIGHT: FontWeight = 'Regular';

/** Angka weight CSS + apakah italic, untuk tiap FontWeight — sumber tunggal dipakai
 *  oleh preview Konva (toKonvaFontStyle) dan pengukuran/canvas font di pdfRenderer. */
export const WEIGHT_CSS: Record<FontWeight, { weight: number; italic: boolean }> = {
  Regular:        { weight: 400, italic: false },
  SemiBold:       { weight: 600, italic: false },
  Bold:           { weight: 700, italic: false },
  Italic:         { weight: 400, italic: true },
  SemiBoldItalic: { weight: 600, italic: true },
  BoldItalic:     { weight: 700, italic: true },
};

/** Konversi FontWeight ke string `fontStyle` yang dipahami Konva/canvas. */
export function toKonvaFontStyle(weight: FontWeight): string {
  const { weight: w, italic } = WEIGHT_CSS[weight];
  const parts = [italic ? 'italic' : '', w !== 400 ? String(w) : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : 'normal';
}

type FontFamilyEntry = (typeof FONT_FAMILIES)[number];

/** Apakah opsi weight ini harus di-disable di dropdown untuk family yang dipilih
 *  (mis. Lato tidak punya cut 600, Cinzel tidak punya varian italic sama sekali). */
export function isWeightDisabled(weight: FontWeight, family: FontFamilyEntry | undefined): boolean {
  if (!family) return false;
  const isItalicVariant = weight === 'Italic' || weight === 'BoldItalic' || weight === 'SemiBoldItalic';
  const isSemiBoldVariant = weight === 'SemiBold' || weight === 'SemiBoldItalic';
  if (isItalicVariant && !family.hasItalic) return true;
  if (isSemiBoldVariant && !family.hasSemiBold) return true;
  return false;
}

export function toFontFileName(family: string): string {
  return family.replace(/\s/g, '');
}

// PENTING: gunakan .woff bukan .ttf
export function getFontPath(family: string, weight: FontWeight): string {
  return `/fonts/${toFontFileName(family)}-${weight}.woff`;
}
