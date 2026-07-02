import { describe, it, expect } from 'vitest';
import {
  MIN_SIGNATURE_HEIGHT,
  computeScale,
  computeSignatureBox,
  fitFontSizeCss,
} from '../src/lib/paktaPreviewLayout';

describe('computeScale', () => {
  it('menghitung rasio containerWidth terhadap bgWidth', () => {
    expect(computeScale(400, 800)).toBe(0.5);
  });

  it('mengembalikan 1 bila bgWidth atau containerWidth <= 0 (nilai belum terukur)', () => {
    expect(computeScale(400, 0)).toBe(1);
    expect(computeScale(0, 800)).toBe(1);
  });
});

describe('computeSignatureBox', () => {
  it('tidak mengubah kotak bila tinggi hasil scale sudah >= MIN_SIGNATURE_HEIGHT', () => {
    const field = { x: 100, y: 100, lebar: 400, tinggi: 150 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 100, top: 100, width: 400, height: 150 });
  });

  it('membesarkan kotak secara proporsional & terpusat saat lebih kecil dari MIN_SIGNATURE_HEIGHT, tanpa perlu clamp', () => {
    // rawWidth=100, rawHeight=50 -> growFactor = 140/50 = 2.8 -> width=280, height=140
    // pusat asli: x=400+50=450, y=400+25=425 -> box baru terpusat di titik itu
    const field = { x: 400, y: 400, lebar: 100, tinggi: 50 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 310, top: 355, width: 280, height: 140 });
  });

  it('meng-clamp kotak yang membesar agar tidak keluar dari batas dokumen (mis. field dekat pojok kiri-atas)', () => {
    // rawWidth=100, rawHeight=50 -> growFactor=2.8 -> width=280, height=140
    // pusat asli (60,35) membuat box keluar batas kiri/atas -> di-clamp ke 0
    const field = { x: 10, y: 10, lebar: 100, tinggi: 50 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 0, top: 0, width: 280, height: 140 });
  });

  it('memakai lebar/2 sebagai tinggi default bila field.tinggi tidak diisi', () => {
    const field = { x: 0, y: 0, lebar: 300, tinggi: undefined };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    // rawHeight = 300/2 = 150 >= MIN_SIGNATURE_HEIGHT -> tidak membesar
    expect(box).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });

  it('mengekspor MIN_SIGNATURE_HEIGHT = 140', () => {
    expect(MIN_SIGNATURE_HEIGHT).toBe(140);
  });
});

describe('fitFontSizeCss', () => {
  it('mengecilkan ukuran font sampai teks muat dalam lebar field', () => {
    // Di jsdom, canvas 2d context tidak tersedia sehingga browserTextWidth() jatuh ke
    // afmFallback internal (text.length * size * 0.5). Untuk teks 10 karakter & lebar 100:
    // butuh size <= 20 supaya 10 * size * 0.5 <= 100.
    const field = { fontFamily: 'Inter', fontWeight: 'Regular' as const, ukuran: 32, lebar: 100 };
    const size = fitFontSizeCss('AAAAAAAAAA', field);
    expect(size).toBe(20);
  });

  it('tidak mengecilkan font bila teks sudah muat pada ukuran aslinya', () => {
    const field = { fontFamily: 'Inter', fontWeight: 'Regular' as const, ukuran: 10, lebar: 1000 };
    const size = fitFontSizeCss('Teks Pendek', field);
    expect(size).toBe(10);
  });

  it('tidak mengecilkan font di bawah 6px', () => {
    const field = { fontFamily: 'Inter', fontWeight: 'Regular' as const, ukuran: 32, lebar: 1 };
    const size = fitFontSizeCss('Teks yang sangat sangat panjang sekali', field);
    expect(size).toBe(6);
  });
});
