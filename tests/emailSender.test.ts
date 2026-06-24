import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendCertificates, type OutgoingCertificate } from '../src/lib/emailSender';

function cert(email: string, vars: Record<string, string> = {}): OutgoingCertificate {
  return { nama: 'X', email, filename: 'x.pdf', pdfBytes: new Uint8Array([1, 2, 3]), vars };
}

describe('sendCertificates', () => {
  beforeEach(() => vi.restoreAllMocks());

  // WHY: subjek & badan harus dipersonalisasi PER penerima sebelum dikirim,
  // jika tidak setiap orang menerima literal "{nama}" yang sama.
  it('menginterpolasi subjek & badan per penerima dalam wire payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ sent: [], failed: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await sendCertificates({
      subject: 'Sertifikat {acara}',
      body: 'Yth. {nama}',
      recipients: [cert('a@x.id', { acara: 'Diklat', nama: 'Budi' })],
    });
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.recipients[0].subject).toBe('Sertifikat Diklat');
    expect(sentBody.recipients[0].body).toBe('Yth. Budi');
  });

  // WHY: payload > 1 batch harus dipecah agar tidak menembus limit ukuran Vercel.
  it('memecah penerima menjadi beberapa batch (ukuran 8)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: [], failed: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = Array.from({ length: 10 }, (_, i) => cert(`u${i}@x.id`));
    await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 8 + 2
  });

  // WHY: hasil tiap batch harus diagregasi jadi satu ringkasan sent/failed.
  it('menggabungkan hasil dari semua batch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        sent: [{ status: 'sent', email: 'a@x.id', id: '1' }], failed: [],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        sent: [], failed: [{ status: 'failed', email: 'b@x.id', error: 'tolak' }],
      }) });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = Array.from({ length: 9 }, (_, i) => cert(`u${i}@x.id`));
    const summary = await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(summary.sent).toHaveLength(1);
    expect(summary.failed).toHaveLength(1);
  });

  // WHY: kegagalan jaringan satu batch tidak boleh menjatuhkan seluruh proses;
  // penerima batch itu ditandai gagal, batch lain tetap jalan.
  it('menandai gagal saat fetch error, lanjut batch lain', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        sent: [{ status: 'sent', email: 'b@x.id', id: '1' }], failed: [],
      }) });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = Array.from({ length: 9 }, (_, i) => cert(`u${i}@x.id`));
    const summary = await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(summary.failed).toHaveLength(8);
    expect(summary.sent).toHaveLength(1);
  });
});
