import { useState, useCallback } from 'react';
import type { CertEvent, Field, FieldTipe } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { getEvent, saveEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { FieldPalette } from './FieldPalette';
import { EditorCanvas } from './EditorCanvas';
import { FieldProperties } from './FieldProperties';
import { AutoSaveToast } from '../AutoSaveToast';

function newField(tipe: FieldTipe, ev: CertEvent): Field {
  return {
    id: crypto.randomUUID(), tipe,
    x: ev.bgWidth * 0.2, y: ev.bgHeight * 0.5, lebar: ev.bgWidth * 0.6,
    font: 'Helvetica', ukuran: Math.round(ev.bgHeight * 0.04),
    warna: '#000000', perataan: 'center',
    formatter: 'none',
  };
}

function UndoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 6H9a4 4 0 0 1 0 8H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6L5.5 3.5M3 6L5.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M12 6H6A4 4 0 0 0 6 14h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6L9.5 3.5M12 6L9.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1 5h13M1 10h13M5 1v13M10 1v13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function CertificateEditor({ eventId }: { eventId: string }) {
  const { save } = useEvents();
  const [event, setEvent] = useState<CertEvent | undefined>(() => getEvent(eventId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const triggerToast = useCallback(() => {
    setToastKey(k => k + 1);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 100);
    setTimeout(() => setShowToast(true), 200);
  }, []);

  if (!event) return (
    <div style={{ padding: 40 }}>
      <p style={{ color: 'var(--color-ink-muted)', marginBottom: 12 }}>Acara tidak ditemukan.</p>
      <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'home' })}>
        ← Kembali
      </button>
    </div>
  );

  const update = (next: CertEvent) => {
    setEvent(next);
    save(next);
    triggerToast();
  };

  const used = new Set(event.fields.map(f => f.tipe));

  const addField = (tipe: FieldTipe) => {
    const f = newField(tipe, event);
    update({ ...event, fields: [...event.fields, f] });
    setSelectedId(f.id);
  };

  const moveField = (id: string, x: number, y: number) => {
    setEvent(prev => {
      if (!prev) return prev;
      const next = { ...prev, fields: prev.fields.map(f => f.id === id ? { ...f, x, y } : f) };
      saveEvent(next);
      return next;
    });
    triggerToast();
  };

  const selected = event.fields.find(f => f.id === selectedId);
  const patchField = (patch: Partial<Field>) => {
    if (!selected) return;
    update({ ...event, fields: event.fields.map(f => f.id === selected.id ? { ...f, ...patch } : f) });
  };
  const patchEvent = (patch: Partial<CertEvent>) => update({ ...event, ...patch });
  const deleteField = () => {
    if (!selected) return;
    update({ ...event, fields: event.fields.filter(f => f.id !== selected.id) });
    setSelectedId(null);
  };

  const scale = Math.min(1, 700 / event.bgWidth);

  return (
    <div className="sg-editor-layout">
      {/* Left palette */}
      <FieldPalette onAdd={addField} used={used} />

      {/* Canvas area */}
      <div className="sg-editor-canvas-wrap">
        {/* Toolbar */}
        <div className="sg-editor-toolbar">
          <button className="sg-toolbar-btn" title="Urungkan (tidak tersedia)">
            <UndoIcon />
          </button>
          <button className="sg-toolbar-btn" title="Ulangi (tidak tersedia)">
            <RedoIcon />
          </button>
          <div className="sg-editor-toolbar-divider" />
          <button
            className={`sg-toolbar-btn ${showGrid ? 'active' : ''}`}
            title="Toggle grid"
            onClick={() => setShowGrid(g => !g)}
          >
            <GridIcon />
          </button>
          <div className="sg-toolbar-right">
            <span>{Math.round(scale * 100)}%</span>
            <span style={{ color: 'var(--color-hairline)' }}>·</span>
            <span>{event.bgWidth}×{event.bgHeight}</span>
            <div className="sg-editor-toolbar-divider" />
            <button
              className="sg-btn sg-btn-primary"
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6 }}
              onClick={() => navigate({ name: 'generate', eventId })}
            >
              Cetak →
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="sg-canvas-area">
          <EditorCanvas
            event={event}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={moveField}
            showGrid={showGrid}
          />
          <div className="sg-canvas-hint">
            Seret field untuk memindahkan · klik untuk mengatur
          </div>
        </div>
      </div>

      {/* Right properties */}
      <FieldProperties
        event={event}
        selected={selected}
        onField={patchField}
        onEvent={patchEvent}
        onDelete={deleteField}
      />

      {/* Auto-save toast */}
      <AutoSaveToast key={toastKey} visible={showToast} />
    </div>
  );
}
