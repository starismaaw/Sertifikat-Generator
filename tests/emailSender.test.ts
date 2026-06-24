import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendCertificates, maxBatchSize, type OutgoingCertificate } from '../src/lib/emailSender';

function cert(email: string, vars: Record<string, string> = {}): OutgoingCertificate {
  return { nama: 'X', email, filename: 'x.pdf', pdfBytes: new Uint8Array([1, 2, 3]), vars };
}

// 2MB PDF → base64 ~2.67MB → max 1 per batch (limit 3.5MB)
function largeCert(email: string): OutgoingCertificate {
  return { nama: 'X', email, filename: 'x.pdf', pdfBytes: new Uint8Array(2 * 1024 * 1024), vars: {} };
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

  // WHY: PDF besar (>1.75MB) harus dipecah 1 per batch agar tidak menembus limit 4.5MB Vercel.
  it('memecah PDF besar menjadi 1 penerima per batch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: [], failed: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = [largeCert('a@x.id'), largeCert('b@x.id')];
    await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 2MB PDF → 1 per batch
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
    const recipients = [largeCert('a@x.id'), largeCert('b@x.id')];
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
    const recipients = [largeCert('a@x.id'), largeCert('b@x.id')];
    const summary = await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(summary.failed).toHaveLength(1);
    expect(summary.sent).toHaveLength(1);
  });

  // WHY: maxBatchSize harus kembalikan 1 untuk PDF yang mendekati limit Vercel.
  it('maxBatchSize mengembalikan 1 untuk PDF 2MB', () => {
    const recipients = [largeCert('a@x.id')];
    expect(maxBatchSize(recipients)).toBe(1);
  });
});
