import { useState, useMemo } from 'react';
import type { CertEvent, FieldTipe } from '../../types';
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
  const validCount = useMemo(() => rows.filter(r => r.valid).length, [rows]);

  const previewNumbers = useMemo(() => {
    let seq = Math.max(event.nomorTerakhir + 1, event.nomorMulai);
    return rows.map(r =>
      r.valid ? buildCertNumber(event.polaNomor, seq++, event.nomorPadding, new Date(event.tanggal)) : ''
    );
  }, [rows, event]);

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
    setProgress(0);
    try {
      for (const r of rows) {
        if (!r.valid) continue;
        // Claim first to get authoritative number, then render.
        // Single-user internal tool — no concurrent writes in normal use.
        const n = claimNextNumber(event.id);
        const values = resolveValues(event, r.values, n);
        const bytes = await renderCertificate(event, values);
        files.push({ name: `Sertifikat - ${String(n).padStart(event.nomorPadding, '0')} - ${values.nama ?? ''}.pdf`, bytes });
        done++;
        setProgress(Math.round((done / validCount) * 100));
      }
      const zip = await buildZip(files);
      downloadBlob(zip, `Sertifikat - ${event.nama}.zip`, 'application/zip');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
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
