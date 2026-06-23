import type { FieldTipe } from '../../types';
import { FIELD_LABELS } from '../editor/FieldPalette';

// Only person-level fields are mapped from the file; the rest come from the event.
const MAPPABLE: FieldTipe[] = ['nama', 'peran'];

export function ColumnMapper({
  headers, mapping, onChange,
}: {
  headers: string[];
  mapping: Partial<Record<FieldTipe, string>>;
  onChange: (m: Partial<Record<FieldTipe, string>>) => void;
}) {
  return (
    <div>
      <h4>Pemetaan Kolom</h4>
      {MAPPABLE.map(tipe => (
        <div key={tipe}>
          <label>{FIELD_LABELS[tipe]}{tipe === 'nama' && ' *'}{' '}
            <select value={mapping[tipe] ?? ''}
              onChange={e => onChange({ ...mapping, [tipe]: e.target.value || undefined })}>
              <option value="">— pilih kolom —</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        </div>
      ))}
    </div>
  );
}
