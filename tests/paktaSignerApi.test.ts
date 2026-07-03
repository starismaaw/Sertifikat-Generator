// tests/paktaSignerApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createClientMock, fromMock, storageMock } = vi.hoisted(() => {
  const fromMock = vi.fn();
  const storageMock = {
    from: vi.fn().mockReturnValue({
      createSignedUploadUrl: vi.fn(),
    }),
  };
  return {
    fromMock,
    storageMock,
    createClientMock: vi.fn().mockReturnValue({ from: fromMock, storage: storageMock }),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import handler from '../api/pakta-signer';

function mockReq(body: unknown): any {
  return { method: 'POST', headers: {}, body };
}
function mockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

describe('pakta-signer handler', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    fromMock.mockClear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  });

  // WHY: hanya POST yang diizinkan
  it('menolak metode selain POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, body: {} } as any, res);
    expect(res.statusCode).toBe(405);
  });

  // WHY: action tidak dikenal harus ditolak
  it('menolak action tidak dikenal', async () => {
    fromMock.mockReturnValue({});
    const res = mockRes();
    await handler(mockReq({ action: 'hapus_semua' }), res);
    expect(res.statusCode).toBe(400);
  });

  // WHY: signerId dan eventId wajib ada
  it('menolak bila signerId atau eventId tidak ada', async () => {
    fromMock.mockReturnValue({});
    const res = mockRes();
    await handler(mockReq({ action: 'get_pdf_upload_url', signerId: 'abc' }), res);
    expect(res.statusCode).toBe(400);
  });

  // WHY: signer yang sudah TTD tidak boleh upload ulang
  it('menolak bila signer sudah TTD (status=sudah)', async () => {
    fromMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 's1', status: 'sudah', event_id: 'ev1' },
                error: null,
              }),
            }),
          }),
        }),
      });
    const res = mockRes();
    await handler(mockReq({ action: 'get_pdf_upload_url', signerId: 's1', eventId: 'ev1' }), res);
    expect(res.statusCode).toBe(409);
  });

  // WHY: signer belum TTD harus mendapat signed upload URL
  it('get_pdf_upload_url mengembalikan signedUrl dan pdfPath', async () => {
    // Signer mock
    fromMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 's1', status: 'belum', event_id: 'ev1' },
                error: null,
              }),
            }),
          }),
        }),
      })
      // Event mock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'ev1', status: 'aktif' },
              error: null,
            }),
          }),
        }),
      });

    const createSignedUploadUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/upload?token=xyz' },
      error: null,
    });
    storageMock.from.mockReturnValue({ createSignedUploadUrl: createSignedUploadUrlMock });
    createClientMock.mockReturnValue({ from: fromMock, storage: storageMock });

    const res = mockRes();
    await handler(mockReq({ action: 'get_pdf_upload_url', signerId: 's1', eventId: 'ev1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.signedUrl).toContain('token=xyz');
    expect(res.body.pdfPath).toBe('ev1/s1.pdf');
    // WHY: tanpa upsert:true, retry setelah upload sebelumnya terputus (tab
    // tertutup sebelum updateSignerDone tersimpan) akan gagal permanen dengan
    // "The resource already exists" walau status signer masih 'belum'.
    expect(createSignedUploadUrlMock).toHaveBeenCalledWith('ev1/s1.pdf', { upsert: true });
  });
});
