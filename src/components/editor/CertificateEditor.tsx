import { useState } from 'react';
import type { CertEvent, Field, FieldTipe } from '../../types';
import { useEvents } from '../../hooks/useEvents';
import { getEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { FieldPalette } from './FieldPalette';

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

  void selectedId; // used in Task 12 by FieldProperties

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <FieldPalette onAdd={addField} used={used} />
      <div style={{ flex: 1 }} id="editor-canvas-slot">
        {/* EditorCanvas mounts here in Task 11 */}
        <p>Kanvas akan tampil di sini.</p>
      </div>
      <div style={{ width: 220 }} id="editor-props-slot">
        {/* FieldProperties mounts here in Task 12 */}
        <button onClick={() => navigate({ name: 'home' })}>← Daftar Acara</button>
      </div>
    </div>
  );
}
