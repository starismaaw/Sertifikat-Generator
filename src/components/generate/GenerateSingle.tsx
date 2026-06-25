import { useState } from 'react';
import type { CertEvent } from '../../types';
import { claimNextNumber, getEvent } from '../../lib/eventStore';
import { resolveValues } from '../../lib/resolveValues';
import { renderCertificate } from '../../lib/pdfRenderer';
import { downloadBlob } from '../../lib/download';
import { CertPreviewMini } from './CertPreviewMini';

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v9M4.5 8.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GenerateSingle({ event, onGenerate }: { event: CertEvent; onGenerate?: (updated: CertEvent) => void }) {
  const [nama, setNama] = useState('');
  const [peran, setPeran] = useState('Peserta');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const previewN = Math.max(event.nomorTerakhir + 1, event.nomorMulai);

  async function generate() {
    setError('');
    const trimmedNama = nama.trim();
    if (!trimmedNama) { setError('Nama wajib diisi'); return; }
    setBusy(true);
    try {
      const liveEvent = getEvent(event.id);
      if (!liveEvent) throw new Error('Acara tidak ditemukan');
      const n = Math.max(liveEvent.nomorTerakhir + 1, liveEvent.nomorMulai);
      const values = resolveValues(liveEvent, { nama: trimmedNama, peran }, n);
      const bytes = await renderCertificate(liveEvent, values);
      claimNextNumber(liveEvent.id);
      downloadBlob(bytes, `Sertifikat - ${trimmedNama}.pdf`);
      onGenerate?.(getEvent(liveEvent.id) ?? liveEvent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sg-two-col">
      {/* Form */}
      <div className="sg-card">
        <div className="sg-card-pad">
          <div className="sg-section-eyebrow">Data Penerima</div>

          <div className="sg-form-group">
            <label className="sg-label" htmlFor="sg-nama">
              Nama <span style={{ color: 'var(--color-accent-red)' }}>*</span>
            </label>
            <input
              id="sg-nama"
              className="sg-input"
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Nama peserta"
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>

          <div className="sg-form-group">
            <label className="sg-label" htmlFor="sg-peran">Peran</label>
            <select
              id="sg-peran"
              className="sg-select"
              value={peran}
              onChange={e => setPeran(e.target.value)}
            >
              <option>Peserta</option>
              <option>Narasumber</option>
              <option>Panitia</option>
            </select>
            <div className="sg-hint">Peserta · Narasumber · Panitia</div>
          </div>

          {error && <div className="apple-error" style={{ marginTop: 8 }}>{error}</div>}

          <button
            className="sg-btn sg-btn-primary sg-btn-pill"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 8 }}
            disabled={busy}
            onClick={generate}
          >
            <DownloadIcon />
            {busy ? 'Memproses…' : 'Unduh PDF'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div>
        <CertPreviewMini
          event={event}
          nama={nama}
          peran={peran}
          previewN={previewN}
        />
      </div>
    </div>
  );
}
