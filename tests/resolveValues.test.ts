import { describe, it, expect } from 'vitest';
import { resolveValues } from '../src/lib/resolveValues';
import type { CertEvent, Field } from '../src/types';

function makeEvent(fieldOverrides: Partial<Field>[] = []): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: 'data:,', bgWidth: 800, bgHeight: 600,
    fields: fieldOverrides.map((o, i) => ({
      id: `f${i}`, tipe: 'nama', x: 0, y: 0, lebar: 100,
      font: 'Helvetica', ukuran: 24, warna: '#000000', perataan: 'center',
      formatter: 'none',
      ...o,
    })) as Field[],
    polaNomor: '{n}/{tahun}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
    penandatangan: { nama: 'Dr. X', jabatan: 'Kepala' },
  };
}

const event: CertEvent = makeEvent();

describe('resolveValues', () => {
  it('merges static event data with per-person values and a claimed number', () => {
    const v = resolveValues(event, { nama: 'Budi', peran: 'Peserta' }, 7);
    expect(v.nama).toBe('Budi');
    expect(v.peran).toBe('Peserta');
    expect(v.acara).toBe('Pelatihan A');
    expect(v.tanggal).toBe('2026-06-15');
    expect(v.namaPenandatangan).toBe('Dr. X');
    expect(v.penandatangan).toBe('Kepala');
    expect(v.nomor).toBe('Nomor: 007/2026');
  });

  // WHY: formatter uppercase harus mengubah nama menjadi kapital semua di output sertifikat.
  it('mengubah nama menjadi uppercase jika formatter === uppercase', () => {
    const ev = makeEvent([{ tipe: 'nama', formatter: 'uppercase' }]);
    const result = resolveValues(ev, { nama: 'budi santoso' }, 1);
    expect(result.nama).toBe('BUDI SANTOSO');
  });

  // WHY: formatter none tidak boleh mengubah nama.
  it('tidak mengubah nama jika formatter none', () => {
    const ev = makeEvent([{ tipe: 'nama', formatter: 'none' }]);
    const result = resolveValues(ev, { nama: 'budi santoso' }, 1);
    expect(result.nama).toBe('budi santoso');
  });
});
