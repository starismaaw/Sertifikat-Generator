import type { ValidatedRow } from '../../lib/dataImporter';

export function BulkPreviewTable({ rows, numbers }: { rows: ValidatedRow[]; numbers: string[] }) {
  return (
    <div className="apple-table-wrap">
      <table className="apple-table">
        <thead>
          <tr><th>#</th><th>Nama</th><th>Peran</th><th>Nomor</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.valid ? '' : 'invalid'}>
              <td>{i + 1}</td>
              <td>{r.values.nama ?? ''}</td>
              <td>{r.values.peran ?? ''}</td>
              <td>{r.valid ? numbers[i] : '—'}</td>
              <td>
                {r.valid
                  ? <span className="apple-badge apple-badge-ok">OK</span>
                  : <span className="apple-badge apple-badge-warn" title={r.warning}>{r.warning}</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
