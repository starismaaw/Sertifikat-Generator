import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

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

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
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

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  });

  const sent: SendResult[] = [];
  const failed: SendResult[] = [];

  // Kirim per-penerima secara berurutan — Gmail SMTP tidak mendukung batch sejati.
  for (const r of recipients) {
    try {
      const info = await transporter.sendMail({
        from: gmailUser,
        to: r.email,
        subject: r.subject,
        text: r.body,
        attachments: [{
          filename: r.filename,
          content: Buffer.from(r.pdfBase64, 'base64'),
          contentType: 'application/pdf',
        }],
      });
      sent.push({ status: 'sent', email: r.email, id: info.messageId });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Kesalahan tidak dikenal';
      failed.push({ status: 'failed', email: r.email, error });
    }
  }

  return res.status(200).json({ sent, failed });
}
