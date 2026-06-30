import { useEffect, useState } from 'react';

export type View =
  | { name: 'home' }
  | { name: 'editor'; eventId: string }
  | { name: 'generate'; eventId: string }
  | { name: 'pakta-admin' }
  | { name: 'pakta-editor'; eventId: string }
  | { name: 'pakta-dashboard'; eventId: string };

function parseHash(): View {
  const h = window.location.hash.replace(/^#/, '');
  const [name, id] = h.split('/');
  if (name === 'editor' && id)           return { name: 'editor', eventId: id };
  if (name === 'generate' && id)         return { name: 'generate', eventId: id };
  if (name === 'pakta-admin')            return { name: 'pakta-admin' };
  if (name === 'pakta-editor' && id)     return { name: 'pakta-editor', eventId: id };
  if (name === 'pakta-dashboard' && id)  return { name: 'pakta-dashboard', eventId: id };
  return { name: 'home' };
}

export function navigate(view: View): void {
  if (view.name === 'home')              window.location.hash = '';
  else if (view.name === 'pakta-admin') window.location.hash = 'pakta-admin';
  else window.location.hash = `${view.name}/${view.eventId}`;
}

export function useView(): View {
  const [view, setView] = useState<View>(parseHash);
  useEffect(() => {
    const onChange = () => setView(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return view;
}
