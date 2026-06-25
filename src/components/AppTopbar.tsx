import { navigate } from './AppRouter';

export type BreadcrumbItem =
  | { label: string; view: Parameters<typeof navigate>[0] }
  | { label: string; active: true };

export type SaveState = 'saved' | 'saving' | 'synced';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 7.5L6.5 9.5L9.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M10.5 9.5H10A4 4 0 0 0 3.5 7.5a3 3 0 0 0 .5 5.99h6.5a2 2 0 0 0 0-4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="sg-breadcrumb-sep" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5.5 3.5L8.5 7L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppTopbar({
  breadcrumbs,
  saveState = 'synced',
}: {
  breadcrumbs: BreadcrumbItem[];
  saveState?: SaveState;
}) {
  return (
    <header className="sg-topbar">
      <div className="sg-topbar-logo">S</div>
      <nav className="sg-breadcrumb" aria-label="Navigasi">
        {breadcrumbs.map((item, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              {idx > 0 && <ChevronIcon />}
              {'active' in item ? (
                <span className="sg-breadcrumb-item active">{item.label}</span>
              ) : (
                <button
                  className="sg-breadcrumb-item"
                  onClick={() => navigate(item.view)}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      <div className="sg-topbar-right">
        <div className={`sg-save-indicator ${saveState === 'saved' ? 'saved' : ''}`}>
          {saveState === 'saved' || saveState === 'saving' ? (
            <>
              <CheckIcon />
              <span>{saveState === 'saved' ? 'Tersimpan otomatis · baru saja' : 'Menyimpan…'}</span>
            </>
          ) : (
            <>
              <CloudIcon />
              <span>Local</span>
            </>
          )}
        </div>
        <div className="sg-topbar-divider" />
        <span className="sg-topbar-org">Balai P3KP Jawa III</span>
        <div className="sg-topbar-avatar" title="Operator">OP</div>
      </div>
    </header>
  );
}
