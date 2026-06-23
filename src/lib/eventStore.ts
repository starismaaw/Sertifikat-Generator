import type { CertEvent } from '../types';

const KEY = 'sertifikat.events.v1';

function readAll(): CertEvent[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CertEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: CertEvent[]): void {
  localStorage.setItem(KEY, JSON.stringify(events));
}

export function listEvents(): CertEvent[] {
  return readAll();
}

export function getEvent(id: string): CertEvent | undefined {
  return readAll().find(e => e.id === id);
}

export function saveEvent(event: CertEvent): void {
  const all = readAll();
  const idx = all.findIndex(e => e.id === event.id);
  if (idx >= 0) all[idx] = event;
  else all.push(event);
  writeAll(all);
}

export function deleteEvent(id: string): void {
  writeAll(readAll().filter(e => e.id !== id));
}

/** Atomically claim and persist the next certificate number for an event. */
export function claimNextNumber(id: string): number {
  const all = readAll();
  const ev = all.find(e => e.id === id);
  if (!ev) throw new Error(`Event tidak ditemukan: ${id}`);
  const next = Math.max(ev.nomorTerakhir + 1, ev.nomorMulai);
  ev.nomorTerakhir = next;
  writeAll(all);
  return next;
}
