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
      // read live event so previewN is never stale (user may have generated in bulk tab)
      const liveEvent = getEvent(event.id);
      if (!liveEvent) throw new Error('Acara tidak ditemukan');
      const previewN = Math.max(liveEvent.nomorTerakhir + 1, liveEvent.nomorMulai);
      const values = resolveValues(liveEvent, { nama: trimmedNama, peran }, previewN);
      // render may throw — number not claimed yet
      const bytes = await renderCertificate(liveEvent, values);
      // render succeeded — now claim atomically
      claimNextNumber(liveEvent.id);
      downloadBlob(bytes, `Sertifikat - ${trimmedNama}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>Satuan</h3>
      <label>Nama <input value={nama} onChange={e => setNama(e.target.value)} /></label>{' '}
      <label>Peran{' '}
        <select value={peran} onChange={e => setPeran(e.target.value)}>
          <option>Peserta</option><option>Narasumber</option><option>Panitia</option>
        </select></label>{' '}
      <button disabled={busy} onClick={generate}>{busy ? 'Memproses…' : 'Unduh PDF'}</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </section>
  );
}
