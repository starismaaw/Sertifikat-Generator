import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import { getSupabaseClient, _resetClientForTests } from '../src/lib/supabaseClient';

describe('getSupabaseClient', () => {
  beforeEach(() => {
    _resetClientForTests();
    createClientMock.mockClear();
    // Mutate individual properties — replacing the whole object doesn't work in vitest
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL = '';
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_ANON_KEY = '';
  });

  afterEach(() => {
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL = '';
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_ANON_KEY = '';
  });

  it('melempar error bila VITE_SUPABASE_URL tidak di-set', () => {
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL = '';
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'key';
    expect(() => getSupabaseClient()).toThrow('VITE_SUPABASE_URL');
  });

  it('mengembalikan client bila env terkonfigurasi', () => {
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'anon-key-test';
    const client = getSupabaseClient();
    expect(client).toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'anon-key-test',
    );
  });

  it('mengembalikan instance yang sama (singleton)', () => {
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'anon-key-test';
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});
