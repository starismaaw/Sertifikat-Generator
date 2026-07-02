import { describe, it, expect } from 'vitest';
import {
  MIN_SIGNATURE_HEIGHT,
  MIN_SIGNATURE_WIDTH,
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

  it('membesarkan lebar & tinggi secara independen & terpusat saat keduanya lebih kecil dari minimumnya, tanpa perlu clamp', () => {
    // rawWidth=100 -> width=MIN_SIGNATURE_WIDTH=140 (independen dari tinggi)
    // rawHeight=50 -> height=MIN_SIGNATURE_HEIGHT=140
    // pusat asli: x=400+50=450, y=400+25=425 -> box baru terpusat di titik itu
    const field = { x: 400, y: 400, lebar: 100, tinggi: 50 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 380, top: 355, width: 140, height: 140 });
  });

  it('meng-clamp kotak yang membesar agar tidak keluar dari batas dokumen (mis. field dekat pojok kiri-atas)', () => {
    // rawWidth=100 -> width=140, rawHeight=50 -> height=140
    // pusat asli (60,35) membuat box keluar batas kiri/atas -> di-clamp ke 0
    const field = { x: 10, y: 10, lebar: 100, tinggi: 50 };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    expect(box).toEqual({ left: 0, top: 0, width: 140, height: 140 });
  });

  it('memakai lebar/2 sebagai tinggi default bila field.tinggi tidak diisi', () => {
    const field = { x: 0, y: 0, lebar: 300, tinggi: undefined };
    const box = computeSignatureBox(field, 1, 1000, 1000);
    // rawHeight = 300/2 = 150 >= MIN_SIGNATURE_HEIGHT -> tidak membesar
    expect(box).toEqual({ left: 0, top: 0, width: 300, height: 150 });
  });

  it('mengekspor MIN_SIGNATURE_HEIGHT = 140 dan MIN_SIGNATURE_WIDTH = 140', () => {
    expect(MIN_SIGNATURE_HEIGHT).toBe(140);
    expect(MIN_SIGNATURE_WIDTH).toBe(140);
  });

  it('tidak membiarkan kotak melebar keluar dari dokumen saat field kecil di layar sempit (mobile)', () => {
    // Simulasi nyata: template 2000x2500px, field TTD 400x120, dilihat di layar mobile
    // (containerWidth ~350px -> scale=0.175). rawWidth=70, rawHeight=21 -- keduanya di
    // bawah minimum masing-masing, jadi width->MIN_SIGNATURE_WIDTH(140),
    // height->MIN_SIGNATURE_HEIGHT(140), independen satu sama lain.
    const field = { x: 1600, y: 2000, lebar: 400, tinggi: 120 };
    const box = computeSignatureBox(field, 0.175, 2000, 2500);
    expect(box.width).toBeLessThanOrEqual(2000 * 0.175);
    expect(box.height).toBeLessThanOrEqual(2500 * 0.175);
    expect(box).toEqual({ left: 210, top: 290.5, width: 140, height: 140 });
  });

  it('tidak melebarkan kotak jauh melebihi lebar asli field hanya karena tingginya perlu dibesarkan (bug: kotak TTD melebar jauh dari field template di mobile)', () => {
    // Field lebar-tapi-pendek (rasio 400:120 = 3.33:1), khas area TTD bergaya garis.
    // Sebelumnya, growFactor dari sisi tinggi (MIN_HEIGHT/rawHeight) ikut dipakai untuk
    // lebar demi mempertahankan rasio, menghasilkan lebar = (field.lebar/field.tinggi) *
    // MIN_HEIGHT -- rumus yang device-independent, lalu clamp ke containerW membuat
    // kotak selebar HAMPIR SELURUH dokumen di layar sempit walau field aslinya cuma
    // 20% lebar dokumen. Sekarang lebar hanya boleh membesar sampai MIN_SIGNATURE_WIDTH
    // sendiri (140px), jauh lebih dekat ke lebar asli field di layar (70px).
    const field = { x: 1600, y: 2000, lebar: 400, tinggi: 120 };
    const scale = 0.175;
    const box = computeSignatureBox(field, scale, 2000, 2500);
    const containerW = 2000 * scale; // 350
    expect(box.width).toBeLessThan(containerW * 0.5); // jauh di bawah lebar dokumen
    expect(box.width).toBe(MIN_SIGNATURE_WIDTH);
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
