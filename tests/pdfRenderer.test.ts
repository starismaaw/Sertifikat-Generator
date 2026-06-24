import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderCertificate, PNG_1x1 } from '../src/lib/pdfRenderer';
import type { CertEvent } from '../src/types';

function makeEvent(): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: PNG_1x1, bgWidth: 800, bgHeight: 600,
    fields: [{
      id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
      font: 'Helvetica', ukuran: 32, warna: '#000000', perataan: 'center', formatter: 'none',
    }],
    polaNomor: '{n}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
    penandatangan: { nama: 'Dr. X', jabatan: 'Kepala' },
  };
}

describe('renderCertificate', () => {
  it('produces a valid PDF sized to the natural background dimensions', async () => {
    const bytes = await renderCertificate(makeEvent(), { nama: 'Budi' });
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(800);
    expect(Math.round(page.getHeight())).toBe(600);
  });

  it('returns non-empty bytes', async () => {
    const bytes = await renderCertificate(makeEvent(), { nama: 'Budi' });
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
