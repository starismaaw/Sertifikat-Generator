import { describe, it, expect } from 'vitest';
import { FONT_FAMILIES, FONT_WEIGHTS, WEIGHT_CSS, toKonvaFontStyle, isWeightDisabled } from '../src/lib/fontRegistry';

describe('fontRegistry SemiBold support', () => {
  it('includes SemiBold and SemiBoldItalic in FONT_WEIGHTS', () => {
    const values = FONT_WEIGHTS.map(w => w.value);
    expect(values).toContain('SemiBold');
    expect(values).toContain('SemiBoldItalic');
  });

  it('flags Lato as not having SemiBold, all others as having it', () => {
    const byName = Object.fromEntries(FONT_FAMILIES.map(f => [f.value, f]));
    expect(byName['Lato'].hasSemiBold).toBe(false);
    expect(byName['Open Sans'].hasSemiBold).toBe(true);
    expect(byName['Cinzel'].hasSemiBold).toBe(true);
    expect(byName['Playfair Display'].hasSemiBold).toBe(true);
  });

  it('maps every FontWeight to a numeric weight + italic flag', () => {
    expect(WEIGHT_CSS.Regular).toEqual({ weight: 400, italic: false });
    expect(WEIGHT_CSS.SemiBold).toEqual({ weight: 600, italic: false });
    expect(WEIGHT_CSS.Bold).toEqual({ weight: 700, italic: false });
    expect(WEIGHT_CSS.Italic).toEqual({ weight: 400, italic: true });
    expect(WEIGHT_CSS.SemiBoldItalic).toEqual({ weight: 600, italic: true });
    expect(WEIGHT_CSS.BoldItalic).toEqual({ weight: 700, italic: true });
  });

  it('toKonvaFontStyle produces Konva-compatible fontStyle strings', () => {
    expect(toKonvaFontStyle('Regular')).toBe('normal');
    expect(toKonvaFontStyle('Bold')).toBe('700');
    expect(toKonvaFontStyle('SemiBold')).toBe('600');
    expect(toKonvaFontStyle('Italic')).toBe('italic');
    expect(toKonvaFontStyle('SemiBoldItalic')).toBe('italic 600');
    expect(toKonvaFontStyle('BoldItalic')).toBe('italic 700');
  });

  it('isWeightDisabled disables SemiBold variants for families without hasSemiBold', () => {
    const lato = FONT_FAMILIES.find(f => f.value === 'Lato')!;
    const openSans = FONT_FAMILIES.find(f => f.value === 'Open Sans')!;
    const cinzel = FONT_FAMILIES.find(f => f.value === 'Cinzel')!;

    expect(isWeightDisabled('SemiBold', lato)).toBe(true);
    expect(isWeightDisabled('SemiBoldItalic', lato)).toBe(true);
    expect(isWeightDisabled('SemiBold', openSans)).toBe(false);
    expect(isWeightDisabled('SemiBoldItalic', openSans)).toBe(false);
    expect(isWeightDisabled('SemiBold', cinzel)).toBe(false);
    expect(isWeightDisabled('SemiBoldItalic', cinzel)).toBe(true); // no italic at all
    expect(isWeightDisabled('Regular', undefined)).toBe(false);
  });
});
