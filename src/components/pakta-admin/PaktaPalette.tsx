import type { FieldTipe } from '../../types';

const PAKTA_LABELS: Partial<Record<FieldTipe, string>> = {
  nama: 'Nama pegawai',
  nip: 'NIP',
  jabatan: 'Jabatan',
  namaNip: 'Nama & NIP',
  tandaTangan: 'Tanda Tangan',
};

const PAKTA_FIELDS: FieldTipe[] = ['nama', 'nip', 'jabatan', 'namaNip', 'tandaTangan'];

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5L6 10.5L11.5 4" stroke="var(--color-accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaktaPalette({ onAdd, used }: { onAdd: (t: FieldTipe) => void; used: Set<FieldTipe> }) {
  return (
    <div className="sg-field-palette">
      <div>
        <div className="sg-palette-section-header">Field Pakta</div>
        {PAKTA_FIELDS.map(t => {
          const isAdded = used.has(t);
          return (
            <button
              key={t}
              className={`sg-field-btn ${isAdded ? 'added' : ''}`}
              disabled={isAdded}
              onClick={() => !isAdded && onAdd(t)}
            >
              <span style={{ flex: 1, fontSize: 12.5 }}>{PAKTA_LABELS[t]}</span>
              <span className="sg-field-btn-icon">
                {isAdded ? <CheckIcon /> : <PlusIcon />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
