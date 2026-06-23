import './styles/apple-design.css';
import { useView } from './components/AppRouter';
import { EventList } from './components/EventList';
import { CertificateEditor } from './components/editor/CertificateEditor';
import { GenerateView } from './components/generate/GenerateView';

export default function App() {
  const view = useView();
  const pageClass =
    view.name === 'editor' ? 'apple-page apple-page-wide' :
    view.name === 'generate' ? 'apple-page apple-page-compact' :
    'apple-page apple-page-compact';

  return (
    <div className="apple-app">
      <nav className="apple-nav">
        <span className="apple-nav-title">Sertifikat Generator</span>
      </nav>
      <div className={pageClass}>
        {view.name === 'home' && <EventList />}
        {view.name === 'editor' && <CertificateEditor key={view.eventId} eventId={view.eventId} />}
        {view.name === 'generate' && <GenerateView key={view.eventId} eventId={view.eventId} />}
      </div>
    </div>
  );
}
