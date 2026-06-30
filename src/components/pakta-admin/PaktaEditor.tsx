import { useState, useEffect, useCallback } from 'react';
import type { CertEvent, Field, FieldTipe } from '../../types';
import { EditorCanvas } from '../editor/EditorCanvas';
import { FieldProperties } from '../editor/FieldProperties';
import { PaktaPalette } from './PaktaPalette';
import { AutoSaveToast } from '../AutoSaveToast';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';

interface PaktaState {
  eventId: string;
  nama: string;
  tanggal: string;
  templatePath: string;
  background: string;
  bgWidth: number;
  bgHeight: number;
  fields: Field[];
}

/** Konversi PaktaState ke CertEvent palsu agar EditorCanvas & FieldProperties bisa dipakai. */
function toFakeCertEvent(ps: PaktaState): CertEvent {
  return {
    id: ps.eventId,
    nama: ps.nama,
    tanggal: ps.tanggal,
    background: ps.background,
    bgWidth: ps.bgWidth,
    bgHeight: ps.bgHeight,
    fields: ps.fields,
    polaNomor: '',
    nomorMulai: 1,
    nomorPadding: 3,
    nomorTerakhir: 0,
    penandatangan: { nama: '', jabatan: '' },
  };
}

function newPaktaField(tipe: FieldTipe, bgWidth: number, bgHeight: number): Field {
  return {
    id: crypto.randomUUID(),
    tipe,
    x: bgWidth * 0.2,
    y: bgHeight * 0.5,
    lebar: bgWidth * 0.6,
    fontFamily: 'Playfair Display',
    fontWeight: 'Regular' as const,
    ukuran: Math.round(bgHeight * 0.04),
    warna: '#000000',
    perataan: 'center',
    formatter: 'none',
    ...(tipe === 'tandaTangan' ? { tinggi: Math.round(bgWidth * 0.6 * 0.4) } : {}),
  };
}

/** Dapatkan public URL gambar template dari Supabase (bucket pakta-templates harus public). */
function templateUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/pakta-templates/${path}`;
}

export function PaktaEditor({ eventId }: { eventId: string }) {
  const { callAdmin } = usePaktaAdmin();
  const [state, setState] = useState<PaktaState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState('');

  const triggerToast = useCallback(() => {
    setToastKey(k => k + 1);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 100);
    setTimeout(() => setShowToast(true), 200);
  }, []);

  useEffect(() => {
    callAdmin<{ event: { id: string; nama: string; tanggal: string; template_path: string; bg_width: number; bg_height: number; fields: Field[] } }>(
      'get_event',
      { id: eventId },
    ).then(({ event: ev }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const background = templateUrl(supabaseUrl, ev.template_path ?? '');
      setState({
        eventId: ev.id,
        nama: ev.nama,
        tanggal: ev.tanggal,
        templatePath: ev.template_path ?? '',
        background,
        bgWidth: ev.bg_width,
        bgHeight: ev.bg_height,
        fields: ev.fields ?? [],
      });
    }).catch(err => setError((err as Error).message));
  }, [eventId, callAdmin]);

  async function save(next: PaktaState) {
    setSaving(true);
    try {
      await callAdmin('update_event', {
        id: next.eventId,
        fields: next.fields,
      });
      triggerToast();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return (
    <div style={{ padding: 40 }}>
      <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>
      <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
    </div>
  );

  if (!state) return <div style={{ padding: 40 }}><p className="apple-caption">Memuat editor…</p></div>;

  const fakeCertEvent = toFakeCertEvent(state);
  const used = new Set(state.fields.map(f => f.tipe));
  const selectedField = state.fields.find(f => f.id === selectedId);

  function addField(tipe: FieldTipe) {
    const f = newPaktaField(tipe, state!.bgWidth, state!.bgHeight);
    const next = { ...state!, fields: [...state!.fields, f] };
    setState(next);
    save(next);
    setSelectedId(f.id);
  }

  function updateField(id: string, patch: Partial<Field>) {
    const fields = state!.fields.map(f => f.id === id ? { ...f, ...patch } : f);
    const next = { ...state!, fields };
    setState(next);
    save(next);
  }

  function deleteField(id: string) {
    const fields = state!.fields.filter(f => f.id !== id);
    const next = { ...state!, fields };
    setState(next);
    setSelectedId(null);
    save(next);
  }

  return (
    <div className="sg-editor-layout">
      {/* Sidebar kiri: palet */}
      <aside className="sg-editor-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="sg-btn sg-btn-outline" style={{ fontSize: 12 }} onClick={() => navigate({ name: 'pakta-admin' })}>
            ← Kembali
          </button>
          {saving && <span className="apple-caption">Menyimpan…</span>}
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--color-ink-muted)' }}>
          {state.nama}
        </div>
        <PaktaPalette onAdd={addField} used={used} />
      </aside>

      {/* Tengah: kanvas */}
      <main className="sg-editor-main">
        <div className="sg-editor-toolbar">
          <button
            className={`sg-btn sg-btn-icon ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Grid"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1 5h13M1 10h13M5 1v13M10 1v13" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
        <EditorCanvas
          event={fakeCertEvent}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => updateField(id, { x, y })}
          showGrid={showGrid}
        />
      </main>

      {/* Sidebar kanan: properties */}
      <aside className="sg-editor-sidebar-right">
        <FieldProperties
          event={fakeCertEvent}
          selected={selectedField}
          onField={patch => selectedId && updateField(selectedId, patch)}
          onEvent={() => {}} // Pakta tidak pakai tab Acara
          onDelete={() => selectedId && deleteField(selectedId)}
        />
      </aside>

      <AutoSaveToast key={toastKey} visible={showToast} />
    </div>
  );
}
