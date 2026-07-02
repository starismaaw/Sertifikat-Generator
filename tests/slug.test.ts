import { describe, it, expect } from 'vitest';
import { slugify, isValidSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('mengubah spasi jadi tanda hubung dan huruf jadi kecil', () => {
    expect(slugify('Pelatihan Juli 2026')).toBe('pelatihan-juli-2026');
  });

  it('mengganti karakter selain huruf/angka dengan tanda hubung', () => {
    expect(slugify('Rapat & Evaluasi (Q3)!')).toBe('rapat-evaluasi-q3');
  });

  it('menggabungkan tanda hubung berurutan jadi satu', () => {
    expect(slugify('A   B---C')).toBe('a-b-c');
  });

  it('memotong hasil ke maksimum 60 karakter tanpa menyisakan tanda hubung di akhir', () => {
    const longName = 'kata '.repeat(20);
    const result = slugify(longName);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith('-')).toBe(false);
  });

  it('mengembalikan string kosong bila input hanya simbol', () => {
    expect(slugify('!!!###')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('menerima slug yang valid', () => {
    expect(isValidSlug('pelatihan-juli-2026')).toBe(true);
  });

  it('menolak slug dengan huruf besar', () => {
    expect(isValidSlug('Pelatihan-Juli')).toBe(false);
  });

  it('menolak slug lebih pendek dari 3 karakter', () => {
    expect(isValidSlug('ab')).toBe(false);
  });

  it('menolak slug dengan tanda hubung di awal/akhir', () => {
    expect(isValidSlug('-pelatihan')).toBe(false);
    expect(isValidSlug('pelatihan-')).toBe(false);
  });

  it('menolak slug dengan karakter selain huruf/angka/tanda hubung', () => {
    expect(isValidSlug('pelatihan_juli')).toBe(false);
  });
});
