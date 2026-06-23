import type { ValidatedRow } from '../../lib/dataImporter';

export function BulkPreviewTable({ rows, numbers }: { rows: ValidatedRow[]; numbers: string[] }) {
  return (
    <table border={1} cellPadding={4} style={{ borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr><th>#</th><th>Nama</th><th>Peran</th><th>Nomor</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: r.valid ? undefined : '#fff0f0' }}>
            <td>{i + 1}</td>
            <td>{r.values.nama ?? ''}</td>
            <td>{r.values.peran ?? ''}</td>
            <td>{r.valid ? numbers[i] : '—'}</td>
            <td>{r.valid ? 'OK' : r.warning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
