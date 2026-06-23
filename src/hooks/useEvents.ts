import { useCallback, useEffect, useState } from 'react';
import type { CertEvent } from '../types';
import { listEvents, saveEvent, deleteEvent } from '../lib/eventStore';

export function useEvents() {
  const [events, setEvents] = useState<CertEvent[]>([]);

  const refresh = useCallback(() => setEvents(listEvents()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback((e: CertEvent) => { saveEvent(e); refresh(); }, [refresh]);
  const remove = useCallback((id: string) => { deleteEvent(id); refresh(); }, [refresh]);

  return { events, save, remove, refresh };
}
