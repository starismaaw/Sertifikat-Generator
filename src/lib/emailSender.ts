import { interpolate } from './emailTemplate';

/** Satu sertifikat siap kirim (PDF sudah dibuat di browser). */
export interface OutgoingCertificate {
  nama: string;
  email: string;
  filename: string;
  pdfBytes: Uint8Array;
  /** Nilai untuk mengisi placeholder template, mis. { nama, nomor, acara }. */
  vars: Record<string, string>;
}

export interface SendPayload {
  /** Template subjek (boleh berisi placeholder {nama}, dll). */
  subject: string;
  /** Template badan email (boleh berisi placeholder). */
  body: string;
  recipients: OutgoingCertificate[];
}

/** Hasil per-penerima (discriminated union — narrowing aman). */
export type SendResult =
  | { status: 'sent'; email: string; id: string }
  | { status: 'failed'; email: string; error: string };

export interface SendSummary { sent: SendResult[]; failed: SendResult[]; }

const BATCH_SIZE = 8;
const ENDPOINT = '/api/send-certificates';

/** Uint8Array -> base64 tanpa meledakkan stack untuk PDF besar. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Subjek & badan SUDAH diinterpolasi per penerima sebelum dikirim. */
interface WireRecipient {
  email: string; nama: string; filename: string; pdfBase64: string;
  subject: string; body: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Kirim semua sertifikat per-batch ke serverless function.
 * `onProgress(done, total)` dipanggil setelah tiap batch selesai.
 */
export async function sendCertificates(
  payload: SendPayload,
  onProgress?: (done: number, total: number) => void,
): Promise<SendSummary> {
  const summary: SendSummary = { sent: [], failed: [] };
  const batches = chunk(payload.recipients, BATCH_SIZE);
  let done = 0;

  for (const batch of batches) {
    const wire: WireRecipient[] = batch.map(r => ({
      email: r.email,
      nama: r.nama,
      filename: r.filename,
      pdfBase64: bytesToBase64(r.pdfBytes),
      subject: interpolate(payload.subject, r.vars),
      body: interpolate(payload.body, r.vars),
    }));
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: wire }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SendSummary;
      summary.sent.push(...data.sent);
      summary.failed.push(...data.failed);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      for (const r of batch) summary.failed.push({ status: 'failed', email: r.email, error });
    }
    done += batch.length;
    onProgress?.(done, payload.recipients.length);
  }

  return summary;
}
