import { describe, it, expect } from 'vitest';
import { matchesSignerQuery } from '../src/lib/signerFilter';

describe('matchesSignerQuery', () => {
  it('mengembalikan true untuk semua nama saat query kosong', () => {
    expect(matchesSignerQuery('Ahmad Budiman', '')).toBe(true);
    expect(matchesSignerQuery('Ahmad Budiman', '   ')).toBe(true);
  });

  it('mencocokkan substring, bukan hanya prefix', () => {
    expect(matchesSignerQuery('Ahmad Budiman', 'budi')).toBe(true);
    expect(matchesSignerQuery('Ahmad Budiman', 'man')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(matchesSignerQuery('Ahmad Budiman', 'AHMAD')).toBe(true);
    expect(matchesSignerQuery('Ahmad Budiman', 'ahmad')).toBe(true);
  });

  it('mengembalikan false kalau tidak ada kecocokan', () => {
    expect(matchesSignerQuery('Ahmad Budiman', 'siti')).toBe(false);
  });

  it('mengabaikan spasi di awal/akhir query', () => {
    expect(matchesSignerQuery('Ahmad Budiman', '  ahmad  ')).toBe(true);
  });
});
