import { useState, useEffect, useRef } from 'react';
import type { CertEvent } from '../../types';
import { resetCounter } from '../../lib/eventStore';

interface Props {
  event: CertEvent;
  onReset: (updated: CertEvent) => void;
}

export function NomorCounter({ event, onReset }: Props) {
  const nextN = Math.max(event.nomorTerakhir + 1, event.nomorMulai);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nextN);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft setiap kali nextN berubah dari luar (mis. setelah generate).
  useEffect(() => {
    if (!editing) setDraft(nextN);
  }, [nextN, editing]);

  // Auto-select saat input muncul.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(nextN);
    setEditing(true);
  }

  function commit() {
    const n = Math.max(1, Math.floor(draft));
    onReset(resetCounter(event.id, n));
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  const display = String(nextN).padStart(event.nomorPadding, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span className="apple-caption">Nomor berikutnya:</span>
      {editing ? (
        <>
          <input
            ref={inputRef}
            className="apple-input apple-input-sm"
            type="number"
            min={1}
            value={draft}
            style={{ width: 80 }}
            onChange={e => setDraft(Number(e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            onBlur={commit}
          />
          <span className="apple-fine">Enter simpan · Esc batal</span>
        </>
      ) : (
        <button
          className="apple-btn apple-btn-ghost"
          style={{ fontWeight: 600, padding: '2px 10px', fontSize: 14 }}
          onClick={startEdit}
          title="Klik untuk ubah nomor mulai"
        >
          {display} ✎
        </button>
      )}
    </div>
  );
}
