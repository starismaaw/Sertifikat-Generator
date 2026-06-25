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

  useEffect(() => {
    if (!editing) setDraft(nextN);
  }, [nextN, editing]);

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
    <div className="sg-nomor-counter">
      <span className="sg-nomor-label">Nomor berikutnya</span>
      {editing ? (
        <>
          <input
            ref={inputRef}
            className="sg-input"
            type="number"
            min={1}
            value={draft}
            style={{ width: 72, fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
            onChange={e => setDraft(Number(e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            onBlur={commit}
          />
          <span style={{ fontSize: 11, color: 'var(--color-ink-faint)' }}>Enter · Esc batal</span>
        </>
      ) : (
        <button
          className="sg-nomor-value"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}
          onClick={startEdit}
          title="Klik untuk ubah nomor mulai"
        >
          {display}
        </button>
      )}
      <button
        className="sg-btn sg-btn-outline"
        style={{ padding: '3px 10px', fontSize: 11.5, borderRadius: 6 }}
        onClick={startEdit}
        title="Atur ulang nomor"
      >
        Atur
      </button>
    </div>
  );
}
