import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildXlsx } from '../src/lib/download';

describe('buildXlsx', () => {
  it('menghasilkan file xlsx dengan baris dan kolom yang sesuai', () => {
    const rows = [
      { Nama: 'Ahmad Budiman', NIP: '111', Status: 'Sudah' },
      { Nama: 'Siti Aminah', NIP: '222', Status: 'Belum' },
    ];
    const bytes = buildXlsx(rows, 'Pakta');
    const wb = XLSX.read(bytes);
    expect(wb.SheetNames).toEqual(['Pakta']);
    const parsed = XLSX.utils.sheet_to_json(wb.Sheets['Pakta']);
    expect(parsed).toEqual(rows);
  });

  it('menghasilkan sheet tanpa baris data kalau rows kosong', () => {
    const bytes = buildXlsx([], 'Pakta');
    const wb = XLSX.read(bytes);
    const parsed = XLSX.utils.sheet_to_json(wb.Sheets['Pakta']);
    expect(parsed).toEqual([]);
  });

  it('memakai nama sheet default "Sheet1" kalau tidak diberikan', () => {
    const bytes = buildXlsx([{ A: '1' }]);
    const wb = XLSX.read(bytes);
    expect(wb.SheetNames).toEqual(['Sheet1']);
  });
});
