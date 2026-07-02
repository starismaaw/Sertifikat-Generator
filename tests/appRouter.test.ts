import { describe, it, expect, beforeEach } from 'vitest';
import { navigate, parseHash } from '../src/components/AppRouter';

beforeEach(() => {
  window.location.hash = '';
});

describe('AppRouter — sertifikat view', () => {
  it('parses hash "sertifikat" into the sertifikat view', () => {
    window.location.hash = 'sertifikat';
    expect(parseHash()).toEqual({ name: 'sertifikat' });
  });

  it('parses an empty hash into the home view (the hub)', () => {
    window.location.hash = '';
    expect(parseHash()).toEqual({ name: 'home' });
  });

  it('navigate({ name: "sertifikat" }) sets the hash to "sertifikat"', () => {
    navigate({ name: 'sertifikat' });
    expect(window.location.hash).toBe('#sertifikat');
  });

  it('navigate({ name: "home" }) clears the hash', () => {
    window.location.hash = 'sertifikat';
    navigate({ name: 'home' });
    expect(window.location.hash).toBe('');
  });
});
