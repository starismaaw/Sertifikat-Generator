import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { FieldTipe, FieldValues } from '../types';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ValidatedRow {
  values: FieldValues;
  valid: boolean;
  warning?: string;
}

export function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).filter(Boolean);
  return { headers, rows: result.data };
}

/** Parse an .xlsx/.xls ArrayBuffer (first sheet). */
export function parseXlsx(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Dispatch by file extension. CSV is read as text; Excel as ArrayBuffer. */
export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(await file.text());
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXlsx(await file.arrayBuffer());
  }
  throw new Error('Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls');
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: Partial<Record<FieldTipe, string>>,
): FieldValues[] {
  return rows.map(row => {
    const out: FieldValues = {};
    for (const [tipe, col] of Object.entries(mapping)) {
      if (col) out[tipe as FieldTipe] = (row[col] ?? '').trim();
    }
    return out;
  });
}

export function validateRows(rows: FieldValues[]): ValidatedRow[] {
  return rows.map(values => {
    const nama = (values.nama ?? '').trim();
    return nama
      ? { values, valid: true }
      : { values, valid: false, warning: 'Baris tanpa nama — akan dilewati' };
  });
}
