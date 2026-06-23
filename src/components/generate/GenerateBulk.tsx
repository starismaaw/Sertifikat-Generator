import { useState } from 'react';
import type { CertEvent, FieldTipe, FieldValues } from '../../types';
import { parseFile, applyMapping, validateRows, type ValidatedRow } from '../../lib/dataImporter';
import { buildCertNumber } from '../../lib/numberFormatter';
import { claimNextNumber } from '../../lib/eventStore';
import { resolveValues } from '../../lib/resolveValues';
import { renderCertificate } from '../../lib/pdfRenderer';
import { buildZip, downloadBlob } from '../../lib/download';
import { ColumnMapper } from './ColumnMapper';
import { BulkPreviewTable } from './BulkPreviewTable';

export function GenerateBulk({ event }: { event: CertEvent }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldTipe, string>>>({});
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  // Preview numbers are illustrative (start from nomorTerakhir+1); real numbers
  // are claimed atomically at generation time so concurrent runs never collide.
  const validCount = rows.filter(r => r.valid).length;
  let seq = Math.max(event.nomorTerakhir + 1, event.nomorMulai);
  const previewNumbers = rows.map(r =>
    r.valid ? buildCertNumber(event.polaNomor, seq++, event.nomorPadding, new Date(event.tanggal)) : '');

  async function handleFile(file: File) {
    setError('');
    try {
      const parsed = await parseFile(file);
      if (parsed.headers.length === 0) throw new Error('File kosong atau header tidak terbaca');
      setHeaders(parsed.headers);
      setRaw(parsed.rows);
      const guess = parsed.headers.find(h => /nama/i.test(h));
      const m: Partial<Record<FieldTipe, string>> = guess ? { nama: guess } : {};
      setMapping(m);
      setRows(validateRows(applyMapping(parsed.rows, m)));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  function remap(m: Partial<Record<FieldTipe, string>>) {
    setMapping(m);
    setRows(validateRows(applyMapping(raw, m)));
  }

  async function generate() {
    if (!mapping.nama) { setError('Kolom Nama wajib dipetakan'); return; }
    if (validCount === 0) { setError('Tidak ada baris valid'); return; }
    setError('');
    const files: { name: string; bytes: Uint8Array }[] = [];
    let done = 0;
    for (const r of rows) {
      if (!r.valid) continue;
      // Render first with preview number so we don't claim a number for a failed render.
      // claimNextNumber reads live from storage each call, so sequential claims are safe.
      const startN = Math.max(event.nomorTerakhir + 1, event.nomorMulai);
      const previewN = startN + done;
      const previewValues: FieldValues = resolveValues(event, r.values, previewN);
      const bytes = await renderCertificate(event, previewValues);
      // Render succeeded — now claim atomically (returns the same number as previewN for sequential runs)
      claimNextNumber(event.id);
      files.push({ name: `Sertifikat - ${previewValues.nama}.pdf`, bytes });
      setProgress(Math.round((++done / validCount) * 100));
    }
    const zip = await buildZip(files);
    downloadBlob(zip, `Sertifikat - ${event.nama}.zip`, 'application/zip');
    setProgress(null);
  }

  return (
    <section>
      <h3>Massal</h3>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {headers.length > 0 && (
        <>
          <ColumnMapper headers={headers} mapping={mapping} onChange={remap} />
          <p>{validCount} valid / {rows.length} baris</p>
          <BulkPreviewTable rows={rows} numbers={previewNumbers} />
          <button disabled={progress !== null} onClick={generate} style={{ marginTop: 8 }}>
            {progress === null ? 'Generate & Unduh ZIP' : `Memproses… ${progress}%`}
          </button>
        </>
      )}
    </section>
  );
}
