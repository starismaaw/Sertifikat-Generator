import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { loadImage } from '../lib/image';
import { navigate } from './AppRouter';
import type { CertEvent } from '../types';

export function EventList() {
  const { events, save, remove } = useEvents();
  const [error, setError] = useState('');

  async function handleNew(file: File) {
    setError('');
    try {
      const img = await loadImage(file);
      const ev: CertEvent = {
        id: crypto.randomUUID(),
        nama: 'Acara Baru', tanggal: new Date().toISOString().slice(0, 10),
        background: img.dataUrl, bgWidth: img.width, bgHeight: img.height,
        fields: [], polaNomor: '{n}/SERT/{bulan}/{tahun}',
        nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
        penandatangan: { nama: '', jabatan: '' },
      };
      save(ev);
      navigate({ name: 'editor', eventId: ev.id });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h2>Daftar Acara</h2>
      <label style={{ display: 'inline-block', margin: '8px 0', cursor: 'pointer' }}>
        <strong>+ Acara Baru</strong> (pilih background)
        <input type="file" accept="image/png,image/jpeg" hidden
          onChange={e => e.target.files?.[0] && handleNew(e.target.files[0])} />
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <ul>
        {events.map(ev => (
          <li key={ev.id} style={{ margin: '6px 0' }}>
            {ev.nama} — {ev.tanggal}{' '}
            <button onClick={() => navigate({ name: 'editor', eventId: ev.id })}>Edit Template</button>{' '}
            <button onClick={() => navigate({ name: 'generate', eventId: ev.id })}>Generate</button>{' '}
            <button onClick={() => confirm(`Hapus "${ev.nama}"?`) && remove(ev.id)}>Hapus</button>
          </li>
        ))}
        {events.length === 0 && <li>Belum ada acara.</li>}
      </ul>
    </section>
  );
}
