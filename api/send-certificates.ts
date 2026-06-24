import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const MAX_RECIPIENTS = 100; // batas aman per request

// Subjek & badan SUDAH diinterpolasi per penerima oleh klien.
interface WireRecipient {
  email: string; nama: string; filename: string; pdfBase64: string;
  subject: string; body: string;
}
type SendResult =
  | { status: 'sent'; email: string; id: string }
  | { status: 'failed'; email: string; error: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return res.status(500).json({ error: 'Email belum dikonfigurasi di server' });

  const { recipients } = (req.body ?? {}) as { recipients?: WireRecipient[] };

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'recipients kosong' });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Maksimal ${MAX_RECIPIENTS} penerima per permintaan` });
  }
  if (recipients.some(r => !r.email || !r.subject || !r.body)) {
    return res.status(400).json({ error: 'Setiap penerima wajib punya email, subject, dan body' });
  }

  const resend = new Resend(apiKey);
  const sent: SendResult[] = [];
  const failed: SendResult[] = [];

  try {
    const { data, error } = await resend.batch.send(
      recipients.map(r => ({
        from,
        to: r.email,
        subject: r.subject,
        text: r.body,
        attachments: [{ filename: r.filename, content: r.pdfBase64 }],
      })),
    );

    if (error || !data) {
      const message = error?.message ?? 'Pengiriman gagal';
      for (const r of recipients) failed.push({ status: 'failed', email: r.email, error: message });
    } else {
      // data.data berisi id per email, urutannya sama dengan input.
      recipients.forEach((r, i) => {
        const id = (data as { data: Array<{ id: string }> }).data[i]?.id;
        if (id) sent.push({ status: 'sent', email: r.email, id });
        else failed.push({ status: 'failed', email: r.email, error: 'Tidak ada id balasan' });
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Kesalahan tidak dikenal';
    for (const r of recipients) failed.push({ status: 'failed', email: r.email, error: message });
  }

  return res.status(200).json({ sent, failed });
}
