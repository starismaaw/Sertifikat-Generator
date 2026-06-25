function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="var(--color-accent-red)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 5.5h16M8.5 5.5V3h5v2.5M8 5.5l.8 13M14 5.5l-.8 13" />
    </svg>
  );
}

export function DeleteConfirmModal({
  eventName,
  issuedCount,
  onClose,
  onConfirm,
}: {
  eventName: string;
  issuedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal sg-modal-sm" role="dialog" aria-modal="true">
        <div className="sg-modal-body" style={{ textAlign: 'center', padding: '32px 28px' }}>
          <div className="sg-delete-icon">
            <TrashIcon />
          </div>
          <div className="sg-delete-heading">Hapus kegiatan ini?</div>
          <div className="sg-delete-body">
            <strong>{eventName}</strong>
            {issuedCount > 0 && (
              <span> · {issuedCount} sertifikat sudah terbit</span>
            )}
            <br />
            Tindakan ini tidak dapat dibatalkan.
          </div>
          <div className="sg-delete-footer">
            <button className="sg-btn sg-btn-outline" onClick={onClose} style={{ flex: 1 }}>
              Batal
            </button>
            <button className="sg-btn sg-btn-danger-solid" onClick={onConfirm} style={{ flex: 1 }}>
              Ya, hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
