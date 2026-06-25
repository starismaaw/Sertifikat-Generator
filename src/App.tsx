import './styles/apple-design.css';
import { useState } from 'react';
import { useView } from './components/AppRouter';
import { EventList } from './components/EventList';
import { CertificateEditor } from './components/editor/CertificateEditor';
import { GenerateView } from './components/generate/GenerateView';
import { AppTopbar, type BreadcrumbItem, type SaveState } from './components/AppTopbar';
import { getEvent } from './lib/eventStore';

export default function App() {
  const view = useView();
  const [saveState] = useState<SaveState>('synced');

  const breadcrumbs: BreadcrumbItem[] = (() => {
    if (view.name === 'home') return [{ label: 'Beranda', active: true }];
    const ev = getEvent(view.eventId);
    const evLabel = ev?.nama ?? 'Kegiatan';
    if (view.name === 'editor') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: evLabel, view: { name: 'generate', eventId: view.eventId } },
      { label: 'Editor templat', active: true },
    ];
    if (view.name === 'generate') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: evLabel, active: true },
    ];
    return [{ label: 'Beranda', active: true }];
  })();

  return (
    <div className="apple-app">
      <AppTopbar
        breadcrumbs={breadcrumbs}
        saveState={view.name === 'editor' ? saveState : 'synced'}
      />
      {view.name === 'home' && <EventList />}
      {view.name === 'editor' && <CertificateEditor key={view.eventId} eventId={view.eventId} />}
      {view.name === 'generate' && <GenerateView key={view.eventId} eventId={view.eventId} />}
    </div>
  );
}
