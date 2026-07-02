import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { instances } = vi.hoisted(() => ({ instances: [] as unknown as MockSignaturePadInstance[] }));

interface MockSignaturePadInstance {
  canvas: HTMLCanvasElement;
  options: { backgroundColor?: string };
  listeners: Record<string, () => void>;
  clear: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
  toData: ReturnType<typeof vi.fn>;
  fromData: ReturnType<typeof vi.fn>;
}

vi.mock('signature_pad', () => {
  class MockSignaturePad implements MockSignaturePadInstance {
    canvas: HTMLCanvasElement;
    options: { backgroundColor?: string };
    listeners: Record<string, () => void> = {};
    clear = vi.fn();
    off = vi.fn();
    isEmpty = vi.fn(() => true);
    toDataURL = vi.fn(() => 'data:image/png;base64,mock');
    toData = vi.fn(() => []);
    fromData = vi.fn();
    constructor(canvas: HTMLCanvasElement, options: { backgroundColor?: string }) {
      this.canvas = canvas;
      this.options = options;
      instances.push(this);
    }
    addEventListener(event: string, cb: () => void) {
      this.listeners[event] = cb;
    }
  }
  return { default: MockSignaturePad };
});

import { SignaturePad } from '../src/components/pakta-signer/SignaturePad';

beforeEach(() => {
  instances.length = 0;
});

describe('SignaturePad', () => {
  it('menampilkan tombol "Hapus Tanda Tangan" secara default', () => {
    render(<SignaturePad />);
    expect(screen.getByRole('button', { name: 'Hapus Tanda Tangan' })).toBeInTheDocument();
  });

  it('menyembunyikan tombol "Hapus Tanda Tangan" saat hideClearButton diisi true', () => {
    render(<SignaturePad hideClearButton />);
    expect(screen.queryByRole('button', { name: 'Hapus Tanda Tangan' })).not.toBeInTheDocument();
  });

  it('memakai backgroundColor transparan saat transparent=true', () => {
    render(<SignaturePad transparent hideClearButton />);
    expect(instances[0].options.backgroundColor).toBe('rgba(255,255,255,0)');
  });

  it('memakai backgroundColor putih saat transparent tidak diisi', () => {
    render(<SignaturePad />);
    expect(instances[0].options.backgroundColor).toBe('#fff');
  });

  it('memanggil onStrokeBegin saat event beginStroke terjadi pada pad', () => {
    const onStrokeBegin = vi.fn();
    render(<SignaturePad onStrokeBegin={onStrokeBegin} />);
    instances[0].listeners.beginStroke();
    expect(onStrokeBegin).toHaveBeenCalledTimes(1);
  });

  it('memanggil onStrokeBegin setiap kali stroke baru dimulai, bukan hanya saat pertama kali', () => {
    const onStrokeBegin = vi.fn();
    render(<SignaturePad onStrokeBegin={onStrokeBegin} />);
    // Simulasi stroke pertama
    instances[0].listeners.beginStroke();
    expect(onStrokeBegin).toHaveBeenCalledTimes(1);
    // Simulasi stroke kedua (misal setelah clear)
    instances[0].listeners.beginStroke();
    expect(onStrokeBegin).toHaveBeenCalledTimes(2);
  });

  it('memanggil pad.clear() saat tombol "Hapus Tanda Tangan" diklik', () => {
    render(<SignaturePad />);
    const clearCountBefore = instances[0].clear.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Hapus Tanda Tangan' }));
    const clearCountAfter = instances[0].clear.mock.calls.length;
    expect(clearCountAfter).toBeGreaterThan(clearCountBefore);
  });
});
