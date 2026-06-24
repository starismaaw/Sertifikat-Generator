import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({ sendMail: sendMailMock }),
  },
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
    sendMailMock.mockReset();
    process.env.GMAIL_USER = 'test@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'apppassword';
  });

  // WHY: hanya POST yang boleh memicu pengiriman.
  it('menolak metode selain POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', body: {} } as any, res);
    expect(res.statusCode).toBe(405);
  });

  // WHY: payload kosong harus ditolak sebelum memanggil SMTP (early-exit).
  it('menolak recipients kosong', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [] } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // WHY: subjek/badan per penerima dari klien harus diteruskan ke SMTP apa adanya.
  it('meneruskan subject & text per penerima ke SMTP', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'mid-1' });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg).toMatchObject({ to: 'a@x.id', subject: 'S', text: 'B' });
  });

  // WHY: pada sukses, tiap penerima dipetakan ke status 'sent' beserta messageId.
  it('mengembalikan sent saat SMTP sukses', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'mid-1' });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sent).toEqual([{ status: 'sent', email: 'a@x.id', id: 'mid-1' }]);
    expect(res.body.failed).toEqual([]);
  });

  // WHY: error SMTP menandai penerima gagal — penerima lain tetap dikirim (per-penerima, bukan batch).
  it('mengembalikan failed saat SMTP error, lanjut ke penerima lain', async () => {
    sendMailMock
      .mockRejectedValueOnce(new Error('koneksi gagal'))
      .mockResolvedValueOnce({ messageId: 'mid-2' });
    const res = mockRes();
    const two = [recipient, { ...recipient, email: 'b@x.id' }];
    await handler({ method: 'POST', body: { recipients: two } } as any, res);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.sent).toHaveLength(1);
    // WHY: pesan error tidak boleh membocorkan kredensial.
    expect(JSON.stringify(res.body)).not.toContain('apppassword');
  });

  // WHY: tanpa konfigurasi env, jangan pura-pura kirim — gagalkan jelas.
  it('menolak bila GMAIL_USER tidak ada', async () => {
    delete process.env.GMAIL_USER;
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(500);
  });

  // WHY: payload lebih dari 100 penerima harus ditolak sebelum memanggil SMTP (early-exit).
  it('menolak recipients melebihi MAX_RECIPIENTS (100)', async () => {
    const res = mockRes();
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      email: `u${i}@x.id`, nama: `U${i}`, filename: `u${i}.pdf`,
      pdfBase64: 'AAA', subject: 'S', body: 'B',
    }));
    await handler({ method: 'POST', body: { recipients: tooMany } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
