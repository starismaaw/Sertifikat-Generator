import { useState } from 'react';
import type { CertEvent, Field, FieldTipe } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { getEvent, saveEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { Reveal } from '../Reveal';
import { FieldPalette } from './FieldPalette';
import { EditorCanvas } from './EditorCanvas';
import { FieldProperties } from './FieldProperties';

function newField(tipe: FieldTipe, ev: CertEvent): Field {
  return {
    id: crypto.randomUUID(), tipe,
    x: ev.bgWidth * 0.2, y: ev.bgHeight * 0.5, lebar: ev.bgWidth * 0.6,
    font: 'Helvetica', ukuran: Math.round(ev.bgHeight * 0.04),
    warna: '#000000', perataan: 'center',
  };
}

export function CertificateEditor({ eventId }: { eventId: string }) {
  const { save } = useEvents();
  const [event, setEvent] = useState<CertEvent | undefined>(() => getEvent(eventId));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!event) return <p>Acara tidak ditemukan. <button onClick={() => navigate({ name: 'home' })}>Kembali</button></p>;

  const update = (next: CertEvent) => { setEvent(next); save(next); };
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

  return (
    <div>
      <Reveal>
        <div className="apple-flex-row apple-mb-md">
          <button className="apple-btn apple-btn-ghost" onClick={() => navigate({ name: 'home' })}>
            ← Kembali
          </button>
        </div>
      </Reveal>
      <Reveal delay={1}>
        <div>
          <span className="apple-eyebrow">Editor Template</span>
          <h2 className="apple-h1 apple-mb-lg">{event.nama}</h2>
        </div>
      </Reveal>
      <div className="apple-editor-layout">
        <Reveal delay={2}><FieldPalette onAdd={addField} used={used} /></Reveal>
        <Reveal delay={3} className="apple-editor-center">
          <EditorCanvas event={event} selectedId={selectedId} onSelect={setSelectedId} onMove={moveField} />
        </Reveal>
        <Reveal delay={2}>
          <FieldProperties event={event} selected={selected}
            onField={patchField} onEvent={patchEvent} onDelete={deleteField} onMove={moveField} />
        </Reveal>
      </div>
    </div>
  );
}
