import { useState } from 'react';
import { getEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { Reveal } from '../Reveal';
import { GenerateSingle } from './GenerateSingle';
import { GenerateBulk } from './GenerateBulk';

export function GenerateView({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  if (!event) return (
    <Reveal>
      <div className="apple-empty">
        Acara tidak ditemukan.
        <br />
        <button className="apple-btn apple-btn-primary apple-mt-sm" onClick={() => navigate({ name: 'home' })}>Kembali</button>
      </div>
    </Reveal>
  );
  if (event.fields.length === 0) return (
    <Reveal>
      <div className="apple-empty">
        Template belum punya field.
        <br />
        <button className="apple-btn apple-btn-primary apple-mt-sm" onClick={() => navigate({ name: 'editor', eventId })}>Buka editor</button>
      </div>
    </Reveal>
  );

  return (
    <section>
      <Reveal>
        <div className="apple-flex-row apple-mb-md">
          <button className="apple-btn apple-btn-ghost" onClick={() => navigate({ name: 'home' })}>← Kembali</button>
        </div>
      </Reveal>
      <Reveal delay={1}>
        <div className="apple-mb-lg">
          <span className="apple-eyebrow">Generate</span>
          <h2 className="apple-h1">{event.nama}</h2>
        </div>
      </Reveal>
      <Reveal delay={2}>
        <div className="apple-segmented apple-mb-lg" role="tablist">
          <button className={'apple-btn' + (tab === 'single' ? ' active' : '')}
            onClick={() => setTab('single')} role="tab" aria-selected={tab === 'single'}>Satuan</button>
          <button className={'apple-btn' + (tab === 'bulk' ? ' active' : '')}
            onClick={() => setTab('bulk')} role="tab" aria-selected={tab === 'bulk'}>Massal</button>
        </div>
      </Reveal>
      <Reveal delay={3}>
        {tab === 'single' && <GenerateSingle event={event} />}
        {tab === 'bulk' && <GenerateBulk event={event} />}
      </Reveal>
    </section>
  );
}
