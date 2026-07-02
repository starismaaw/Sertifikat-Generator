import { describe, it, expect } from 'vitest';
import {
  MIN_SIGNATURE_HEIGHT,
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

  it('tidak membiarkan kotak melebar keluar dari dokumen saat growFactor besar di layar sempit (bug: field kecil di mobile)', () => {
    // Simulasi nyata: template 2000x2500px, field TTD 400x120, dilihat di layar mobile
    // (containerWidth ~350px -> scale=0.175). rawWidth=70, rawHeight=21. Lebar kotak
    // dibatasi agar tidak pernah melebihi containerW/containerH (di sini width=350,
    // pas selebar dokumen). TAPI tinggi TETAP diusahakan capai MIN_SIGNATURE_HEIGHT
    // penuh (140) walau itu berarti rasio lebar:tinggi kotak di layar tidak lagi
    // persis sama dengan field.lebar:tinggi -- lebih baik area gambar tetap nyaman
    // (140px) daripada dipepetkan ikut lebar (105px, bug sebelumnya: TTD jadi kecil
    // saat distretch ke ukuran field asli di PDF).
    const field = { x: 1600, y: 2000, lebar: 400, tinggi: 120 };
    const box = computeSignatureBox(field, 0.175, 2000, 2500);
    expect(box.width).toBeLessThanOrEqual(2000 * 0.175);
    expect(box.height).toBeLessThanOrEqual(2500 * 0.175);
    expect(box).toEqual({ left: 0, top: 290.5, width: 350, height: 140 });
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
