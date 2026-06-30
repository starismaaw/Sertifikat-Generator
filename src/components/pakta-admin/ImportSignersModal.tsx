import { useRef, useState } from 'react';
import { parseFile } from '../../lib/dataImporter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';

interface SignerRow {
  nama: string;
  nip: string;
  jabatan: string;
}

const KOLOM_WAJIB = ['nama', 'nip', 'jabatan'] as const;

export function ImportSignersModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { callAdmin } = usePaktaAdmin();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<typeof KOLOM_WAJIB[number], string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setError('');
    setSuccess('');
    try {
      const parsed = await parseFile(f);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      // Auto-map kolom dengan nama mirip
      const autoMap: Partial<Record<typeof KOLOM_WAJIB[number], string>> = {};
      for (const col of KOLOM_WAJIB) {
        const found = parsed.headers.find(h =>
          h.toLowerCase().replace(/[^a-z]/g, '').includes(col.toLowerCase())
        );
        if (found) autoMap[col] = found;
      }
      setMapping(autoMap);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function previewRows(): SignerRow[] {
    return rows.slice(0, 5).map(row => ({
      nama: (mapping.nama ? row[mapping.nama] : '') ?? '',
      nip: (mapping.nip ? row[mapping.nip] : '') ?? '',
      jabatan: (mapping.jabatan ? row[mapping.jabatan] : '') ?? '',
    })).filter(r => r.nama.trim());
  }

  async function handleImport() {
    if (!mapping.nama) { setError('Kolom Nama wajib dipetakan'); return; }
    setLoading(true);
    setError('');
    try {
      const signers = rows
        .map(row => ({
          nama: (mapping.nama ? row[mapping.nama] : '') ?? '',
          nip: (mapping.nip ? row[mapping.nip] : '') ?? '',
          jabatan: (mapping.jabatan ? row[mapping.jabatan] : '') ?? '',
        }))
        .filter(s => s.nama.trim());

      if (signers.length === 0) { setError('Tidak ada baris valid ditemukan'); return; }

      const result = await callAdmin<{ imported: number }>('import_signers', { event_id: eventId, signers });
      setSuccess(`${result.imported} pegawai berhasil diimpor.`);
      setRows([]);
      setHeaders([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal" style={{ maxWidth: 560 }} role="dialog" aria-modal="true">
        <div className="sg-modal-header">
          <h2 className="sg-modal-title">Impor Daftar Pegawai</h2>
          <button className="sg-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sg-modal-body">
          {error && <div className="apple-error" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ color: 'var(--color-accent-green)', marginBottom: 12, fontWeight: 600 }}>{success}</div>}

          <div className="sg-form-group">
            <label className="sg-label">File pegawai (CSV / XLSX)</label>
            <button className="sg-btn sg-btn-outline" onClick={() => fileRef.current?.click()}>
              Pilih File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {headers.length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Pemetaan Kolom</div>
              {KOLOM_WAJIB.map(k => (
                <div key={k} className="sg-form-group">
                  <label className="sg-label" style={{ textTransform: 'capitalize' }}>{k}</label>
                  <select
                    className="sg-input"
                    value={mapping[k] ?? ''}
                    onChange={e => setMapping(m => ({ ...m, [k]: e.target.value || undefined }))}
                  >
                    <option value="">— Pilih kolom —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}

              {previewRows().length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Pratinjau (5 baris pertama)</div>
                  <div className="apple-table-wrap">
                    <table className="apple-table">
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>NIP</th>
                          <th>Jabatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows().map((r, i) => (
                          <tr key={i}>
                            <td>{r.nama}</td>
                            <td>{r.nip}</td>
                            <td>{r.jabatan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="apple-caption" style={{ marginTop: 8 }}>
                    Total: {rows.filter(r => (mapping.nama ? r[mapping.nama] : '').trim()).length} baris valid
                  </p>
                </>
              )}
            </>
          )}
        </div>
        <div className="sg-modal-footer">
          <button className="sg-btn sg-btn-outline" onClick={onClose} disabled={loading}>Tutup</button>
          {rows.length > 0 && (
            <button
              className="sg-btn sg-btn-primary sg-btn-pill"
              onClick={handleImport}
              disabled={loading || !mapping.nama}
            >
              {loading ? 'Mengimpor…' : `Impor ${rows.filter(r => (mapping.nama ? r[mapping.nama] : '').trim()).length} Pegawai`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
