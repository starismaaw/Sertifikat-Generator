import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { renderCertificate, renderPakta, PNG_1x1 } from '../src/lib/pdfRenderer';
import type { CertEvent, PaktaTemplate } from '../src/types';

function makeEvent(): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: PNG_1x1, bgWidth: 800, bgHeight: 600,
    fields: [{
      id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
      fontFamily: 'Playfair Display', fontWeight: 'Regular',
      ukuran: 32, warna: '#000000', perataan: 'center', formatter: 'none',
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

function makePaktaTemplate(fields: PaktaTemplate['fields']): PaktaTemplate {
  return { background: PNG_1x1, bgWidth: 800, bgHeight: 600, fields };
}

/** Decode page content stream(s) to string for coordinate verification. */
async function pageContentText(doc: PDFDocument, pageIndex = 0): Promise<string> {
  const page = doc.getPage(pageIndex);
  const contentsRef = page.node.get(PDFName.of('Contents'));
  const parts: string[] = [];

  const decode = (ref: PDFRef) => {
    const obj = doc.context.lookup(ref);
    if (obj instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(obj).decode();
      parts.push(new TextDecoder().decode(decoded));
    }
  };

  if (contentsRef instanceof PDFRef) {
    decode(contentsRef);
  } else if (contentsRef instanceof PDFArray) {
    for (const item of contentsRef.asArray()) {
      if (item instanceof PDFRef) decode(item);
    }
  }
  return parts.join('\n');
}

/** Hitung jumlah image XObject (latar + tanda tangan) dalam PDF. */
function countImages(doc: PDFDocument): number {
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream &&
        obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
      n++;
    }
  }
  return n;
}

describe('renderPakta', () => {
  it('menghasilkan PDF seukuran latar dengan field teks terisi', async () => {
    const tpl = makePaktaTemplate([
      { id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' },
      { id: 'f2', tipe: 'nip', x: 100, y: 240, lebar: 600,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 18, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi', nip: '19850101' }, null);
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(800);
    expect(Math.round(page.getHeight())).toBe(600);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it('menyisipkan gambar tanda tangan saat field tandaTangan ada', async () => {
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 500, y: 400, lebar: 200, tinggi: 100,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);

    const tanpa = await PDFDocument.load(await renderPakta(tpl, {}, null));
    const dengan = await PDFDocument.load(await renderPakta(tpl, {}, PNG_1x1));

    // Tanpa ttd: hanya latar (1 image). Dengan ttd: latar + ttd (2 image).
    expect(countImages(tanpa)).toBe(1);
    expect(countImages(dengan)).toBe(2);
  });

  it('mengabaikan signaturePng bila tidak ada field tandaTangan', async () => {
    const tpl = makePaktaTemplate([
      { id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const doc = await PDFDocument.load(await renderPakta(tpl, { nama: 'Budi' }, PNG_1x1));
    expect(countImages(doc)).toBe(1); // hanya latar
  });

  it('tetap menghasilkan PDF valid bila field tandaTangan ada tapi belum digores', async () => {
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 500, y: 400, lebar: 200, tinggi: 100,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, null);
    const doc = await PDFDocument.load(bytes);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(800);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it('menempatkan PNG tanda tangan pada koordinat field yang benar', async () => {
    // x=50, y=100, lebar=300, tinggi=150, bgHeight=600
    // y_pdf = bgHeight - y - tinggi = 600 - 100 - 150 = 350
    // pdf-lib decomposes drawImage into stacked cm operators:
    //   "1 0 0 1 50 350 cm"  ← translation to (x=50, y_pdf=350)
    //   "300 0 0 150 0 0 cm" ← scale to (width=300, height=150)
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 300, tinggi: 150,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    // Y-flip formula: bgHeight(600) - y(100) - tinggi(150) = 350
    // Verify translation (x, y_pdf) and scale (width, height) are present
    expect(content).toContain('1 0 0 1 50 350 cm');
    expect(content).toContain('300 0 0 150 0 0 cm');
  });
});
