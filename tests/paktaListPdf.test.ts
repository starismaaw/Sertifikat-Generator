import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { buildPaktaListPdf, type PaktaListRow } from '../src/lib/paktaListPdf';

/** Decode page content stream(s) to string (pola sama seperti tests/pdfRenderer.test.ts). */
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

/** Hitung jumlah token operator PDF tertentu (mis. 'Tj' untuk teks) di content stream. */
function countTokens(content: string, token: string): number {
  return content.split(/\s+/).filter(t => t === token).length;
}

function makeRows(n: number): PaktaListRow[] {
  return Array.from({ length: n }, (_, i) => ({
    nama: `Pegawai ${i + 1}`,
    nip: `NIP${i + 1}`,
    status: i % 2 === 0 ? 'Sudah' : 'Belum',
    waktuTtd: i % 2 === 0 ? '01/01/2026 10.00.00' : '—',
  }));
}

describe('buildPaktaListPdf', () => {
  it('menghasilkan satu halaman A4 landscape untuk data sedikit', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 1, 2, makeRows(2));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPage(0);
    expect(Math.round(page.getWidth())).toBe(842);
    expect(Math.round(page.getHeight())).toBe(595);
  });

  it('menggambar header (judul+tanggal+ringkasan+4 kolom) dan satu baris teks per kolom per baris data', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 1, 2, makeRows(2));
    const doc = await PDFDocument.load(bytes);
    const content = await pageContentText(doc, 0);
    // header: judul + tanggal + ringkasan + 4 label kolom (Nama, NIP, Status, Waktu TTD) = 7 Tj
    // 2 baris data x 4 kolom = 8 Tj
    expect(countTokens(content, 'Tj')).toBe(15);
  });

  it('membuat halaman baru (page break) kalau baris melebihi satu halaman', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 20, 40, makeRows(40));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('mengulang header kolom di halaman kedua saat page break terjadi', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 20, 40, makeRows(40));
    const doc = await PDFDocument.load(bytes);
    const contentPage2 = await pageContentText(doc, 1);
    // minimal 4 Tj untuk label kolom yang diulang di halaman baru
    expect(countTokens(contentPage2, 'Tj')).toBeGreaterThanOrEqual(4);
  });

  it('bytes yang dihasilkan tidak kosong', async () => {
    const bytes = await buildPaktaListPdf('Pakta Integritas 2026', '01 Januari 2026', 1, 2, makeRows(2));
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
