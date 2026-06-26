export const FONT_FAMILIES = [
  { label: 'Playfair Display', value: 'Playfair Display', hasItalic: true },
  { label: 'EB Garamond',      value: 'EB Garamond',      hasItalic: true },
  { label: 'Cinzel',           value: 'Cinzel',            hasItalic: false },
  { label: 'Merriweather',     value: 'Merriweather',      hasItalic: true },
  { label: 'Lato',             value: 'Lato',              hasItalic: true },
  { label: 'Montserrat',       value: 'Montserrat',        hasItalic: true },
  { label: 'Roboto',           value: 'Roboto',            hasItalic: true },
  { label: 'Open Sans',        value: 'Open Sans',         hasItalic: true },
  { label: 'Raleway',          value: 'Raleway',           hasItalic: true },
  { label: 'Noto Serif',       value: 'Noto Serif',        hasItalic: true },
] as const;

export const FONT_WEIGHTS = [
  { label: 'Regular',     value: 'Regular' },
  { label: 'Bold',        value: 'Bold' },
  { label: 'Italic',      value: 'Italic' },
  { label: 'Bold Italic', value: 'BoldItalic' },
] as const;

export type FontWeight = 'Regular' | 'Bold' | 'Italic' | 'BoldItalic';

export const DEFAULT_FONT_FAMILY = 'Playfair Display';
export const DEFAULT_FONT_WEIGHT: FontWeight = 'Regular';

export function toFontFileName(family: string): string {
  return family.replace(/\s/g, '');
}

// PENTING: gunakan .woff bukan .ttf
export function getFontPath(family: string, weight: FontWeight): string {
  return `/fonts/${toFontFileName(family)}-${weight}.woff`;
}
