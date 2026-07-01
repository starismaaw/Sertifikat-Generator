import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';

interface Signer {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  status: 'belum' | 'sudah';
  signed_at: string | null;
  pdf_path: string | null;
}

interface EventDetail {
  id: string;
  nama: string;
  tanggal: string;
  status: 'aktif' | 'ditutup';
  pakta_signers: Signer[];
}

export function PaktaDashboard({ eventId }: { eventId: string }) {
  const { callAdmin } = usePaktaAdmin();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const publicUrl = `${window.location.origin}/#pakta/${eventId}`;

  async function load() {
    setLoading(true);
    try {
      const { event: ev } = await callAdmin<{ event: EventDetail }>('get_event', { id: eventId });
      setEvent(ev);
      const qr = await QRCode.toDataURL(publicUrl, { width: 200, margin: 1 });
      setQrDataUrl(qr);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadPdf(signer: Signer) {
    if (!signer.pdf_path) return;
    setDownloadingId(signer.id);
    try {
      const { url } = await callAdmin<{ url: string }>('get_signed_url', { path: signer.pdf_path });
      const a = document.createElement('a');
      a.href = url;
      a.download = `pakta-${signer.nama.replace(/\s+/g, '_')}.pdf`;
      a.click();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
  }

  if (error) return (
    <div style={{ padding: 40 }}>
      <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>
      <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
    </div>
  );

  if (loading || !event) return <div style={{ padding: 40 }}><p className="apple-caption">Memuat…</p></div>;

  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;

  return (
    <div className="apple-page apple-page-wide">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
        <div>
          <h1 className="apple-h1" style={{ margin: 0 }}>{event.nama}</h1>
          <span className="apple-caption">{event.tanggal}</span>
        </div>
      </div>

      <div className="sg-pakta-dashboard-grid">
        {/* Kolom kiri: statistik + tabel */}
        <div>
          {/* Statistik */}
          <div className="apple-card" style={{ marginBottom: 16 }}>
            <div className="apple-card-body sg-pakta-stats-row">
              <div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{sudahCount}/{totalCount}</div>
                <div className="apple-caption">Sudah menandatangani</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{totalCount - sudahCount}</div>
                <div className="apple-caption">Belum menandatangani</div>
              </div>
            </div>
          </div>

          {/* Tombol aksi */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setShowImport(true)}>
              Impor Pegawai
            </button>
            <button className="sg-btn sg-btn-outline" onClick={load}>
              Refresh
            </button>
          </div>

          {/* Tabel signer */}
          {signers.length === 0 ? (
            <p className="apple-empty">Belum ada pegawai. Klik "Impor Pegawai" untuk menambahkan.</p>
          ) : (
            <div className="apple-table-wrap">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Waktu TTD</th>
                    <th>Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {signers.map(s => (
                    <tr key={s.id}>
                      <td>{s.nama}</td>
                      <td>{s.nip}</td>
                      <td>{s.jabatan}</td>
                      <td>
                        <span className={`apple-badge ${s.status === 'sudah' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
                          {s.status === 'sudah' ? 'Sudah' : 'Belum'}
                        </span>
                      </td>
                      <td className="apple-caption">
                        {s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '—'}
                      </td>
                      <td>
                        {s.pdf_path ? (
                          <button
                            className="sg-btn sg-btn-outline"
                            style={{ fontSize: 12, padding: '2px 10px' }}
                            disabled={downloadingId === s.id}
                            onClick={() => downloadPdf(s)}
                          >
                            {downloadingId === s.id ? '…' : 'PDF'}
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kolom kanan: QR code + link */}
        <div className="apple-card">
          <div className="apple-card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Link Tanda Tangan</div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code link tanda tangan" style={{ width: 180, height: 180 }} />
            )}
            <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 8, wordBreak: 'break-all' }}>
              {publicUrl}
            </div>
            <button
              className="sg-btn sg-btn-outline"
              style={{ marginTop: 10, fontSize: 12, width: '100%' }}
              onClick={copyLink}
            >
              Salin Link
            </button>
          </div>
        </div>
      </div>

      {showImport && (
        <ImportSignersModal
          eventId={eventId}
          onClose={() => { setShowImport(false); load(); }}
        />
      )}
    </div>
  );
}
