import { useEffect, useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { navigate } from '../AppRouter';
import { NewPaktaEventModal } from './NewPaktaEventModal';
import { ImportSignersModal } from './ImportSignersModal';

interface PaktaEvent {
  id: string;
  nama: string;
  tanggal: string;
  status: 'aktif' | 'ditutup';
  created_at: string;
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PaktaCard({ event, onReload }: { event: PaktaEvent; onReload: () => void }) {
  const { callAdmin } = usePaktaAdmin();
  const [showImport, setShowImport] = useState(false);

  async function toggleStatus() {
    const next = event.status === 'aktif' ? 'ditutup' : 'aktif';
    try {
      await callAdmin('update_event', { id: event.id, status: next });
      onReload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <>
      <article className="apple-card" style={{ marginBottom: 12 }}>
        <div className="apple-card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{event.nama}</div>
            <div className="apple-caption" style={{ color: 'var(--color-ink-muted)' }}>
              {event.tanggal}
              {' · '}
              <span className={`apple-badge ${event.status === 'aktif' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
                {event.status === 'aktif' ? 'Aktif' : 'Ditutup'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="sg-btn sg-btn-outline"
              onClick={() => navigate({ name: 'pakta-editor', eventId: event.id })}
            >
              Edit Templat
            </button>
            <button
              className="sg-btn sg-btn-outline"
              onClick={() => setShowImport(true)}
            >
              Import Peserta
            </button>
            <button
              className="sg-btn sg-btn-primary"
              onClick={() => navigate({ name: 'pakta-dashboard', eventId: event.id })}
            >
              Dashboard
            </button>
            <button className="sg-btn sg-btn-outline" onClick={toggleStatus}>
              {event.status === 'aktif' ? 'Tutup' : 'Buka'}
            </button>
          </div>
        </div>
      </article>
      {showImport && (
        <ImportSignersModal
          eventId={event.id}
          onClose={() => { setShowImport(false); onReload(); }}
        />
      )}
    </>
  );
}

export function PaktaEventList() {
  const { callAdmin, logout } = usePaktaAdmin();
  const [events, setEvents] = useState<PaktaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await callAdmin<{ events: PaktaEvent[] }>('list_events');
      setEvents(data.events ?? []);
    } catch (err) {
      setError((err as Error).message);
      if ((err as Error).message.includes('401') || (err as Error).message.includes('diizinkan')) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="apple-page apple-page-compact">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="apple-h1">Pakta Integritas</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sg-btn sg-btn-primary" onClick={() => setShowNew(true)}>
            <PlusIcon /> Buat Acara
          </button>
          <button className="sg-btn sg-btn-outline" onClick={logout}>Keluar</button>
        </div>
      </div>

      {error && <p className="apple-error" style={{ marginBottom: 16 }}>{error}</p>}
      {loading && <p className="apple-caption">Memuat…</p>}
      {!loading && events.length === 0 && (
        <p className="apple-empty">Belum ada acara pakta. Buat acara pertama Anda.</p>
      )}
      {events.map(ev => (
        <PaktaCard key={ev.id} event={ev} onReload={load} />
      ))}

      {showNew && <NewPaktaEventModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}
