import { useEffect, useState } from 'react';

export function AutoSaveToast({ visible }: { visible: boolean }) {
  const [exiting, setExiting] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (visible) {
      setShown(true);
      setExiting(false);
      const timer = setTimeout(() => setExiting(true), 2000);
      const hideTimer = setTimeout(() => setShown(false), 2300);
      return () => { clearTimeout(timer); clearTimeout(hideTimer); };
    }
  }, [visible]);

  if (!shown) return null;

  return (
    <div className={`sg-toast ${exiting ? 'sg-toast-exit' : ''}`} role="status" aria-live="polite">
      <div className="sg-toast-icon">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="sg-toast-text">Perubahan tersimpan otomatis</span>
      <span className="sg-toast-sub">baru saja</span>
    </div>
  );
}
