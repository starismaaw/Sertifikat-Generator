import type { CertEvent, Field, Perataan } from '../../types';

const FONTS: Field['font'][] = ['Helvetica', 'Times', 'Courier'];

function safeNum(val: string, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const ALIGNS: Perataan[] = ['left', 'center', 'right'];

export function FieldProperties({
  event, selected, onField, onEvent, onDelete,
}: {
  event: CertEvent;
  selected: Field | undefined;
  onField: (patch: Partial<Field>) => void;
  onEvent: (patch: Partial<CertEvent>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="apple-editor-sidebar-right">
      <h3 className="apple-h4 apple-mb-sm">Pengaturan Acara</h3>
      <div className="apple-form-group">
        <label className="apple-label">Nama acara</label>
        <input className="apple-input" value={event.nama} onChange={e => onEvent({ nama: e.target.value })} />
      </div>
      <div className="apple-form-group">
        <label className="apple-label">Tanggal</label>
        <input className="apple-input" type="date" value={event.tanggal} onChange={e => onEvent({ tanggal: e.target.value })} />
      </div>
      <div className="apple-form-group">
        <label className="apple-label">Pola nomor</label>
        <input className="apple-input" value={event.polaNomor} onChange={e => onEvent({ polaNomor: e.target.value })} />
        <span className="apple-hint">{'{n'} {'{bulan}'} {'{tahun}'}</span>
      </div>
      <div className="apple-flex-row">
        <div className="apple-form-group">
          <label className="apple-label">Mulai</label>
          <input className="apple-input apple-input-sm" type="number" style={{ width: 70 }} value={event.nomorMulai}
            onChange={e => onEvent({ nomorMulai: safeNum(e.target.value, event.nomorMulai) })} />
        </div>
        <div className="apple-form-group">
          <label className="apple-label">Padding</label>
          <input className="apple-input apple-input-sm" type="number" style={{ width: 60 }} value={event.nomorPadding}
            onChange={e => onEvent({ nomorPadding: safeNum(e.target.value, event.nomorPadding) })} />
        </div>
      </div>
      <div className="apple-form-group">
        <label className="apple-label">Penandatangan (nama)</label>
        <input className="apple-input" value={event.penandatangan.nama}
          onChange={e => onEvent({ penandatangan: { ...event.penandatangan, nama: e.target.value } })} />
      </div>
      <div className="apple-form-group">
        <label className="apple-label">Penandatangan (jabatan)</label>
        <input className="apple-input" value={event.penandatangan.jabatan}
          onChange={e => onEvent({ penandatangan: { ...event.penandatangan, jabatan: e.target.value } })} />
      </div>

      <hr className="apple-field-divider" />
      <h3 className="apple-h4 apple-mb-sm">Properti Field</h3>
      {!selected && <p className="apple-caption">Pilih field di kanvas.</p>}
      {selected && (
        <>
          <div className="apple-form-group">
            <label className="apple-label">Font</label>
            <select className="apple-select" value={selected.font} onChange={e => onField({ font: e.target.value as Field['font'] })}>
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="apple-flex-row">
            <div className="apple-form-group">
              <label className="apple-label">Ukuran</label>
              <input className="apple-input apple-input-sm" type="number" style={{ width: 70 }} value={selected.ukuran}
                onChange={e => onField({ ukuran: safeNum(e.target.value, selected.ukuran) })} />
            </div>
            <div className="apple-form-group">
              <label className="apple-label">Lebar</label>
              <input className="apple-input apple-input-sm" type="number" style={{ width: 80 }} value={Math.round(selected.lebar)}
                onChange={e => onField({ lebar: safeNum(e.target.value, selected.lebar) })} />
            </div>
          </div>
          <div className="apple-form-group">
            <label className="apple-label">Warna</label>
            <input className="apple-input" type="color" value={selected.warna}
              onChange={e => onField({ warna: e.target.value })} style={{ padding: 4, height: 40 }} />
          </div>
          <div className="apple-form-group">
            <label className="apple-label">Perataan</label>
            <select className="apple-select" value={selected.perataan} onChange={e => onField({ perataan: e.target.value as Perataan })}>
              {ALIGNS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <button className="apple-btn apple-btn-danger apple-mt-sm" onClick={onDelete}>Hapus field</button>
        </>
      )}
    </div>
  );
}
