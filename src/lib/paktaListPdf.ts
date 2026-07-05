import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface PaktaListRow {
  nama: string;
  nip: string;
  status: string;
  waktuTtd: string;
}

const PAGE_W = 841.89; // A4 landscape (pt)
const PAGE_H = 595.28;
const MARGIN = 40;
const ROW_HEIGHT = 16;

const COLS = [
  { label: 'Nama', width: 400 },
  { label: 'NIP', width: 110 },
  { label: 'Status', width: 70 },
  { label: 'Waktu TTD', width: 140 },
] as const;

function drawTableHeader(page: PDFPage, font: PDFFont, y: number): void {
  let x = MARGIN;
  for (const col of COLS) {
    page.drawText(col.label, { x, y, size: 10, font, color: rgb(0, 0, 0) });
    x += col.width;
  }
}

/** Bangun laporan PDF rekap tabel signer (A4 landscape, auto page-break). */
export async function buildPaktaListPdf(
  eventNama: string,
  eventTanggal: string,
  sudahCount: number,
  totalCount: number,
  rows: PaktaListRow[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawHeader(): void {
    page.drawText(eventNama, { x: MARGIN, y, size: 14, font: fontBold });
    y -= 18;
    page.drawText(eventTanggal, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 16;
    page.drawText(`Sudah ${sudahCount} / Total ${totalCount} (Belum ${totalCount - sudahCount})`, {
      x: MARGIN, y, size: 10, font,
    });
    y -= 24;
    drawTableHeader(page, fontBold, y);
    y -= ROW_HEIGHT;
  }

  drawHeader();

  let pageNum = 1;

  for (const row of rows) {
    if (y < MARGIN + ROW_HEIGHT) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = PAGE_H - MARGIN;
      drawTableHeader(page, fontBold, y);
      y -= ROW_HEIGHT;
    }
    let x = MARGIN;
    const values = [row.nama, row.nip, row.status, row.waktuTtd];
    values.forEach((val, i) => {
      page.drawText(val, { x, y, size: 9, font });
      x += COLS[i].width;
    });
    y -= ROW_HEIGHT;
  }

  if (pageNum > 1) {
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`Halaman ${i + 1} / ${pages.length}`, {
        x: PAGE_W - MARGIN - 80,
        y: MARGIN / 2,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    });
  }

  return doc.save();
}
