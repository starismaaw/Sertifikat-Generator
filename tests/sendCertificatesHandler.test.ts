import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ batch: { send: sendMock } })),
}));

import handler from '../api/send-certificates';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}
// Subjek & badan SUDAH diinterpolasi per penerima oleh klien.
const recipient = { email: 'a@x.id', nama: 'A', filename: 'a.pdf', pdfBase64: 'AAA', subject: 'S', body: 'B' };

describe('send-certificates handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'key';
    process.env.RESEND_FROM = 'noreply@balai.go.id';
  });

  // WHY: hanya POST yang boleh memicu pengiriman.
  it('menolak metode selain POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', body: {} } as any, res);
    expect(res.statusCode).toBe(405);
  });

  // WHY: payload kosong harus ditolak sebelum memanggil Resend (early-exit).
  it('menolak recipients kosong', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [] } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  // WHY: subjek/badan per penerima dari klien harus diteruskan ke Resend apa adanya.
  it('meneruskan subject & text per penerima ke Resend', async () => {
    sendMock.mockResolvedValue({ data: { data: [{ id: 'id-1' }] }, error: null });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    const arg = sendMock.mock.calls[0][0][0];
    expect(arg).toMatchObject({ to: 'a@x.id', subject: 'S', text: 'B' });
  });

  // WHY: pada sukses, tiap penerima dipetakan ke status 'sent' beserta id.
  it('mengembalikan sent saat Resend sukses', async () => {
    sendMock.mockResolvedValue({ data: { data: [{ id: 'id-1' }] }, error: null });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sent).toEqual([{ status: 'sent', email: 'a@x.id', id: 'id-1' }]);
    expect(res.body.failed).toEqual([]);
  });

  // WHY: error dari Resend menandai semua penerima batch gagal — TIDAK membocorkan API key.
  it('mengembalikan failed saat Resend error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'kuota habis' } });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.failed[0]).toMatchObject({ status: 'failed', email: 'a@x.id' });
    expect(JSON.stringify(res.body)).not.toContain('key');
  });

  // WHY: tanpa konfigurasi env, jangan pura-pura kirim — gagalkan jelas.
  it('menolak bila RESEND_API_KEY tidak ada', async () => {
    delete process.env.RESEND_API_KEY;
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(500);
  });
});
