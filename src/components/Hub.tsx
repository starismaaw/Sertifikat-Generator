import { navigate } from './AppRouter';

function SertifikatIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="30" height="30" rx="4" />
      <path d="M11 14h18M11 19h18M11 24h12" />
      <circle cx="29" cy="28" r="4" />
      <path d="M26 32l-2 4 5-2 5 2-2-4" />
    </svg>
  );
}

function PaktaIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5h13l6 6v24a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M24 5v6h6" />
      <path d="M13 29c2-3 5-4 7-2M13 29l9-9c1-1 3 1 2 2l-9 9" />
    </svg>
  );
}

export function Hub() {
  return (
    <div className="sg-hub">
      <h1 className="sg-hub-title">Pilih modul</h1>
      <div className="sg-hub-grid">
        <button
          type="button"
          className="sg-hub-card"
          onClick={() => navigate({ name: 'sertifikat' })}
        >
          <div className="sg-hub-card-icon"><SertifikatIcon /></div>
          <span className="sg-hub-card-label">Sertifikat Generator</span>
        </button>
        <button
          type="button"
          className="sg-hub-card"
          onClick={() => navigate({ name: 'pakta-admin' })}
        >
          <div className="sg-hub-card-icon"><PaktaIcon /></div>
          <span className="sg-hub-card-label">Pakta Integritas</span>
        </button>
      </div>
    </div>
  );
}
