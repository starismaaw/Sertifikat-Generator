import { useRef, useState } from 'react';

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function NewEventModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { nama: string; tanggal: string; file: File }) => void;
}) {
  const [nama, setNama] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith('image/')) {
      setError('File harus berupa gambar (PNG atau JPG)');
      return;
    }
    setError('');
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleSave() {
    if (!file) { setError('Pilih gambar latar terlebih dahulu'); return; }
    if (!nama.trim()) { setError('Nama kegiatan wajib diisi'); return; }
    onSave({ nama: nama.trim(), tanggal, file });
  }

  return (
    <div className="sg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="sg-modal-header">
          <h2 className="sg-modal-title" id="modal-title">Buat kegiatan baru</h2>
          <button className="sg-modal-close" onClick={onClose} aria-label="Tutup">×</button>
        </div>
        <div className="sg-modal-body">
          {error && (
            <div className="apple-error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          {/* Upload area */}
          <div className="sg-form-group">
            <label className="sg-label">Gambar latar sertifikat</label>
            <div className="sg-upload-row">
              {/* Preview */}
              <div className="sg-upload-preview">
                {preview ? (
                  <>
                    <img src={preview} alt="Preview latar" />
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(26,174,57,0.9)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      borderRadius: 9999,
                    }}>Terunggah</div>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>Pratinjau</span>
                )}
              </div>

              {/* Drop zone */}
              <div
                className={`sg-upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <UploadIcon />
                <div className="sg-upload-zone-text">
                  Seret gambar ke sini atau{' '}
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>pilih file</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>PNG atau JPG</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Event name */}
          <div className="sg-form-group">
            <label className="sg-label" htmlFor="new-ev-nama">Nama kegiatan</label>
            <input
              id="new-ev-nama"
              className="sg-input"
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Contoh: Pelatihan Teknis Jawa III 2026"
              autoFocus
            />
          </div>

          {/* Date */}
          <div className="sg-form-group">
            <label className="sg-label" htmlFor="new-ev-tanggal">Tanggal kegiatan</label>
            <input
              id="new-ev-tanggal"
              className="sg-input"
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
            />
          </div>
        </div>
        <div className="sg-modal-footer">
          <button className="sg-btn sg-btn-outline" onClick={onClose}>Batal</button>
          <button className="sg-btn sg-btn-primary sg-btn-pill" onClick={handleSave}>
            Simpan &amp; Buka Editor
          </button>
        </div>
      </div>
    </div>
  );
}
