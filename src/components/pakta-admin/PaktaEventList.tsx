import { useEffect, useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { navigate } from '../AppRouter';
import { NewPaktaEventModal } from './NewPaktaEventModal';
import { ImportSignersModal } from './ImportSignersModal';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { SkeletonBlock } from '../Skeleton';
import { useToast } from '../../contexts/ToastContext';

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

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5 3.5l.5 8M9 3.5l-.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PaktaCard({
  event, onReload, onDelete,
}: {
  event: PaktaEvent;
  onReload: () => void;
  onDelete: (event: PaktaEvent) => void;
}) {
  const { callAdmin } = usePaktaAdmin();
  const { addToast } = useToast();
  const [showImport, setShowImport] = useState(false);

  async function toggleStatus() {
    const next = event.status === 'aktif' ? 'ditutup' : 'aktif';
    try {
      await callAdmin('update_event', { id: event.id, status: next });
      onReload();
    } catch (err) {
      addToast((err as Error).message, 'error');
    }
  }

  return (
    <>
      <article className="apple-card" style={{ marginBottom: 12 }}>
        <div className="apple-card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2, overflowWrap: 'break-word' }}>{event.nama}</div>
            <div className="apple-caption" style={{ color: 'var(--color-ink-muted)' }}>
              {event.tanggal}
              {' · '}
              <span className={`apple-badge ${event.status === 'aktif' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
                {event.status === 'aktif' ? 'Aktif' : 'Ditutup'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            <button
              className="sg-btn sg-btn-icon"
              aria-label="Hapus acara"
              onClick={() => onDelete(event)}
            >
              <TrashIcon />
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
  const { addToast } = useToast();
  const [events, setEvents] = useState<PaktaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaktaEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callAdmin('delete_event', { id: deleteTarget.id });
      setDeleteTarget(null);
      load();
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="apple-page apple-page-compact">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h1 className="apple-h1">Pakta Integritas</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="sg-btn sg-btn-primary" onClick={() => setShowNew(true)}>
            <PlusIcon /> Buat Acara
          </button>
          <button className="sg-btn sg-btn-outline" onClick={logout}>Keluar</button>
        </div>
      </div>

      {error && <p className="apple-error" style={{ marginBottom: 16 }}>{error}</p>}
      {loading && (
        <div style={{ opacity: 0.5, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonBlock height={72} />
          <SkeletonBlock height={72} />
          <SkeletonBlock height={72} />
        </div>
      )}
      {!loading && events.length === 0 && (
        <p className="apple-empty">Belum ada acara pakta. Buat acara pertama Anda.</p>
      )}
      {events.map(ev => (
        <PaktaCard key={ev.id} event={ev} onReload={load} onDelete={setDeleteTarget} />
      ))}

      {showNew && <NewPaktaEventModal onClose={() => { setShowNew(false); load(); }} />}

      {deleteTarget && (
        <DeleteConfirmModal
          eventName={deleteTarget.nama}
          issuedCount={0}
          onClose={() => !deleting && setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
