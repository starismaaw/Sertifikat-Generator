import { describe, it, expect } from 'vitest';
import {
  computeScale,
  computeSignatureBox,
  fitFontSizeCss,
  measureFontAscent,
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
  it('mengembalikan kotak persis ukuran field * scale, tanpa pembesaran apapun', () => {
    const field = { x: 100, y: 50, lebar: 400, tinggi: 150 };
    const box = computeSignatureBox(field, 0.5, 2000, 1500);
    expect(box).toEqual({ left: 50, top: 25, width: 200, height: 75 });
  });

  it('memakai lebar/2 sebagai tinggi default bila field.tinggi tidak diisi', () => {
    const field = { x: 0, y: 0, lebar: 300, tinggi: undefined };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });

  it('TIDAK membesarkan kotak sama sekali walau field & scale kecil (trade-off yang disetujui: tidak ada lagi minimum kenyamanan sentuh)', () => {
    // Field & scale yang sama seperti kasus historis "field TTD kecil di mobile" --
    // versi lama fungsi ini akan membesarkan box ini ke 140x140 (minimum). Sekarang
    // box HARUS tetap kecil (70x21), persis field*scale, tanpa pembesaran apapun --
    // ini adalah bukti eksplisit dari trade-off yang disetujui: field TTD yang
    // didesain kecil di editor akan menghasilkan kotak gambar yang kecil juga di
    // layar sempit.
    const field = { x: 1600, y: 2000, lebar: 400, tinggi: 120 };
    const box = computeSignatureBox(field, 0.175, 2000, 2500);
    expect(box).toEqual({ left: 280, top: 350, width: 70, height: 21 });
  });

  it('tidak meng-clamp ke batas dokumen (bgWidth/bgHeight sudah tidak dipakai sama sekali)', () => {
    // Field yang (secara kontrived) melebihi batas dokumen -- membuktikan tidak ada
    // lagi logic clamp tersembunyi yang bergantung pada bgWidth/bgHeight.
    const field = { x: 900, y: 900, lebar: 200, tinggi: 200 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 900, top: 900, width: 200, height: 200 });
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

describe('measureFontAscent', () => {
  it('mengembalikan angka positif via fallback saat canvas 2d context tidak tersedia (lingkungan test)', () => {
    // Di jsdom tidak ada canvas 2d context sungguhan, jadi harus jatuh ke fallback
    // (bukan crash/NaN) — nilai pastinya diverifikasi manual di browser (lihat spec),
    // tes ini hanya menjamin fungsi tidak pernah mengembalikan 0/NaN/negatif.
    const ascent = measureFontAscent('Inter', 'Regular', 40);
    expect(ascent).toBeGreaterThan(0);
    expect(Number.isFinite(ascent)).toBe(true);
  });
});
