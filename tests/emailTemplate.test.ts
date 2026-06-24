import { describe, it, expect, beforeEach } from 'vitest';
import { interpolate, DEFAULT_TEMPLATE, loadTemplate, saveTemplate } from '../src/lib/emailTemplate';

describe('interpolate', () => {
  it('mengisi placeholder yang dikenal', () => {
    const out = interpolate('Yth. {nama}, nomor {nomor}', { nama: 'Budi', nomor: '007/X' });
    expect(out).toBe('Yth. Budi, nomor 007/X');
  });
  // WHY: placeholder yang salah ketik tidak boleh menghapus teks / melempar error;
  // biarkan utuh supaya pengguna lihat kesalahannya, bukan kehilangan isi email.
  it('membiarkan placeholder tak dikenal apa adanya', () => {
    expect(interpolate('Halo {tidakada}', { nama: 'Budi' })).toBe('Halo {tidakada}');
  });
});

describe('loadTemplate / saveTemplate', () => {
  beforeEach(() => localStorage.clear());
  it('mengembalikan DEFAULT_TEMPLATE bila belum ada', () => {
    expect(loadTemplate('ev1')).toEqual(DEFAULT_TEMPLATE);
  });
  // WHY: template tersimpan per-acara harus bertahan & terisolasi per event id.
  it('menyimpan & memuat ulang per event id', () => {
    saveTemplate('ev1', { subject: 'S', body: 'B' });
    expect(loadTemplate('ev1')).toEqual({ subject: 'S', body: 'B' });
    expect(loadTemplate('ev2')).toEqual(DEFAULT_TEMPLATE);
  });
});
