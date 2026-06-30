import './styles/apple-design.css';
import { useState } from 'react';
import { useView } from './components/AppRouter';
import { EventList } from './components/EventList';
import { CertificateEditor } from './components/editor/CertificateEditor';
import { GenerateView } from './components/generate/GenerateView';
import { AppTopbar, type BreadcrumbItem, type SaveState } from './components/AppTopbar';
import { getEvent } from './lib/eventStore';
import { PaktaAdminProvider, usePaktaAdmin } from './contexts/PaktaAdminContext';
import { AdminLogin } from './components/pakta-admin/AdminLogin';
import { PaktaEventList } from './components/pakta-admin/PaktaEventList';
import { PaktaEditor } from './components/pakta-admin/PaktaEditor';
import { PaktaDashboard } from './components/pakta-admin/PaktaDashboard';
import { PaktaSignPage } from './components/pakta-signer/PaktaSignPage';

function PaktaAdminRoot() {
  const { isLoggedIn } = usePaktaAdmin();
  const view = useView();

  if (view.name === 'pakta-admin' || view.name === 'pakta-editor' || view.name === 'pakta-dashboard') {
    if (!isLoggedIn) return <AdminLogin />;
    if (view.name === 'pakta-admin')     return <PaktaEventList />;
    if (view.name === 'pakta-editor')    return <PaktaEditor key={view.eventId} eventId={view.eventId} />;
    if (view.name === 'pakta-dashboard') return <PaktaDashboard key={view.eventId} eventId={view.eventId} />;
  }
  return null;
}

export default function App() {
  const view = useView();
  const [saveState] = useState<SaveState>('synced');

  // Halaman publik — tidak butuh admin context
  if (view.name === 'pakta-signer') {
    return <PaktaSignPage key={view.eventId} eventId={view.eventId} />;
  }

  const isPaktaView = view.name === 'pakta-admin' || view.name === 'pakta-editor' || view.name === 'pakta-dashboard';

  const breadcrumbs: BreadcrumbItem[] = (() => {
    if (isPaktaView) return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: 'Pakta Integritas', view: { name: 'pakta-admin' } },
      ...(view.name === 'pakta-editor' ? [{ label: 'Editor Templat', active: true as const }] : []),
      ...(view.name === 'pakta-dashboard' ? [{ label: 'Dashboard', active: true as const }] : []),
    ];
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
    <PaktaAdminProvider>
      <div className="apple-app">
        <AppTopbar
          breadcrumbs={breadcrumbs}
          saveState={view.name === 'editor' ? saveState : 'synced'}
        />
        {isPaktaView && <PaktaAdminRoot />}
        {!isPaktaView && view.name === 'home' && <EventList />}
        {!isPaktaView && view.name === 'editor' && <CertificateEditor key={view.eventId} eventId={view.eventId} />}
        {!isPaktaView && view.name === 'generate' && <GenerateView key={view.eventId} eventId={view.eventId} />}
      </div>
    </PaktaAdminProvider>
  );
}
