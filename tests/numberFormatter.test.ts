import { describe, it, expect } from 'vitest';
import { buildCertNumber, toRoman } from '../src/lib/numberFormatter';

describe('toRoman', () => {
  it('maps months 1-12 to Roman numerals', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(6)).toBe('VI');
    expect(toRoman(12)).toBe('XII');
  });
});

describe('buildCertNumber', () => {
  const date = new Date('2026-06-15');

  it('pads {n} to the requested width', () => {
    expect(buildCertNumber('{n}', 1, 3, date)).toBe('001');
    expect(buildCertNumber('{n}', 42, 4, date)).toBe('0042');
  });

  it('substitutes {bulan} as Roman and {tahun} as full year', () => {
    expect(buildCertNumber('{n}/SERT/P3KP/{bulan}/{tahun}', 7, 3, date))
      .toBe('007/SERT/P3KP/VI/2026');
  });

  it('leaves free text untouched and keeps unknown braces literal', () => {
    expect(buildCertNumber('NO-{n}-END', 5, 2, date)).toBe('NO-05-END');
    expect(buildCertNumber('{x}/{n}', 1, 1, date)).toBe('{x}/1');
  });

  it('does not pad numbers already wider than padding', () => {
    expect(buildCertNumber('{n}', 1234, 3, date)).toBe('1234');
  });
});
