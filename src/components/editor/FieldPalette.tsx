import type { FieldTipe } from '../../types';

const LABELS: Record<FieldTipe, string> = {
  nama: 'Nama peserta', nomor: 'Nomor sertifikat', acara: 'Nama acara',
  tanggal: 'Tanggal acara', peran: 'Peran',
  namaPenandatangan: 'Nama penandatangan', penandatangan: 'Jabatan penandatangan',
};

export function FieldPalette({ onAdd, used }: { onAdd: (t: FieldTipe) => void; used: Set<FieldTipe> }) {
  return (
    <div style={{ width: 160 }}>
      <h3>Field</h3>
      {(Object.keys(LABELS) as FieldTipe[]).map(t => (
        <button key={t} disabled={used.has(t)} onClick={() => onAdd(t)}
          style={{ display: 'block', width: '100%', margin: '4px 0', textAlign: 'left' }}>
          + {LABELS[t]}
        </button>
      ))}
    </div>
  );
}

export { LABELS as FIELD_LABELS };
