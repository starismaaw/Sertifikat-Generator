import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}

// Mock canvas.getContext to return null in jsdom, allowing browserTextWidth fallback to work
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
