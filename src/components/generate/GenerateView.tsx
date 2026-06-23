import { useState } from 'react';
import { getEvent } from '../../lib/eventStore';
import { navigate } from '../AppRouter';
import { GenerateSingle } from './GenerateSingle';

export function GenerateView({ eventId }: { eventId: string }) {
  const event = getEvent(eventId);
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  if (!event) return <p>Acara tidak ditemukan. <button onClick={() => navigate({ name: 'home' })}>Kembali</button></p>;
  if (event.fields.length === 0)
    return <p>Template belum punya field. <button onClick={() => navigate({ name: 'editor', eventId })}>Buka editor</button></p>;

  return (
    <section>
      <button onClick={() => navigate({ name: 'home' })}>← Daftar Acara</button>
      <h2>Generate — {event.nama}</h2>
      <button onClick={() => setTab('single')} disabled={tab === 'single'}>Satuan</button>{' '}
      <button onClick={() => setTab('bulk')} disabled={tab === 'bulk'}>Massal</button>
      {tab === 'single' && <GenerateSingle event={event} />}
      {tab === 'bulk' && <p>Mode massal di task berikutnya.</p>}
    </section>
  );
}
