import type { ValidatedRow } from '../../lib/dataImporter';

function OkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 5.5L4 8L8.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 3v3M5 7.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function BulkPreviewTable({ rows, numbers }: { rows: ValidatedRow[]; numbers: string[] }) {
  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="sg-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-hairline)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-canvas-soft)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
          {rows.length} baris
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--color-accent-green)', fontWeight: 500 }}>
          · {validCount} valid
        </span>
        {invalidCount > 0 && (
          <span style={{ fontSize: 12.5, color: 'var(--color-accent-red)', fontWeight: 500 }}>
            · {invalidCount} perlu diperiksa
          </span>
        )}
      </div>

      {/* Table */}
      <div className="apple-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
        <table className="apple-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama</th>
              <th>Peran</th>
              <th>Nomor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.valid ? '' : 'invalid'}>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{i + 1}</td>
                <td>{r.values.nama ?? ''}</td>
                <td>{r.values.peran ?? ''}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                  {r.valid ? numbers[i] : '—'}
                </td>
                <td>
                  {r.valid ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 9999,
                      background: 'rgba(26,174,57,0.1)', color: '#138a2e',
                      fontSize: 11.5, fontWeight: 600,
                    }}>
                      <OkIcon /> Valid
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 9999,
                      background: 'rgba(220,38,38,0.08)', color: 'var(--color-accent-red)',
                      fontSize: 11.5, fontWeight: 600,
                    }} title={r.warning}>
                      <WarnIcon /> Periksa
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
