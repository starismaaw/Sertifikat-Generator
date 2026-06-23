import { useView } from './components/AppRouter';

export default function App() {
  const view = useView();
  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>Generator Sertifikat</h1>
      <p>View aktif: {view.name}</p>
    </main>
  );
}
