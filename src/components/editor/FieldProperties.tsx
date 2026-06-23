import type { CertEvent, Field, Perataan } from '../../types';

const FONTS = ['Helvetica', 'Times', 'Courier'];
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
    <div>
      <h3>Pengaturan Acara</h3>
      <label>Nama acara<br />
        <input value={event.nama} onChange={e => onEvent({ nama: e.target.value })} /></label><br />
      <label>Tanggal<br />
        <input type="date" value={event.tanggal} onChange={e => onEvent({ tanggal: e.target.value })} /></label><br />
      <label>Pola nomor<br />
        <input value={event.polaNomor} onChange={e => onEvent({ polaNomor: e.target.value })} /></label>
      <small> — {'{n}'} {'{bulan}'} {'{tahun}'}</small><br />
      <label>Nomor mulai <input type="number" style={{ width: 60 }} value={event.nomorMulai}
        onChange={e => onEvent({ nomorMulai: Number(e.target.value) })} /></label>{' '}
      <label>Padding <input type="number" style={{ width: 50 }} value={event.nomorPadding}
        onChange={e => onEvent({ nomorPadding: Number(e.target.value) })} /></label><br />
      <label>Penandatangan (nama)<br />
        <input value={event.penandatangan.nama}
          onChange={e => onEvent({ penandatangan: { ...event.penandatangan, nama: e.target.value } })} /></label><br />
      <label>Penandatangan (jabatan)<br />
        <input value={event.penandatangan.jabatan}
          onChange={e => onEvent({ penandatangan: { ...event.penandatangan, jabatan: e.target.value } })} /></label>

      <h3>Properti Field</h3>
      {!selected && <p><em>Pilih field di kanvas.</em></p>}
      {selected && (
        <>
          <label>Font{' '}
            <select value={selected.font} onChange={e => onField({ font: e.target.value })}>
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select></label><br />
          <label>Ukuran <input type="number" style={{ width: 60 }} value={selected.ukuran}
            onChange={e => onField({ ukuran: Number(e.target.value) })} /></label><br />
          <label>Warna <input type="color" value={selected.warna}
            onChange={e => onField({ warna: e.target.value })} /></label><br />
          <label>Lebar <input type="number" style={{ width: 70 }} value={Math.round(selected.lebar)}
            onChange={e => onField({ lebar: Number(e.target.value) })} /></label><br />
          <label>Perataan{' '}
            <select value={selected.perataan} onChange={e => onField({ perataan: e.target.value as Perataan })}>
              {ALIGNS.map(a => <option key={a}>{a}</option>)}
            </select></label><br />
          <button onClick={onDelete} style={{ marginTop: 8, color: 'crimson' }}>Hapus field</button>
        </>
      )}
    </div>
  );
}
