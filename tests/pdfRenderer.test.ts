import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { renderCertificate, renderPakta, PNG_1x1, toCssFont, browserTextWidth } from '../src/lib/pdfRenderer';
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

/** Hitung token operator PDF tertentu (mis. 'Tj' untuk teks, 'S' untuk garis) di content stream. */
function countTokens(content: string, token: string): number {
  return content.split(/\s+/).filter(t => t === token).length;
}

/** Ambil semua nilai Y dari operator text-matrix "1 0 0 1 x y Tm", berurutan sesuai kemunculan. */
function extractTmYValues(content: string): number[] {
  const matches = [...content.matchAll(/^1 0 0 1 [-\d.]+ (-?[\d.]+) Tm$/gm)];
  return matches.map(m => parseFloat(m[1]));
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

  it('menempatkan PNG tanda tangan proporsional (contain-fit) & terpusat saat rasio gambar beda dari rasio field', async () => {
    // Gambar sumber PNG_1x1 persegi (1x1) dimasukkan ke field lebar-pendek (300x150).
    // scaleToFit(300, 150) pada gambar 1x1: imgWidthScale=300, imgHeightScale=150,
    // scale=min(300,150)=150 -> hasil 150x150 (persegi, TIDAK stretch jadi 300x150).
    // Dipusatkan secara horizontal (sumbu yang tidak jadi faktor pembatas):
    //   x = field.x + (field.lebar - 150)/2 = 50 + 75 = 125
    //   y_pdf = bgHeight - field.y - h + (h - hh)/2 = 600-100-150 + (150-150)/2 = 350
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 300, tinggi: 150,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(content).toContain('1 0 0 1 125 350 cm');
    expect(content).toContain('150 0 0 150 0 0 cm');
    // Tidak boleh lagi mengandung stretch lama (300x150 non-uniform)
    expect(content).not.toContain('300 0 0 150 0 0 cm');
  });

  it('tidak mengubah hasil saat rasio gambar sudah sama dengan rasio field (tidak regresi)', async () => {
    // Field persegi (200x200) + gambar persegi (PNG_1x1, 1x1) -> scaleToFit tidak
    // perlu memusatkan apa pun (w=200=field.lebar, hh=200=h), identik dengan
    // stretch-fill lama untuk kasus rasio yang sudah cocok (mis. desktop).
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 200, tinggi: 200,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(content).toContain('1 0 0 1 50 300 cm');
    expect(content).toContain('200 0 0 200 0 0 cm');
  });

  it('memakai fallback tinggi (lebar/2) sebagai tinggi kotak untuk scaleToFit saat field.tinggi tidak diisi', async () => {
    // field.tinggi tidak diisi -> h fallback = field.lebar/2 = 300/2 = 150, sama
    // persis dengan test contain-fit di atas -> hasil harus identik (125, 350, 150x150).
    const tpl = makePaktaTemplate([
      { id: 's1', tipe: 'tandaTangan', x: 50, y: 100, lebar: 300,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 12, warna: '#000000', perataan: 'left', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, {}, PNG_1x1);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(content).toContain('1 0 0 1 125 350 cm');
    expect(content).toContain('150 0 0 150 0 0 cm');
  });

  it('field namaNip: menggambar 2 baris teks + 1 garis bawah saat nama & NIP terisi', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi Santoso', nip: '198501012010011001' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(countTokens(content, 'Tj')).toBe(2);
    expect(countTokens(content, 'S')).toBe(1);
  });

  it('field namaNip: baris NIP tetap tampil ("NIP. " saja) walau data NIP kosong', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi Santoso' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(countTokens(content, 'Tj')).toBe(2);
    expect(countTokens(content, 'S')).toBe(1);
  });

  it('field namaNip: dilewati total (tanpa teks/garis) bila nama kosong', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nip: '198501012010011001' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    expect(countTokens(content, 'Tj')).toBe(0);
    expect(countTokens(content, 'S')).toBe(0);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(800);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it('field namaNip: baris NIP tepat 1 tinggi-baris (ukuran*1.4) di bawah baris nama', async () => {
    const tpl = makePaktaTemplate([
      { id: 'nn1', tipe: 'namaNip', x: 100, y: 400, lebar: 400,
        fontFamily: 'Playfair Display', fontWeight: 'Regular',
        ukuran: 20, warna: '#000000', perataan: 'center', formatter: 'none' },
    ]);
    const bytes = await renderPakta(tpl, { nama: 'Budi Santoso', nip: '198501012010011001' }, null);
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc);
    const [y1, y2] = extractTmYValues(content);
    expect(y1 - y2).toBeCloseTo(20 * 1.4, 1);
  });
});

describe('toCssFont', () => {
  it('produces the correct CSS font string for every weight', () => {
    expect(toCssFont('Open Sans', 'Regular', 32)).toBe('400 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'SemiBold', 32)).toBe('600 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'Bold', 32)).toBe('700 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'Italic', 32)).toBe('italic 400 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'SemiBoldItalic', 32)).toBe('italic 600 32px "Open Sans"');
    expect(toCssFont('Open Sans', 'BoldItalic', 32)).toBe('italic 700 32px "Open Sans"');
  });
});

describe('browserTextWidth', () => {
  it('mengembalikan angka via afmFallback saat canvas 2d context tidak tersedia (lingkungan test)', () => {
    const width = browserTextWidth('Contoh Teks', 'Inter', 'Regular', 20, () => 123);
    expect(typeof width).toBe('number');
    expect(width).toBe(123);
  });
});
