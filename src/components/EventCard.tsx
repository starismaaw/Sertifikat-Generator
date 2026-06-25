import { navigate } from './AppRouter';
import type { CertEvent } from '../types';

const ACCENT_COLORS = [
  '#0075de', '#213183', '#b45309', '#047857', '#7c3aed', '#db2777',
];

function getAccentColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 5h10" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L5 9.5L10 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 2L11 4L4.5 10.5H2.5V8.5L9 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="3" y="1.5" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6.5h10a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H9v-2H4v2H1.5a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.2" />
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

export function EventCard({
  event,
  onDelete,
}: {
  event: CertEvent;
  onDelete: () => void;
}) {
  const accent = getAccentColor(event.id);
  const issuedCount = event.nomorTerakhir - event.nomorMulai + 1;
  const hasIssued = event.nomorTerakhir >= event.nomorMulai;

  return (
    <article className="sg-event-card">
      {/* Thumbnail */}
      <div className="sg-event-thumb">
        <div
          className="sg-event-thumb-inner"
          style={{ borderColor: accent }}
        >
          <div className="sg-event-thumb-label">Sertifikat</div>
          <div className="sg-event-thumb-line" />
          <div className="sg-event-thumb-bar" style={{ width: '80%' }} />
          <div className="sg-event-thumb-bar-short" />
          <div className="sg-event-thumb-bar" style={{ width: '65%' }} />
        </div>
        <div className={`sg-event-status-badge ${hasIssued ? 'issued' : 'draft'}`}>
          {hasIssued ? `${issuedCount} terbit` : 'Draf'}
        </div>
      </div>

      {/* Body */}
      <div className="sg-event-body">
        <div className="sg-event-name">{event.nama}</div>
        <div className="sg-event-meta">
          <span className="sg-event-meta-item">
            <CalendarIcon />
            {event.tanggal}
          </span>
          {hasIssued && (
            <span className="sg-event-meta-item">
              <CheckIcon />
              {issuedCount} sertifikat
            </span>
          )}
        </div>
      </div>

      <div className="sg-event-divider" />

      {/* Actions */}
      <div className="sg-event-actions">
        <button
          className="sg-btn sg-btn-outline"
          style={{ flex: 1 }}
          onClick={() => navigate({ name: 'editor', eventId: event.id })}
        >
          <EditIcon /> Edit templat
        </button>
        <button
          className="sg-btn sg-btn-primary"
          style={{ flex: 1 }}
          onClick={() => navigate({ name: 'generate', eventId: event.id })}
        >
          <PrintIcon /> Cetak
        </button>
        <button
          className="sg-btn sg-btn-icon"
          aria-label="Hapus kegiatan"
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}
