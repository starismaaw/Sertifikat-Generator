import { useState, useMemo, useRef, useEffect } from 'react';
import type { CertEvent, FieldTipe } from '../../types';
import { parseFile, applyMapping, validateRows, type ValidatedRow } from '../../lib/dataImporter';
import { buildCertNumber } from '../../lib/numberFormatter';
import { claimNextNumber, getEvent } from '../../lib/eventStore';
import { resolveValues } from '../../lib/resolveValues';
import { renderCertificate } from '../../lib/pdfRenderer';
import { buildZip, downloadBlob } from '../../lib/download';
import { ColumnMapper } from './ColumnMapper';
import { BulkPreviewTable } from './BulkPreviewTable';
import { SendEmailPanel } from './SendEmailPanel';
import type { OutgoingCertificate } from '../../lib/emailSender';

type Phase = 'idle' | 'generating' | 'compressing' | 'complete';

export function GenerateBulk({ event, onGenerate }: { event: CertEvent; onGenerate?: (updated: CertEvent) => void }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldTipe, string>>>({});
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentName, setCurrentName] = useState('');
  const [done, setDone] = useState(0);
  const [emailColumn, setEmailColumn] = useState('');
  const [certificates, setCertificates] = useState<OutgoingCertificate[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

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
    setPhase('generating');
    setProgress(0);

    const files: { name: string; bytes: Uint8Array }[] = [];
    let idx = 0;

    try {
      // Phase 1: Generate all PDFs
      const outgoing: OutgoingCertificate[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (!mountedRef.current) return;
        const r = rows[i];
        if (!r.valid) continue;
        const nama = r.values.nama ?? '';
        setCurrentName(nama);
        const n = claimNextNumber(event.id);
        const values = resolveValues(event, r.values, n);
        const bytes = await renderCertificate(event, values);
        const numStr = String(n).padStart(event.nomorPadding, '0');
        const filename = `Sertifikat - ${numStr} - ${nama}.pdf`;
        const nomorRapi = buildCertNumber(event.polaNomor, n, event.nomorPadding, new Date(event.tanggal));
        files.push({ name: filename, bytes });
        outgoing.push({
          nama,
          email: (emailColumn ? raw[i]?.[emailColumn] ?? '' : '').trim(),
          filename,
          pdfBytes: bytes,
          vars: {
            nama,
            nomor: nomorRapi,
            acara: event.nama,
            tanggal: event.tanggal,
            peran: r.values.peran ?? '',
          },
        });
        idx++;
        setDone(idx);
        setProgress(Math.round((idx / validCount) * 100));
      }

      // Phase 2: Compress ZIP
      if (!mountedRef.current) return;
      setPhase('compressing');
      setCurrentName('');
      const zip = await buildZip(files);

      // Phase 3: Complete with checkmark
      if (!mountedRef.current) return;
      setPhase('complete');
      setProgress(100);
      await new Promise(r => setTimeout(r, 700)); // show checkmark briefly

      if (!mountedRef.current) return;
      downloadBlob(zip, `Sertifikat - ${event.nama}.zip`, 'application/zip');
      await new Promise(r => setTimeout(r, 400)); // let download init

      if (mountedRef.current) {
        setCertificates(outgoing);
        const updated = getEvent(event.id);
        if (updated) onGenerate?.(updated);
        setPhase('idle');
        setProgress(0);
        setDone(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (mountedRef.current) {
        setPhase('idle');
        setProgress(0);
        setDone(0);
      }
    }
  }

  const fillClass =
    phase === 'complete' ? 'apple-progress-fill complete' :
    phase === 'generating' ? 'apple-progress-fill shimmer' :
    phase === 'compressing' ? 'apple-progress-fill indeterminate' :
    'apple-progress-fill';

  const phaseLabel =
    phase === 'generating' ? 'Membuat sertifikat' :
    phase === 'compressing' ? 'Mengompres berkas ZIP' :
    phase === 'complete' ? 'Siap diunduh' :
    '';

  const barWidth =
    phase === 'compressing' ? 40 :
    phase === 'complete' ? 100 :
    progress;

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
          <ColumnMapper
            headers={headers}
            mapping={mapping}
            onChange={remap}
            emailColumn={emailColumn}
            onEmailChange={setEmailColumn}
          />
          <div className="apple-flex-row apple-mb-sm">
            <span className="apple-caption">{validCount} valid</span>
            <span className="apple-caption">·</span>
            <span className="apple-caption">{rows.length} baris</span>
          </div>
          <BulkPreviewTable rows={rows} numbers={previewNumbers} />
          <div className="apple-mt-md">
            {phase === 'idle' ? (
              <button className="apple-btn apple-btn-primary apple-btn-lg" onClick={generate}>
                Generate & Unduh ZIP
              </button>
            ) : (
              <div ref={panelRef}
                className="apple-progress-panel enter"
                style={{ maxHeight: 200, opacity: 1 }}>
                <div className="apple-progress">
                  <div className="apple-progress-header">
                    <span className="apple-progress-phase">
                      {phase === 'complete' ? (
                        <span className="apple-progress-check">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M5 8.5L7 10.5L11 6" stroke="currentColor" strokeWidth="1.5"
                              strokeLinecap="round" strokeLinejoin="round"
                              strokeDasharray="30" strokeDashoffset="0"
                              style={{ animation: 'apple-checkmark-draw 0.4s ease forwards' }} />
                          </svg>
                          Siap diunduh
                        </span>
                      ) : phaseLabel}
                    </span>
                    <span className="apple-progress-percent">
                      {phase === 'compressing' ? '' : `${progress}%`}
                    </span>
                  </div>
                  <div className="apple-progress-track">
                    <div className={fillClass} style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="apple-progress-detail">
                    <span className="apple-progress-current">
                      {phase === 'generating' && currentName
                        ? `${done + 1} dari ${validCount} · ${currentName}`
                        : phase === 'compressing'
                          ? `Mengemas ${validCount} sertifikat ke dalam ZIP`
                          : phase === 'complete'
                            ? `${validCount} sertifikat berhasil dibuat`
                            : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          {certificates.length > 0 && (
            <SendEmailPanel eventId={event.id} certificates={certificates}>
              <h4 className="apple-h4 apple-mb-sm">Kirim via Email</h4>
              <SendEmailPanel.TemplateEditor />
              <SendEmailPanel.RecipientTable />
              <SendEmailPanel.SendButton />
            </SendEmailPanel>
          )}
        </>
      )}
    </div>
  );
}
