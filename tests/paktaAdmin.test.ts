import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mock vars inside vi.hoisted() to avoid TDZ errors with vi.mock hoisting
const { createClientMock, fromAdminMock } = vi.hoisted(() => {
  const fromAdminMock = vi.fn();
  return {
    fromAdminMock,
    createClientMock: vi.fn().mockReturnValue({ from: fromAdminMock }),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import handler from '../api/pakta-admin';

function mockReq(body: unknown, password = 'sandi-test'): any {
  return {
    method: 'POST',
    headers: { 'x-pakta-admin': password },
    body,
  };
}

function mockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

describe('pakta-admin handler', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    fromAdminMock.mockClear();
    process.env.PAKTA_ADMIN_PASSWORD = 'sandi-test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  });

  // WHY: hanya POST yang boleh memicu operasi admin.
  it('menolak metode selain POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, body: {} } as any, res);
    expect(res.statusCode).toBe(405);
  });

  // WHY: sandi salah harus ditolak sebelum menyentuh Supabase.
  it('menolak sandi salah', async () => {
    const res = mockRes();
    await handler(mockReq({ action: 'list_events' }, 'sandi-salah'), res);
    expect(res.statusCode).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  // WHY: action tidak dikenal harus ditolak — tidak boleh ada operasi tak terduga.
  it('menolak action tidak dikenal', async () => {
    fromAdminMock.mockReturnValue({});
    const res = mockRes();
    await handler(mockReq({ action: 'hapus_semua' }), res);
    expect(res.statusCode).toBe(400);
  });

  // WHY: list_events harus mengembalikan semua acara pakta untuk dashboard admin.
  it('list_events mengembalikan data acara', async () => {
    const events = [{ id: 'ev1', nama: 'Pakta 2026', status: 'aktif' }];
    fromAdminMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: events, error: null }),
      }),
    });
    const res = mockRes();
    await handler(mockReq({ action: 'list_events' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.events).toEqual(events);
  });

  // WHY: tanpa SUPABASE_SERVICE_ROLE_KEY server tidak boleh beroperasi.
  it('menolak bila SUPABASE_SERVICE_ROLE_KEY tidak ada', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = mockRes();
    await handler(mockReq({ action: 'list_events' }), res);
    expect(res.statusCode).toBe(500);
  });

  // WHY: create_event harus menyimpan acara baru dan mengembalikan id-nya.
  it('create_event menyimpan acara dan mengembalikan id', async () => {
    const newEvent = { id: 'ev-new', nama: 'Pakta Baru', status: 'aktif' };
    const selectFn = vi.fn().mockResolvedValue({ data: [newEvent], error: null });
    fromAdminMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({ select: selectFn }),
    });
    const res = mockRes();
    await handler(mockReq({
      action: 'create_event',
      nama: 'Pakta Baru',
      tanggal: '2026-07-01',
      bg_width: 800,
      bg_height: 600,
      fields: [],
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.event.id).toBe('ev-new');
  });

  // WHY: import_signers harus memproses array pegawai dan menyimpan semuanya.
  it('import_signers menyimpan daftar pegawai', async () => {
    fromAdminMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    const res = mockRes();
    await handler(mockReq({
      action: 'import_signers',
      event_id: 'ev1',
      signers: [
        { nama: 'Budi', nip: '123', jabatan: 'Staf' },
        { nama: 'Ani',  nip: '456', jabatan: 'Kabag' },
      ],
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.imported).toBe(2);
  });
});
