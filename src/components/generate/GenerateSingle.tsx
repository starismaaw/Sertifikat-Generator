import { useState } from 'react';
import type { CertEvent, FieldValues } from '../../types';
import { claimNextNumber } from '../../lib/eventStore';
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
    if (!nama.trim()) { setError('Nama wajib diisi'); return; }
    setBusy(true);
    try {
      const n = claimNextNumber(event.id);
      const values: FieldValues = resolveValues(event, { nama: nama.trim(), peran }, n);
      const bytes = await renderCertificate(event, values);
      downloadBlob(bytes, `Sertifikat - ${nama.trim()}.pdf`);
    } catch (e) {
      setError((e as Error).message);
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
