import type { FieldTipe } from '../../types';

const LABELS: Record<FieldTipe, string> = {
  nama: 'Nama peserta', nomor: 'Nomor sertifikat', acara: 'Nama acara',
  tanggal: 'Tanggal acara', peran: 'Peran',
  namaPenandatangan: 'Nama penandatangan', penandatangan: 'Jabatan penandatangan',
};

export function FieldPalette({ onAdd, used }: { onAdd: (t: FieldTipe) => void; used: Set<FieldTipe> }) {
  return (
    <div className="apple-editor-sidebar">
      <h3 className="apple-h4 apple-mb-sm">Field</h3>
      <div className="apple-field-list">
        {(Object.keys(LABELS) as FieldTipe[]).map(t => (
          <button key={t} className="apple-field-btn" disabled={used.has(t)} onClick={() => onAdd(t)}>
            + {LABELS[t]}
          </button>
        ))}
      </div>
      <p className="apple-caption apple-mt-sm">Setiap tipe field hanya bisa ditambahkan sekali.</p>
    </div>
  );
}

export { LABELS as FIELD_LABELS };
