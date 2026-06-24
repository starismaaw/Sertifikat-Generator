import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
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
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.SENDER_EMAIL = 'noreply@instansi.web.id';
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
    sendMock.mockResolvedValue({ data: { id: 'mid-1' }, error: null });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    const arg = sendMock.mock.calls[0][0];
    expect(arg).toMatchObject({ to: 'a@x.id', subject: 'S', text: 'B' });
  });

  // WHY: pada sukses, tiap penerima dipetakan ke status 'sent' beserta id dari Resend.
  it('mengembalikan sent saat Resend sukses', async () => {
    sendMock.mockResolvedValue({ data: { id: 'mid-1' }, error: null });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sent).toEqual([{ status: 'sent', email: 'a@x.id', id: 'mid-1' }]);
    expect(res.body.failed).toEqual([]);
  });

  // WHY: error Resend menandai penerima gagal — penerima lain tetap dikirim.
  it('mengembalikan failed saat Resend error, lanjut ke penerima lain', async () => {
    sendMock
      .mockResolvedValueOnce({ data: null, error: { message: 'koneksi gagal' } })
      .mockResolvedValueOnce({ data: { id: 'mid-2' }, error: null });
    const res = mockRes();
    const two = [recipient, { ...recipient, email: 'b@x.id' }];
    await handler({ method: 'POST', body: { recipients: two } } as any, res);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.sent).toHaveLength(1);
    // WHY: pesan error tidak boleh membocorkan API key.
    expect(JSON.stringify(res.body)).not.toContain('test-api-key');
  });

  // WHY: tanpa konfigurasi env, jangan pura-pura kirim — gagalkan jelas.
  it('menolak bila RESEND_API_KEY tidak ada', async () => {
    delete process.env.RESEND_API_KEY;
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(500);
  });

  // WHY: payload lebih dari 100 penerima harus ditolak sebelum memanggil Resend (early-exit).
  it('menolak recipients melebihi MAX_RECIPIENTS (100)', async () => {
    const res = mockRes();
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      email: `u${i}@x.id`, nama: `U${i}`, filename: `u${i}.pdf`,
      pdfBase64: 'AAA', subject: 'S', body: 'B',
    }));
    await handler({ method: 'POST', body: { recipients: tooMany } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
