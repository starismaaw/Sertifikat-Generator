import { useState } from 'react';
import type { CertEvent, Field, Perataan } from '../../types';
import { ColorPickerField } from './ColorPickerField';
import { AlignmentToolbar } from './AlignmentToolbar';
import { FIELD_LABELS } from './FieldPalette';
import { FONT_FAMILIES, FONT_WEIGHTS } from '../../lib/fontRegistry';

function safeNum(val: string, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function FieldProperties({
  event, selected, onField, onEvent, onDelete,
}: {
  event: CertEvent;
  selected: Field | undefined;
  onField: (patch: Partial<Field>) => void;
  onEvent: (patch: Partial<CertEvent>) => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'field' | 'acara'>('field');

  return (
    <div className="sg-properties-panel">
      {/* Tab bar */}
      <div className="sg-tab-bar">
        <button
          className={`sg-tab ${activeTab === 'field' ? 'active' : ''}`}
          onClick={() => setActiveTab('field')}
        >
          Field
        </button>
        <button
          className={`sg-tab ${activeTab === 'acara' ? 'active' : ''}`}
          onClick={() => setActiveTab('acara')}
        >
          Acara
        </button>
      </div>

      {/* Tab content */}
      <div className="sg-tab-content">
        {activeTab === 'field' && (
          <FieldTab
            selected={selected}
            onField={onField}
            onDelete={onDelete}
          />
        )}
        {activeTab === 'acara' && (
          <AcaraTab event={event} onEvent={onEvent} />
        )}
      </div>
    </div>
  );
}

function FieldTab({
  selected,
  onField,
  onDelete,
}: {
  selected: Field | undefined;
  onField: (patch: Partial<Field>) => void;
  onDelete: () => void;
}) {
  if (!selected) {
    return (
      <div style={{ color: 'var(--color-ink-muted)', fontSize: 13, marginTop: 8 }}>
        Pilih field di kanvas untuk mengatur propertinya.
      </div>
    );
  }

  return (
    <>
      {/* Selected field chip */}
      <div className="sg-field-chip" style={{ marginBottom: 16 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {FIELD_LABELS[selected.tipe]} terpilih
      </div>

      {/* Posisi & ukuran */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Posisi &amp; ukuran</div>
        <div className="sg-props-grid-2">
          <div className="sg-form-group" style={{ marginBottom: 0 }}>
            <label className="sg-label">X</label>
            <input
              className="sg-input"
              type="number"
              value={Math.round(selected.x)}
              onChange={e => onField({ x: safeNum(e.target.value, selected.x) })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="sg-form-group" style={{ marginBottom: 0 }}>
            <label className="sg-label">Y</label>
            <input
              className="sg-input"
              type="number"
              value={Math.round(selected.y)}
              onChange={e => onField({ y: safeNum(e.target.value, selected.y) })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="sg-form-group" style={{ marginBottom: 0 }}>
            <label className="sg-label">Lebar</label>
            <input
              className="sg-input"
              type="number"
              value={Math.round(selected.lebar)}
              onChange={e => onField({ lebar: safeNum(e.target.value, selected.lebar) })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="sg-form-group" style={{ marginBottom: 0 }}>
            <label className="sg-label">Ukuran (pt)</label>
            <input
              className="sg-input"
              type="number"
              value={selected.ukuran}
              onChange={e => onField({ ukuran: safeNum(e.target.value, selected.ukuran) })}
              style={{ fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      <div className="sg-event-divider" style={{ margin: '12px 0' }} />

      {/* Font */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Huruf</div>
        <select
          className="sg-select"
          value={selected.fontFamily}
          onChange={e => onField({ fontFamily: e.target.value })}
          style={{ marginBottom: 8 }}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="sg-select"
          value={selected.fontWeight}
          onChange={e => onField({ fontWeight: e.target.value as Field['fontWeight'] })}
        >
          {FONT_WEIGHTS.map(w => {
            const currentFont = FONT_FAMILIES.find(f => f.value === selected.fontFamily);
            const isItalicVariant = w.value === 'Italic' || w.value === 'BoldItalic';
            const disabled = isItalicVariant && currentFont ? !currentFont.hasItalic : false;
            return (
              <option key={w.value} value={w.value} disabled={disabled}>
                {w.label}
              </option>
            );
          })}
        </select>
      </div>

      <div className="sg-event-divider" style={{ margin: '12px 0' }} />

      {/* Perataan */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Perataan</div>
        <AlignmentToolbar
          value={selected.perataan}
          onChange={(v: Perataan) => onField({ perataan: v })}
        />
      </div>

      <div className="sg-event-divider" style={{ margin: '12px 0' }} />

      {/* Warna teks */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Warna teks</div>
        <ColorPickerField
          value={selected.warna}
          onChange={color => onField({ warna: color })}
        />
      </div>

      {/* Format (only for nama field) */}
      {selected.tipe === 'nama' && (
        <>
          <div className="sg-event-divider" style={{ margin: '12px 0' }} />
          <div className="sg-props-section">
            <div className="sg-props-section-title">Format</div>
            <div className="sg-format-toggle">
              <button
                className={`sg-format-btn ${selected.formatter === 'none' ? 'active' : ''}`}
                onClick={() => onField({ formatter: 'none' })}
              >
                Normal
              </button>
              <button
                className={`sg-format-btn ${selected.formatter === 'uppercase' ? 'active' : ''}`}
                onClick={() => onField({ formatter: 'uppercase' })}
              >
                HURUF KAPITAL
              </button>
            </div>
          </div>
        </>
      )}

      <div className="sg-event-divider" style={{ margin: '12px 0' }} />

      <button
        className="sg-btn sg-btn-danger"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={onDelete}
      >
        Hapus field
      </button>
    </>
  );
}

function AcaraTab({
  event,
  onEvent,
}: {
  event: CertEvent;
  onEvent: (patch: Partial<CertEvent>) => void;
}) {
  function safeNum(val: string, fallback: number): number {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  return (
    <>
      {/* Informasi acara */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Informasi acara</div>
        <div className="sg-form-group">
          <label className="sg-label">Nama acara</label>
          <input
            className="sg-input"
            value={event.nama}
            onChange={e => onEvent({ nama: e.target.value })}
          />
        </div>
        <div className="sg-form-group">
          <label className="sg-label">Tanggal acara</label>
          <input
            className="sg-input"
            type="date"
            value={event.tanggal}
            onChange={e => onEvent({ tanggal: e.target.value })}
          />
        </div>
      </div>

      <div className="sg-event-divider" style={{ margin: '12px 0' }} />

      {/* Penomoran */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Penomoran</div>
        <div className="sg-form-group">
          <label className="sg-label">Pola nomor</label>
          <input
            className="sg-input"
            value={event.polaNomor}
            onChange={e => onEvent({ polaNomor: e.target.value })}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
          />
          <div className="sg-hint" style={{ marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
            {'{n}'} {'{bulan}'} {'{tahun}'}
          </div>
        </div>
        <div className="sg-props-grid-2">
          <div className="sg-form-group" style={{ marginBottom: 0 }}>
            <label className="sg-label">Mulai dari</label>
            <input
              className="sg-input"
              type="number"
              value={event.nomorMulai}
              onChange={e => onEvent({ nomorMulai: safeNum(e.target.value, event.nomorMulai) })}
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="sg-form-group" style={{ marginBottom: 0 }}>
            <label className="sg-label">Padding</label>
            <input
              className="sg-input"
              type="number"
              value={event.nomorPadding}
              onChange={e => onEvent({ nomorPadding: safeNum(e.target.value, event.nomorPadding) })}
              style={{ fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      <div className="sg-event-divider" style={{ margin: '12px 0' }} />

      {/* Penandatangan */}
      <div className="sg-props-section">
        <div className="sg-props-section-title">Penandatangan</div>
        <div className="sg-form-group">
          <label className="sg-label">Nama</label>
          <input
            className="sg-input"
            value={event.penandatangan.nama}
            onChange={e => onEvent({ penandatangan: { ...event.penandatangan, nama: e.target.value } })}
          />
        </div>
        <div className="sg-form-group">
          <label className="sg-label">Jabatan</label>
          <input
            className="sg-input"
            value={event.penandatangan.jabatan}
            onChange={e => onEvent({ penandatangan: { ...event.penandatangan, jabatan: e.target.value } })}
          />
        </div>
      </div>
    </>
  );
}
