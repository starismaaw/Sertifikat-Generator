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

import { filterSigners } from '../src/lib/signerFilter';

interface TestSigner {
  id: string;
  nama: string;
  nip: string;
  status: 'sudah' | 'belum';
}

const SIGNERS: TestSigner[] = [
  { id: '1', nama: 'Ahmad Budiman', nip: '111', status: 'sudah' },
  { id: '2', nama: 'Siti Aminah', nip: '222', status: 'belum' },
  { id: '3', nama: 'Budi Santoso', nip: '333', status: 'belum' },
];

describe('filterSigners', () => {
  it('mengembalikan semua signer saat statusFilter "semua" dan query kosong', () => {
    expect(filterSigners(SIGNERS, 'semua', '')).toEqual(SIGNERS);
  });

  it('memfilter hanya status "sudah"', () => {
    const result = filterSigners(SIGNERS, 'sudah', '');
    expect(result.map(s => s.id)).toEqual(['1']);
  });

  it('memfilter hanya status "belum"', () => {
    const result = filterSigners(SIGNERS, 'belum', '');
    expect(result.map(s => s.id)).toEqual(['2', '3']);
  });

  it('menggabungkan filter status DAN pencarian nama (AND, bukan OR)', () => {
    const result = filterSigners(SIGNERS, 'belum', 'budi');
    expect(result.map(s => s.id)).toEqual(['3']);
  });

  it('mengembalikan array kosong kalau filter status dan pencarian tidak ada yang cocok', () => {
    const result = filterSigners(SIGNERS, 'sudah', 'siti');
    expect(result).toEqual([]);
  });

  it('mencocokkan pencarian terhadap NIP juga, bukan hanya nama', () => {
    const result = filterSigners(SIGNERS, 'semua', '222');
    expect(result.map(s => s.id)).toEqual(['2']);
  });
});
