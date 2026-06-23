import { describe, it, expect } from 'vitest';
import { parseCsv, applyMapping, validateRows } from '../src/lib/dataImporter';
import type { FieldTipe } from '../src/types';

const csv = 'Nama,Jabatan\nBudi,Peserta\n,Narasumber\nSiti,Peserta\n';

describe('parseCsv', () => {
  it('extracts headers and rows', () => {
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(['Nama', 'Jabatan']);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ Nama: 'Budi', Jabatan: 'Peserta' });
  });
});

describe('applyMapping', () => {
  it('maps file columns to field tipe', () => {
    const { rows } = parseCsv(csv);
    const mapping: Partial<Record<FieldTipe, string>> = { nama: 'Nama', peran: 'Jabatan' };
    const mapped = applyMapping(rows, mapping);
    expect(mapped[0]).toEqual({ nama: 'Budi', peran: 'Peserta' });
  });
});

describe('validateRows', () => {
  it('flags rows with blank nama', () => {
    const { rows } = parseCsv(csv);
    const mapped = applyMapping(rows, { nama: 'Nama' });
    const result = validateRows(mapped);
    expect(result[0].valid).toBe(true);
    expect(result[1].valid).toBe(false);   // blank nama
    expect(result[1].warning).toMatch(/nama/i);
    expect(result[2].valid).toBe(true);
  });
});
