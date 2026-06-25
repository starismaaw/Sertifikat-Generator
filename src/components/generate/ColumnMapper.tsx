import type { FieldTipe } from '../../types';
import { FIELD_LABELS } from '../editor/FieldPalette';

const MAPPABLE: FieldTipe[] = ['nama', 'peran'];

function FieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 5h6M3 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ColumnMapper({
  headers,
  mapping,
  onChange,
  emailColumn,
  onEmailChange,
  sampleRows = [],
}: {
  headers: string[];
  mapping: Partial<Record<FieldTipe, string>>;
  onChange: (m: Partial<Record<FieldTipe, string>>) => void;
  emailColumn: string;
  onEmailChange: (col: string) => void;
  sampleRows?: Record<string, string>[];
}) {
  function getSamples(col: string): string[] {
    return sampleRows.slice(0, 3).map(r => r[col] ?? '').filter(Boolean);
  }

  const allMappable: { tipe: FieldTipe | 'email'; label: string }[] = [
    ...MAPPABLE.map(t => ({ tipe: t as FieldTipe | 'email', label: FIELD_LABELS[t] })),
    { tipe: 'email', label: 'Email (pengiriman)' },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      {allMappable.map(({ tipe, label }) => {
        const colValue = tipe === 'email' ? emailColumn : (mapping[tipe as FieldTipe] ?? '');
        const isMapped = Boolean(colValue);
        const samples = isMapped ? getSamples(colValue) : [];

        return (
          <div key={tipe} className="sg-mapper-row">
            {/* Field chip */}
            <div className="sg-mapper-field-chip">
              <FieldIcon />
              <span style={{ fontSize: 12.5 }}>
                {label}
                {tipe === 'nama' && <span style={{ color: 'var(--color-accent-red)', marginLeft: 2 }}>*</span>}
              </span>
            </div>

            {/* Arrow */}
            <div className="sg-mapper-arrow">→</div>

            {/* Column card */}
            <div className={`sg-mapper-col-card ${isMapped ? 'mapped' : ''}`}>
              <div className="sg-mapper-col-header">
                <select
                  className="sg-select"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 12.5,
                    padding: '4px 24px 4px 6px',
                    color: isMapped ? 'var(--color-primary)' : 'var(--color-ink-muted)',
                  }}
                  value={colValue}
                  onChange={e => {
                    if (tipe === 'email') {
                      onEmailChange(e.target.value);
                    } else {
                      onChange({ ...mapping, [tipe]: e.target.value || undefined });
                    }
                  }}
                >
                  <option value="">— pilih kolom —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              {samples.length > 0 && (
                <div className="sg-mapper-col-samples">
                  {samples.map((s, i) => (
                    <span key={i} className="sg-sample-chip">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
