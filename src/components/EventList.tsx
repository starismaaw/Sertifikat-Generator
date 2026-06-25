import { useState, useMemo } from 'react';
import { useEvents } from '../hooks/useEvents';
import { loadImage } from '../lib/image';
import { navigate } from './AppRouter';
import { EventCard } from './EventCard';
import { NewEventModal } from './NewEventModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { CertEvent } from '../types';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="var(--color-ink-faint)" strokeWidth="1.3" />
      <path d="M10 10L13 13" stroke="var(--color-ink-faint)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CertIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="30" height="30" rx="4" />
      <path d="M11 14h18M11 19h18M11 24h12" />
      <circle cx="29" cy="28" r="4" />
      <path d="M26 32l-2 4 5-2 5 2-2-4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EventList() {
  const { events, save, remove } = useEvents();
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CertEvent | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() =>
    search.trim()
      ? events.filter(ev => ev.nama.toLowerCase().includes(search.toLowerCase()))
      : events,
    [events, search],
  );

  async function handleSave({ nama, tanggal, file }: { nama: string; tanggal: string; file: File }) {
    setError('');
    try {
      const img = await loadImage(file);
      const ev: CertEvent = {
        id: crypto.randomUUID(),
        nama, tanggal,
        background: img.dataUrl,
        bgWidth: img.width,
        bgHeight: img.height,
        fields: [],
        polaNomor: '{n}/SERT/{bulan}/{tahun}',
        nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
        penandatangan: { nama: '', jabatan: '' },
      };
      save(ev);
      setShowNew(false);
      navigate({ name: 'editor', eventId: ev.id });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleDelete(ev: CertEvent) {
    remove(ev.id);
    setDeleteTarget(null);
  }

  const issuedCount = (ev: CertEvent) =>
    ev.nomorTerakhir >= ev.nomorMulai ? ev.nomorTerakhir - ev.nomorMulai + 1 : 0;

  return (
    <div className="sg-home">
      {/* Header */}
      <div className="sg-home-header">
        <div>
          <h1 className="sg-home-title">Kegiatan</h1>
          {events.length > 0 && (
            <div className="sg-home-subtitle">{events.length} kegiatan tersimpan</div>
          )}
        </div>
        {events.length > 0 && (
          <div className="sg-home-actions">
            <div className="sg-search">
              <SearchIcon />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari kegiatan…"
              />
            </div>
            <button
              className="sg-btn sg-btn-primary sg-btn-pill"
              onClick={() => setShowNew(true)}
            >
              <PlusIcon /> Buat kegiatan
            </button>
          </div>
        )}
      </div>

      {error && <div className="apple-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Empty state */}
      {events.length === 0 && (
        <div className="sg-empty-card">
          <div className="sg-empty-icon-wrap"><CertIcon /></div>
          <h2 className="sg-empty-heading">Belum ada kegiatan</h2>
          <p className="sg-empty-body">
            Mulai dengan membuat kegiatan pertama Anda. Unggah gambar latar sertifikat, atur field peserta, dan cetak sertifikat dalam hitungan menit.
          </p>
          <button
            className="sg-btn sg-btn-primary sg-btn-pill"
            style={{ fontSize: 14, padding: '10px 24px' }}
            onClick={() => setShowNew(true)}
          >
            <PlusIcon /> Buat kegiatan pertama
          </button>

          <div className="sg-onboarding-steps">
            <div className="sg-onboarding-step">
              <div className="sg-onboarding-num">1</div>
              <div className="sg-onboarding-title">Unggah latar</div>
              <div className="sg-onboarding-desc">Upload gambar sertifikat sebagai template dasar</div>
            </div>
            <div className="sg-onboarding-step">
              <div className="sg-onboarding-num">2</div>
              <div className="sg-onboarding-title">Atur field</div>
              <div className="sg-onboarding-desc">Tentukan posisi nama, nomor, dan tanda tangan</div>
            </div>
            <div className="sg-onboarding-step">
              <div className="sg-onboarding-num">3</div>
              <div className="sg-onboarding-title">Cetak massal</div>
              <div className="sg-onboarding-desc">Impor data peserta dan ekspor ZIP berisi PDF</div>
            </div>
          </div>
        </div>
      )}

      {/* Events grid */}
      {events.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-ink-muted)' }}>
              Tidak ada kegiatan yang cocok dengan "{search}"
            </div>
          ) : (
            <div className="sg-event-grid">
              {filtered.map(ev => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onDelete={() => setDeleteTarget(ev)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewEventModal onClose={() => setShowNew(false)} onSave={handleSave} />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          eventName={deleteTarget.nama}
          issuedCount={issuedCount(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
