import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const MAX_RECIPIENTS = 100;

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

  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (internalToken) {
    const provided = req.headers['x-internal-token'];
    if (provided !== internalToken) {
      return res.status(401).json({ error: 'Tidak diizinkan' });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    return res.status(500).json({ error: 'Email belum dikonfigurasi di server' });
  }

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

  for (const r of recipients) {
    try {
      const { data, error } = await resend.emails.send({
        from: senderEmail,
        to: r.email,
        subject: r.subject,
        text: r.body,
        attachments: [{
          filename: r.filename,
          content: Buffer.from(r.pdfBase64, 'base64'),
        }],
      });
      if (error || !data) {
        throw new Error(error?.message ?? 'Resend tidak mengembalikan data');
      }
      sent.push({ status: 'sent', email: r.email, id: data.id });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Kesalahan tidak dikenal';
      failed.push({ status: 'failed', email: r.email, error });
    }
  }

  return res.status(200).json({ sent, failed });
}
