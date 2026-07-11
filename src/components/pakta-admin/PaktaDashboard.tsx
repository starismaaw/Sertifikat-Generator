import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';
import { filterSigners, type StatusFilter } from '../../lib/signerFilter';
import { buildXlsx, buildZip, downloadBlob } from '../../lib/download';
import { buildPaktaListPdf } from '../../lib/paktaListPdf';
import { isValidSlug } from '../../lib/slug';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonDashboard } from '../Skeleton';

type BulkDownloadPhase = 'idle' | 'fetching' | 'zipping';
const BULK_CONCURRENCY = 5;

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
  slug: string;
  pakta_signers: Signer[];
}

function buildPublicUrl(slug: string): string {
  return `${window.location.origin}/#pakta/${slug}`;
}

export function PaktaDashboard({ eventId }: { eventId: string }) {
  const { callAdmin } = usePaktaAdmin();
  const { addToast } = useToast();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');
  const [bulkPhase, setBulkPhase] = useState<BulkDownloadPhase>('idle');
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrentName, setBulkCurrentName] = useState('');
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [resetTarget, setResetTarget] = useState<Signer | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { event: ev } = await callAdmin<{ event: EventDetail }>('get_event', { id: eventId });
      setEvent(ev);
      const qr = await QRCode.toDataURL(buildPublicUrl(ev.slug), { width: 200, margin: 1 });
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
      addToast((err as Error).message, 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  async function resetSigner(signer: Signer) {
    setResetTarget(signer);
  }

  async function confirmReset() {
    if (!resetTarget) return;
    try {
      await callAdmin('reset_signer', { id: resetTarget.id });
      setResetTarget(null);
      addToast(`Tanda tangan ${resetTarget.nama} berhasil direset.`, 'success');
      load();
    } catch (err) {
      addToast((err as Error).message, 'error');
    }
  }

  function copyLink() {
    if (!event) return;
    navigator.clipboard.writeText(buildPublicUrl(event.slug)).catch(() => {});
  }

  function startEditSlug() {
    if (!event) return;
    setSlugInput(event.slug);
    setSlugError('');
    setEditingSlug(true);
  }

  async function saveSlug() {
    if (!event) return;
    const trimmed = slugInput.trim();
    if (!isValidSlug(trimmed)) {
      setSlugError('Slug harus huruf kecil, angka, dan tanda hubung saja (3-60 karakter)');
      return;
    }
    setSavingSlug(true);
    setSlugError('');
    try {
      await callAdmin('update_event', { id: eventId, slug: trimmed });
      setEvent({ ...event, slug: trimmed });
      const qr = await QRCode.toDataURL(buildPublicUrl(trimmed), { width: 200, margin: 1 });
      setQrDataUrl(qr);
      setEditingSlug(false);
    } catch (err) {
      setSlugError((err as Error).message);
    } finally {
      setSavingSlug(false);
    }
  }

  if (error) return (
    <div style={{ padding: 40 }}>
      <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>
      <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
    </div>
  );

  if (loading || !event) return (
    <div className="apple-page apple-page-wide">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
      </div>
      <SkeletonDashboard />
    </div>
  );

  const publicUrl = buildPublicUrl(event.slug);
  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;
  const filteredSigners = filterSigners(signers, statusFilter, query);

  async function downloadAllPdfs() {
    if (!event) return;
    const signed = signers.filter(s => s.status === 'sudah' && s.pdf_path);
    if (signed.length === 0) return;

    setBulkPhase('fetching');
    setBulkDone(0);
    setBulkTotal(signed.length);
    setBulkCurrentName('');

    try {
      const paths = signed.map(s => s.pdf_path as string);
      const { urls } = await callAdmin<{ urls: Record<string, string> }>('get_bulk_signed_urls', { paths });

      const files: { name: string; bytes: Uint8Array }[] = new Array(signed.length);
      let doneCount = 0;

      async function fetchOne(index: number) {
        const s = signed[index];
        setBulkCurrentName(s.nama);
        const url = urls[s.pdf_path as string];
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Gagal mengunduh PDF ${s.nama}`);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        files[index] = { name: `pakta-${s.nama.replace(/\s+/g, '_')}.pdf`, bytes };
        doneCount++;
        setBulkDone(doneCount);
      }

      let cursor = 0;
      async function worker() {
        while (cursor < signed.length) {
          const index = cursor++;
          await fetchOne(index);
        }
      }
      await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, signed.length) }, worker));

      setBulkPhase('zipping');
      setBulkCurrentName('');
      const zip = await buildZip(files);

      downloadBlob(zip, `Pakta - ${event.nama}.zip`, 'application/zip');
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setBulkPhase('idle');
      setBulkDone(0);
      setBulkTotal(0);
      setBulkCurrentName('');
    }
  }

  function exportExcel() {
    if (!event) return;
    const rows = filteredSigners.map(s => ({
      Nama: s.nama,
      NIP: s.nip,
      Jabatan: s.jabatan,
      Status: s.status === 'sudah' ? 'Sudah' : 'Belum',
      'Waktu TTD': s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '',
    }));
    const bytes = buildXlsx(rows, 'Pakta');
    downloadBlob(
      bytes,
      `Pakta - ${event.nama}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }

  async function exportPdf() {
    if (!event) return;
    const rows = filteredSigners.map(s => ({
      nama: s.nama,
      nip: s.nip,
      status: s.status === 'sudah' ? 'Sudah' : 'Belum',
      waktuTtd: s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '—',
    }));
    const bytes = await buildPaktaListPdf(event.nama, event.tanggal, sudahCount, totalCount, rows);
    downloadBlob(bytes, `Pakta - ${event.nama}.pdf`, 'application/pdf');
  }

  return (
    <div className="apple-page apple-page-wide">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
        <div style={{ minWidth: 0 }}>
          <h1 className="apple-h1" style={{ margin: 0, overflowWrap: 'break-word' }}>{event.nama}</h1>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setShowImport(true)}>
              Impor Pegawai
            </button>
            <button className="sg-btn sg-btn-outline" onClick={load}>
              Refresh
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={sudahCount === 0 || bulkPhase !== 'idle'}
              onClick={downloadAllPdfs}
            >
              {bulkPhase === 'idle' ? 'Unduh Semua (ZIP)' : '…'}
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={filteredSigners.length === 0}
              onClick={exportExcel}
            >
              Unduh Excel
            </button>
            <button
              className="sg-btn sg-btn-outline"
              disabled={filteredSigners.length === 0}
              onClick={exportPdf}
            >
              Unduh PDF
            </button>
          </div>

          {bulkPhase !== 'idle' && (
            <div className="apple-progress" style={{ marginBottom: 16 }}>
              <div className="apple-progress-phase">
                {bulkPhase === 'fetching'
                  ? `Mengunduh ${bulkDone} dari ${bulkTotal}${bulkCurrentName ? ` · ${bulkCurrentName}` : ''}`
                  : 'Mengemas ZIP…'}
              </div>
              <div className="apple-progress-track">
                <div
                  className={`apple-progress-fill ${bulkPhase === 'zipping' ? 'indeterminate' : ''}`}
                  style={bulkPhase === 'fetching' ? { width: `${Math.round((bulkDone / bulkTotal) * 100)}%` } : undefined}
                />
              </div>
            </div>
          )}

          {/* Tabel signer */}
          {signers.length === 0 ? (
            <p className="apple-empty">Belum ada pegawai. Klik "Impor Pegawai" untuk menambahkan.</p>
          ) : (
            <>
              <div className="sg-segmented" style={{ marginBottom: 12 }}>
                {(['semua', 'sudah', 'belum'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`sg-segmented-btn ${statusFilter === f ? 'active' : ''}`}
                    aria-pressed={statusFilter === f}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f === 'semua' ? 'Semua' : f === 'sudah' ? 'Sudah' : 'Belum'}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="apple-input"
                placeholder="Cari nama atau NIP…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              {filteredSigners.length === 0 ? (
                <p className="apple-empty">
                  {query.trim() === ''
                    ? 'Tidak ada peserta dengan status ini.'
                    : 'Tidak ada peserta yang cocok dengan pencarian.'}
                </p>
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
                      {filteredSigners.map(s => (
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
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  className="sg-btn sg-btn-outline"
                                  style={{ fontSize: 12, padding: '2px 10px' }}
                                  disabled={downloadingId === s.id}
                                  onClick={() => downloadPdf(s)}
                                >
                                  {downloadingId === s.id ? '…' : 'PDF'}
                                </button>
                                <button
                                  className="sg-btn sg-btn-outline"
                                  style={{ fontSize: 12, padding: '2px 10px' }}
                                  onClick={() => resetSigner(s)}
                                >
                                  Reset
                                </button>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Kolom kanan: QR code + link */}
        <div className="apple-card">
          <div className="apple-card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Link Tanda Tangan</div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code link tanda tangan" style={{ width: 180, height: 180 }} />
            )}
            {editingSlug ? (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className="apple-input"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  style={{ width: '100%', fontSize: 12 }}
                  disabled={savingSlug}
                />
                {slugError && (
                  <p className="apple-error" style={{ fontSize: 11, marginTop: 6 }}>{slugError}</p>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    className="sg-btn sg-btn-primary"
                    style={{ flex: 1, fontSize: 12 }}
                    disabled={savingSlug}
                    onClick={saveSlug}
                  >
                    {savingSlug ? 'Menyimpan…' : 'Simpan'}
                  </button>
                  <button
                    className="sg-btn sg-btn-outline"
                    style={{ flex: 1, fontSize: 12 }}
                    disabled={savingSlug}
                    onClick={() => setEditingSlug(false)}
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 8, wordBreak: 'break-all' }}>
                  {publicUrl}
                </div>
                <button
                  className="sg-btn sg-btn-outline"
                  style={{ marginTop: 10, fontSize: 12, width: '100%' }}
                  onClick={startEditSlug}
                >
                  Ubah
                </button>
                <button
                  className="sg-btn sg-btn-outline"
                  style={{ marginTop: 6, fontSize: 12, width: '100%' }}
                  onClick={copyLink}
                >
                  Salin Link
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showImport && (
        <ImportSignersModal
          eventId={eventId}
          onClose={() => { setShowImport(false); load(); }}
        />
      )}

      {resetTarget && (
        <div className="sg-overlay" onClick={() => setResetTarget(null)}>
          <div className="sg-modal sg-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="sg-modal-header">
              <h2 className="sg-modal-title">Reset Tanda Tangan</h2>
            </div>
            <div className="sg-modal-body" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-ink-secondary)', lineHeight: 1.55 }}>
                Reset tanda tangan <strong>{resetTarget.nama}</strong>?<br />
                PDF yang sudah ditandatangani akan dihapus permanen dan pegawai ini bisa TTD ulang.
              </p>
            </div>
            <div className="sg-modal-footer">
              <button className="sg-btn sg-btn-outline" onClick={() => setResetTarget(null)}>Batal</button>
              <button className="sg-btn sg-btn-danger-solid" onClick={confirmReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
