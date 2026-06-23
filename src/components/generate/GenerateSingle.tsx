import { useState } from 'react';
import type { CertEvent } from '../../types';
import { claimNextNumber, getEvent } from '../../lib/eventStore';
import { resolveValues } from '../../lib/resolveValues';
import { renderCertificate } from '../../lib/pdfRenderer';
import { downloadBlob } from '../../lib/download';

export function GenerateSingle({ event }: { event: CertEvent }) {
  const [nama, setNama] = useState('');
  const [peran, setPeran] = useState('Peserta');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setError('');
    const trimmedNama = nama.trim();
    if (!trimmedNama) { setError('Nama wajib diisi'); return; }
    setBusy(true);
    try {
      const liveEvent = getEvent(event.id);
      if (!liveEvent) throw new Error('Acara tidak ditemukan');
      const previewN = Math.max(liveEvent.nomorTerakhir + 1, liveEvent.nomorMulai);
      const values = resolveValues(liveEvent, { nama: trimmedNama, peran }, previewN);
      const bytes = await renderCertificate(liveEvent, values);
      claimNextNumber(liveEvent.id);
      downloadBlob(bytes, `Sertifikat - ${trimmedNama}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="apple-card">
      <span className="apple-eyebrow">Cetak Satu</span>
      <h3 className="apple-h3 apple-mb-md">Satuan</h3>
      <div className="apple-flex-row">
        <div className="apple-form-group" style={{ flex: 1 }}>
          <label className="apple-label">Nama <span className="apple-fine">*</span></label>
          <input className="apple-input" value={nama} onChange={e => setNama(e.target.value)}
            placeholder="Nama peserta" />
        </div>
        <div className="apple-form-group">
          <label className="apple-label">Peran</label>
          <select className="apple-select" value={peran} onChange={e => setPeran(e.target.value)}>
            <option>Peserta</option><option>Narasumber</option><option>Panitia</option>
          </select>
        </div>
      </div>
      {error && <div className="apple-error">{error}</div>}
      <button className="apple-btn apple-btn-primary apple-btn-lg apple-mt-sm" disabled={busy} onClick={generate}>
        {busy ? 'Memproses…' : 'Unduh PDF'}
      </button>
    </div>
  );
}
