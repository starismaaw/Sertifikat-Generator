import type { FieldTipe } from '../../types';

const LABELS: Record<FieldTipe, string> = {
  nama: 'Nama peserta',
  nomor: 'Nomor sertifikat',
  acara: 'Nama acara',
  tanggal: 'Tanggal acara',
  peran: 'Peran / jabatan',
  namaPenandatangan: 'Nama penandatangan',
  penandatangan: 'Jabatan penandatangan',
};

const SECTIONS: { label: string; fields: FieldTipe[] }[] = [
  { label: 'Field Peserta', fields: ['nama', 'nomor', 'peran'] },
  { label: 'Acara & Tanda Tangan', fields: ['acara', 'tanggal', 'namaPenandatangan', 'penandatangan'] },
];

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

export function FieldPalette({ onAdd, used }: { onAdd: (t: FieldTipe) => void; used: Set<FieldTipe> }) {
  return (
    <div className="sg-field-palette">
      {SECTIONS.map(section => (
        <div key={section.label}>
          <div className="sg-palette-section-header">{section.label}</div>
          {section.fields.map(t => {
            const isAdded = used.has(t);
            return (
              <button
                key={t}
                className={`sg-field-btn ${isAdded ? 'added' : ''}`}
                disabled={isAdded}
                onClick={() => !isAdded && onAdd(t)}
              >
                <span style={{ flex: 1, fontSize: 12.5 }}>{LABELS[t]}</span>
                <span className="sg-field-btn-icon">
                  {isAdded ? <CheckIcon /> : <PlusIcon />}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export { LABELS as FIELD_LABELS };
