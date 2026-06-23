import { useView } from './components/AppRouter';
import { EventList } from './components/EventList';

export default function App() {
  const view = useView();
  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>Generator Sertifikat</h1>
      {view.name === 'home' && <EventList />}
      {view.name !== 'home' && <p>View: {view.name} (akan diisi di task berikutnya)</p>}
    </main>
  );
}
