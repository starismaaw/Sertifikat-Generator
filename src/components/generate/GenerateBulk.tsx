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
    <div className="apple-card">
      <h3 className="apple-h3 apple-mb-md">Massal</h3>
      <div className="apple-form-group">
        <label className="apple-label">Upload file peserta</label>
        <input className="apple-input" type="file" accept=".csv,.xlsx,.xls"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          style={{ padding: 8, fontSize: 14 }} />
        <span className="apple-hint">Format: CSV atau Excel (.xlsx/.xls)</span>
      </div>
      {error && <div className="apple-error">{error}</div>}
      {headers.length > 0 && (
        <>
          <ColumnMapper headers={headers} mapping={mapping} onChange={remap} />
          <div className="apple-flex-row apple-mb-sm">
            <span className="apple-caption">{validCount} valid</span>
            <span className="apple-caption">·</span>
            <span className="apple-caption">{rows.length} baris</span>
          </div>
          <BulkPreviewTable rows={rows} numbers={previewNumbers} />
          <div className="apple-flex-row apple-mt-md">
            <button className="apple-btn apple-btn-primary apple-btn-lg" disabled={progress !== null} onClick={generate}>
              {progress === null ? 'Generate & Unduh ZIP' : `Memproses… ${progress}%`}
            </button>
            {progress !== null && (
              <div className="apple-progress" style={{ flex: 1 }}>
                <div className="apple-progress-track">
                  <div className="apple-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="apple-progress-label">{progress}%</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
