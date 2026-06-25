import { useState } from 'react';
import { getEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { GenerateSingle } from './GenerateSingle';
import { GenerateBulk } from './GenerateBulk';
import { NomorCounter } from './NomorCounter';
import type { CertEvent } from '../../types';

export function GenerateView({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<CertEvent | undefined>(() => getEvent(eventId));
  const [tab, setTab] = useState<'single' | 'bulk'>('single');

  if (!event) return (
    <div className="sg-generate-page">
      <div className="sg-card sg-card-pad" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--color-ink-muted)', marginBottom: 16 }}>Acara tidak ditemukan.</p>
        <button className="sg-btn sg-btn-primary" onClick={() => navigate({ name: 'home' })}>
          Kembali ke Beranda
        </button>
      </div>
    </div>
  );

  if (event.fields.length === 0) return (
    <div className="sg-generate-page">
      <div className="sg-card sg-card-pad" style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--color-ink-muted)', marginBottom: 16 }}>
          Template belum punya field. Buka editor untuk menambahkan field peserta.
        </p>
        <button className="sg-btn sg-btn-primary" onClick={() => navigate({ name: 'editor', eventId })}>
          Buka Editor
        </button>
      </div>
    </div>
  );

  return (
    <div className="sg-generate-page">
      {/* Header */}
      <div className="sg-generate-header">
        <h1 className="sg-generate-title">Cetak sertifikat</h1>
        <div className="sg-generate-subtitle">{event.nama}</div>
      </div>

      {/* Tabs row + nomor counter */}
      <div className="sg-generate-tabs-row">
        <div className="sg-segmented" role="tablist">
          <button
            className={`sg-segmented-btn ${tab === 'single' ? 'active' : ''}`}
            onClick={() => setTab('single')}
            role="tab"
            aria-selected={tab === 'single'}
          >
            Satuan
          </button>
          <button
            className={`sg-segmented-btn ${tab === 'bulk' ? 'active' : ''}`}
            onClick={() => setTab('bulk')}
            role="tab"
            aria-selected={tab === 'bulk'}
          >
            Massal
          </button>
        </div>
        <NomorCounter event={event} onReset={setEvent} />
      </div>

      {/* Content */}
      {tab === 'single' && <GenerateSingle event={event} onGenerate={setEvent} />}
      {tab === 'bulk' && <GenerateBulk event={event} onGenerate={setEvent} />}
    </div>
  );
}
