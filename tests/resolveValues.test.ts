import { describe, it, expect } from 'vitest';
import { resolveValues } from '../src/lib/resolveValues';
import type { CertEvent } from '../src/types';

const event: CertEvent = {
  id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
  background: 'data:,', bgWidth: 800, bgHeight: 600, fields: [],
  polaNomor: '{n}/{tahun}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
  penandatangan: { nama: 'Dr. X', jabatan: 'Kepala' },
};

describe('resolveValues', () => {
  it('merges static event data with per-person values and a claimed number', () => {
    const v = resolveValues(event, { nama: 'Budi', peran: 'Peserta' }, 7);
    expect(v.nama).toBe('Budi');
    expect(v.peran).toBe('Peserta');
    expect(v.acara).toBe('Pelatihan A');
    expect(v.tanggal).toBe('2026-06-15');
    expect(v.namaPenandatangan).toBe('Dr. X');
    expect(v.penandatangan).toBe('Kepala');
    expect(v.nomor).toBe('007/2026');
  });
});
