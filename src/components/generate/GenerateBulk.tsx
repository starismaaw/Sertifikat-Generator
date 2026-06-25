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
import { StepperBar, type StepDef } from './StepperBar';
import type { OutgoingCertificate } from '../../lib/emailSender';

type Phase = 'idle' | 'generating' | 'compressing' | 'complete';

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 17v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" />
      <polyline points="20 9 14 3 8 9" />
      <line x1="14" y1="3" x2="14" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.5v4M8 5.5v.5" />
    </svg>
  );
}

export function GenerateBulk({ event, onGenerate }: { event: CertEvent; onGenerate?: (updated: CertEvent) => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
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
      setFileName(file.name);
      const guess = parsed.headers.find(h => /nama/i.test(h));
      const m: Partial<Record<FieldTipe, string>> = guess ? { nama: guess } : {};
      setMapping(m);
      setRows(validateRows(applyMapping(parsed.rows, m)));
      setStep(2);
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
    const yield_ = () => new Promise<void>(r => setTimeout(r, 0));

    try {
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
          vars: { nama, nomor: nomorRapi, acara: event.nama, tanggal: event.tanggal, peran: r.values.peran ?? '' },
        });
        idx++;
        setDone(idx);
        setProgress(Math.round((idx / validCount) * 100));
        await yield_();
      }

      if (!mountedRef.current) return;
      setPhase('compressing');
      setCurrentName('');
      const zip = await buildZip(files);

      if (!mountedRef.current) return;
      setPhase('complete');
      setProgress(100);
      await new Promise(r => setTimeout(r, 700));

      if (!mountedRef.current) return;
      downloadBlob(zip, `Sertifikat - ${event.nama}.zip`, 'application/zip');
      await new Promise(r => setTimeout(r, 400));

      if (mountedRef.current) {
        setCertificates(outgoing);
        const updated = getEvent(event.id);
        if (updated) onGenerate?.(updated);
        setPhase('idle');
        setProgress(0);
        setDone(0);
        setStep(4);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (mountedRef.current) { setPhase('idle'); setProgress(0); setDone(0); }
    }
  }

  // Stepper configuration
  const steps: StepDef[] = [
    { label: 'Unggah berkas', status: step > 1 ? 'done' : step === 1 ? 'active' : 'future' },
    { label: 'Petakan kolom', status: step > 2 ? 'done' : step === 2 ? 'active' : 'future' },
    { label: 'Pratinjau', status: step > 3 ? 'done' : step === 3 ? 'active' : 'future' },
    { label: 'Unduh', status: step === 4 ? 'active' : 'future' },
  ];

  const isGenerating = phase !== 'idle';

  return (
    <div>
      <StepperBar steps={steps} />

      {error && <div className="apple-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="sg-card sg-card-pad">
          <div
            className={`sg-drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="sg-drop-icon-wrap"><UploadIcon /></div>
            <div className="sg-drop-title">Letakkan berkas di sini, atau telusuri</div>
            <div className="sg-drop-subtitle">Mendukung format Excel (.xlsx) dan CSV · maksimal 500 baris</div>
            <button
              className="sg-btn sg-btn-primary sg-btn-pill"
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Pilih berkas
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="sg-info-box" style={{ marginTop: 16 }}>
            <InfoIcon />
            <span>Berkas sebaiknya memiliki kolom <strong>Nama</strong>, <strong>Peran</strong>, dan <strong>Email</strong> (opsional). Baris pertama dianggap sebagai judul kolom.</span>
          </div>
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && (
        <div className="sg-card sg-card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>Petakan kolom</h3>
            <span style={{
              fontSize: 11.5, fontWeight: 600, padding: '3px 10px',
              borderRadius: 9999, background: 'rgba(26,174,57,0.1)', color: '#138a2e',
            }}>
              {fileName} · {raw.length} baris
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 20 }}>
            Cocokkan kolom dari berkas Anda dengan field sertifikat.
          </p>
          <ColumnMapper
            headers={headers}
            mapping={mapping}
            onChange={remap}
            emailColumn={emailColumn}
            onEmailChange={setEmailColumn}
            sampleRows={raw.slice(0, 3)}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setStep(1)}>← Kembali</button>
            <button
              className="sg-btn sg-btn-primary"
              onClick={() => { if (mapping.nama) setStep(3); else setError('Kolom Nama wajib dipetakan'); }}
            >
              Lanjut ke pratinjau →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & validate */}
      {step === 3 && (
        <div className="sg-card" style={{ overflow: 'hidden' }}>
          <BulkPreviewTable rows={rows} numbers={previewNumbers} />
          <div style={{
            background: 'var(--color-canvas-soft)',
            borderTop: '1px solid var(--color-hairline)',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setStep(2)}>← Kembali</button>
            <button
              className="sg-btn sg-btn-primary sg-btn-pill"
              style={{ fontSize: 14, padding: '9px 20px' }}
              disabled={isGenerating}
              onClick={generate}
            >
              {isGenerating ? 'Memproses…' : `Buat & unduh ZIP (${validCount})`}
            </button>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div className="sg-spinner" />
                <span style={{ fontSize: 14, color: 'var(--color-ink)' }}>
                  {phase === 'generating' ? `${done + 1} dari ${validCount} · ${currentName}` :
                   phase === 'compressing' ? 'Mengemas berkas ZIP…' : 'Selesai'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>
                  {progress}%
                </span>
              </div>
              <div className="apple-progress-track">
                <div
                  className={`apple-progress-fill ${phase === 'generating' ? 'shimmer' : phase === 'compressing' ? 'indeterminate' : 'complete'}`}
                  style={{ width: `${phase === 'compressing' ? 40 : progress}%` }}
                />
              </div>
              <div className="sg-phase-cards">
                <div className={`sg-phase-card ${done > 0 ? 'done' : ''}`}>
                  <div className="sg-phase-card-label">Membuat PDF</div>
                  <div className="sg-phase-card-status">
                    {phase === 'generating' ? <span className="sg-spinner" /> :
                     (phase === 'compressing' || phase === 'complete') ? '✓' : ''}
                    {phase === 'generating' ? 'Berlangsung' :
                     (phase === 'compressing' || phase === 'complete') ? 'Selesai' : 'Menunggu'}
                  </div>
                </div>
                <div className={`sg-phase-card ${phase === 'compressing' ? 'active' : ''}`}>
                  <div className="sg-phase-card-label">Render halaman</div>
                  <div className="sg-phase-card-status">
                    {phase === 'compressing' ? <span className="sg-spinner" /> : ''}
                    {phase === 'compressing' ? 'Berlangsung' : 'Menunggu'}
                  </div>
                </div>
                <div className={`sg-phase-card ${phase === 'complete' ? 'done' : ''}`}>
                  <div className="sg-phase-card-label">Kompres ZIP</div>
                  <div className="sg-phase-card-status">
                    {phase === 'complete' ? '✓ Selesai' : 'Menunggu'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Email */}
      {step === 4 && certificates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <SendEmailPanel eventId={event.id} certificates={certificates}>
            <SendEmailPanel.TemplateEditor />
            <SendEmailPanel.RecipientTable />
            <SendEmailPanel.SendButton />
          </SendEmailPanel>
        </div>
      )}
    </div>
  );
}
