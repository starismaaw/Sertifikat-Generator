import { useToast } from '../contexts/ToastContext';

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 400,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 500,
      width: 'calc(100% - 32px)',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="sg-toast"
          role="alert"
          aria-live="assertive"
          style={{
            position: 'static',
            animation: 'sg-rise 0.3s ease',
            ...(toast.variant === 'error' ? { borderColor: 'rgba(220,38,38,0.3)', background: 'rgba(254,242,242,0.98)' } : {}),
            ...(toast.variant === 'warning' ? { borderColor: 'rgba(255,159,10,0.3)', background: 'rgba(255,251,235,0.98)' } : {}),
            ...(toast.variant === 'info' ? { borderColor: 'rgba(0,117,222,0.3)', background: 'rgba(239,246,255,0.98)' } : {}),
            ...(toast.variant === 'success' ? { borderColor: 'rgba(26,174,57,0.3)', background: 'rgba(240,253,244,0.98)' } : {}),
          }}
        >
          {toast.variant === 'success' && (
            <div className="sg-toast-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          {toast.variant === 'error' && (
            <div className="sg-toast-icon" style={{ background: 'var(--color-accent-red)' }} aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {toast.variant === 'warning' && (
            <div className="sg-toast-icon" style={{ background: '#f59e0b' }} aria-hidden="true">
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>!</span>
            </div>
          )}
          {toast.variant === 'info' && (
            <div className="sg-toast-icon" style={{ background: 'var(--color-primary)' }} aria-hidden="true">
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>i</span>
            </div>
          )}
          <span className="sg-toast-text">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
