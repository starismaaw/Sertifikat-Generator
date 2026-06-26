import type { CertEvent } from '../types';

const KEY = 'sertifikat.events.v1';

function readAll(): CertEvent[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const events = parsed as CertEvent[];
    events.forEach(e => e.fields.forEach(f => {
      if (!f.formatter) f.formatter = 'none';
      const legacy = f as unknown as Record<string, unknown>;
      if (!f.fontFamily) {
        f.fontFamily = 'Playfair Display';
        f.fontWeight = 'Regular';
        delete legacy['font'];
      }
    }));
    return events;
  } catch {
    return [];
  }
}

function writeAll(events: CertEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch (e) {
    throw new Error('Penyimpanan penuh. Hapus acara lama untuk melanjutkan.');
  }
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

/** Reset counter sehingga sertifikat berikutnya mulai dari nomorBaru. */
export function resetCounter(id: string, nomorBaru: number): CertEvent {
  const all = readAll();
  const ev = all.find(e => e.id === id);
  if (!ev) throw new Error(`Event tidak ditemukan: ${id}`);
  ev.nomorTerakhir = nomorBaru - 1;
  writeAll(all);
  return { ...ev };
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
