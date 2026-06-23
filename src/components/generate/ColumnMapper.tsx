import type { FieldTipe } from '../../types';
import { FIELD_LABELS } from '../editor/FieldPalette';

const MAPPABLE: FieldTipe[] = ['nama', 'peran'];

export function ColumnMapper({
  headers, mapping, onChange,
}: {
  headers: string[];
  mapping: Partial<Record<FieldTipe, string>>;
  onChange: (m: Partial<Record<FieldTipe, string>>) => void;
}) {
  return (
    <div className="apple-flex-row apple-gap-md apple-mb-md">
      <h4 className="apple-caption-strong" style={{ minWidth: 100 }}>Pemetaan Kolom</h4>
      {MAPPABLE.map(tipe => (
        <div key={tipe} className="apple-form-group" style={{ marginBottom: 0 }}>
          <label className="apple-label" style={{ marginBottom: 3, fontSize: 12 }}>
            {FIELD_LABELS[tipe]}{tipe === 'nama' && <span className="apple-fine"> *</span>}
          </label>
          <select className="apple-select" value={mapping[tipe] ?? ''}
            onChange={e => onChange({ ...mapping, [tipe]: e.target.value || undefined })}>
            <option value="">— pilih kolom —</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
