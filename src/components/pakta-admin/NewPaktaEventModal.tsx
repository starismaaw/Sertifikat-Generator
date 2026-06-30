import { useRef, useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { navigate } from '../AppRouter';

function measureImage(file: File): Promise<{ w: number; h: number; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, dataUrl: src });
      img.onerror = reject;
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function NewPaktaEventModal({ onClose }: { onClose: () => void }) {
  const { callAdmin } = usePaktaAdmin();
  const [nama, setNama] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
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

  async function handleSave() {
    if (!file) { setError('Pilih gambar latar terlebih dahulu'); return; }
    if (!nama.trim()) { setError('Nama acara wajib diisi'); return; }
    setLoading(true);
    setError('');
    try {
      const { w, h } = await measureImage(file);
      const ext = file.name.endsWith('.png') ? 'png' : 'jpg';
      const path = `events/${crypto.randomUUID()}/template.${ext}`;

      // 1. Dapatkan signed upload URL
      const { signedUrl } = await callAdmin<{ signedUrl: string }>('get_template_upload_url', { path });

      // 2. Upload gambar langsung ke Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Gagal mengunggah gambar template');

      // 3. Buat acara di Supabase
      const { event } = await callAdmin<{ event: { id: string } }>('create_event', {
        nama: nama.trim(),
        tanggal,
        template_path: path,
        bg_width: w,
        bg_height: h,
        fields: [],
      });

      navigate({ name: 'pakta-editor', eventId: event.id });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal" role="dialog" aria-modal="true" aria-labelledby="modal-pakta-title">
        <div className="sg-modal-header">
          <h2 className="sg-modal-title" id="modal-pakta-title">Buat Acara Pakta Integritas</h2>
          <button className="sg-modal-close" onClick={onClose} aria-label="Tutup">×</button>
        </div>
        <div className="sg-modal-body">
          {error && <div className="apple-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="sg-form-group">
            <label className="sg-label">Gambar latar pakta</label>
            <div className="sg-upload-row">
              <div className="sg-upload-preview">
                {preview
                  ? <img src={preview} alt="Preview latar" />
                  : <span style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>Pratinjau</span>}
              </div>
              <div
                className={`sg-upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
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

          <div className="sg-form-group">
            <label className="sg-label" htmlFor="pakta-nama">Nama acara</label>
            <input
              id="pakta-nama"
              className="sg-input"
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Contoh: Pakta Integritas 2026"
              autoFocus
            />
          </div>

          <div className="sg-form-group">
            <label className="sg-label" htmlFor="pakta-tanggal">Tanggal acara</label>
            <input
              id="pakta-tanggal"
              className="sg-input"
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
            />
          </div>
        </div>
        <div className="sg-modal-footer">
          <button className="sg-btn sg-btn-outline" onClick={onClose} disabled={loading}>Batal</button>
          <button className="sg-btn sg-btn-primary sg-btn-pill" onClick={handleSave} disabled={loading}>
            {loading ? 'Menyimpan…' : 'Simpan & Buka Editor'}
          </button>
        </div>
      </div>
    </div>
  );
}
