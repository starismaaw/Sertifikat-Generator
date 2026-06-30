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
    if (view.name === 'pakta-admin') return [{ label: 'Admin Pakta', active: true }];
    
    // For views with eventId
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
    if (view.name === 'pakta-editor') return [
      { label: 'Admin Pakta', view: { name: 'pakta-admin' } },
      { label: evLabel, view: { name: 'pakta-dashboard', eventId: view.eventId } },
      { label: 'Editor Pakta', active: true },
    ];
    if (view.name === 'pakta-dashboard') return [
      { label: 'Admin Pakta', view: { name: 'pakta-admin' } },
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
      {view.name === 'pakta-admin' && <div>Pakta Admin View</div>}
      {view.name === 'pakta-editor' && <div>Pakta Editor View - {view.eventId}</div>}
      {view.name === 'pakta-dashboard' && <div>Pakta Dashboard View - {view.eventId}</div>}
    </div>
  );
}
