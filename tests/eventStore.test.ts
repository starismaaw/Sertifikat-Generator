import { describe, it, expect, beforeEach } from 'vitest';
import { listEvents, saveEvent, getEvent, deleteEvent, claimNextNumber } from '../src/lib/eventStore';
import type { CertEvent } from '../src/types';

function makeEvent(over: Partial<CertEvent> = {}): CertEvent {
  return {
    id: 'e1', nama: 'Pelatihan A', tanggal: '2026-06-15',
    background: 'data:,', bgWidth: 800, bgHeight: 600, fields: [],
    polaNomor: '{n}', nomorMulai: 1, nomorPadding: 3, nomorTerakhir: 0,
    penandatangan: { nama: '', jabatan: '' }, ...over,
  };
}

beforeEach(() => localStorage.clear());

describe('EventStore CRUD', () => {
  it('saves and lists events', () => {
    saveEvent(makeEvent());
    expect(listEvents().map(e => e.id)).toEqual(['e1']);
  });

  it('updates an existing event in place (no duplicate)', () => {
    saveEvent(makeEvent());
    saveEvent(makeEvent({ nama: 'Pelatihan B' }));
    const all = listEvents();
    expect(all).toHaveLength(1);
    expect(all[0].nama).toBe('Pelatihan B');
  });

  it('gets and deletes', () => {
    saveEvent(makeEvent());
    expect(getEvent('e1')?.nama).toBe('Pelatihan A');
    deleteEvent('e1');
    expect(getEvent('e1')).toBeUndefined();
  });

  it('persists across a fresh module read', () => {
    saveEvent(makeEvent());
    expect(listEvents()).toHaveLength(1); // backed by localStorage, survives
  });
});

describe('claimNextNumber', () => {
  it('starts from nomorMulai and increments without duplicates', () => {
    saveEvent(makeEvent({ nomorMulai: 1, nomorTerakhir: 0 }));
    expect(claimNextNumber('e1')).toBe(1);
    expect(claimNextNumber('e1')).toBe(2);
    expect(claimNextNumber('e1')).toBe(3);
    expect(getEvent('e1')?.nomorTerakhir).toBe(3);
  });

  it('respects a higher nomorMulai', () => {
    saveEvent(makeEvent({ nomorMulai: 100, nomorTerakhir: 0 }));
    expect(claimNextNumber('e1')).toBe(100);
    expect(claimNextNumber('e1')).toBe(101);
  });

  it('throws for an unknown event', () => {
    expect(() => claimNextNumber('nope')).toThrow();
  });
});
