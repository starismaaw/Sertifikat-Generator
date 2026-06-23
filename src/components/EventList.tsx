import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';
import { loadImage } from '../lib/image';
import { navigate } from './AppRouter';
import { Reveal } from './Reveal';
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
      <Reveal>
        <div className="apple-flex-row apple-space-between apple-mb-lg">
          <div>
            <span className="apple-eyebrow">Dashboard</span>
            <h2 className="apple-h1">Acara</h2>
          </div>
          <label className="apple-btn apple-btn-primary" style={{ cursor: 'pointer' }}>
            + Acara Baru
            <input type="file" accept="image/png,image/jpeg" hidden
              onChange={e => e.target.files?.[0] && handleNew(e.target.files[0])} />
          </label>
        </div>
      </Reveal>
      {error && <div className="apple-error">{error}</div>}
      <div className="apple-flex-col">
        {events.map((ev, i) => (
          <Reveal key={ev.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
            <div className="apple-card">
              <div className="apple-card-header">
                <div>
                  <div className="apple-h4">{ev.nama}</div>
                  <div className="apple-caption">{ev.tanggal} · {ev.fields.length} field</div>
                </div>
                <div className="apple-flex-row">
                  <button className="apple-btn apple-btn-primary apple-btn-sm"
                    onClick={() => navigate({ name: 'editor', eventId: ev.id })}>
                    Edit
                  </button>
                  <button className="apple-btn apple-btn-secondary apple-btn-sm"
                    onClick={() => navigate({ name: 'generate', eventId: ev.id })}>
                    Generate
                  </button>
                  <button className="apple-btn apple-btn-danger apple-btn-sm"
                    onClick={() => confirm(`Hapus "${ev.nama}"?`) && remove(ev.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
        {events.length === 0 && (
          <Reveal delay={1}>
            <div className="apple-empty">
              Belum ada acara. Klik "+ Acara Baru" untuk memulai.
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
