import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeServiceClient } from './_supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action as string | undefined;

  switch (action) {
    case 'get_pdf_upload_url': {
      const { signerId, eventId } = body as { signerId?: string; eventId?: string };
      if (!signerId || !eventId) {
        return res.status(400).json({ error: 'signerId dan eventId wajib diisi' });
      }

      let sb: ReturnType<typeof makeServiceClient>;
      try {
        sb = makeServiceClient();
      } catch (e) {
        return res.status(500).json({ error: (e as Error).message });
      }

      // Verifikasi signer ada dan belum TTD
      const { data: signer, error: signerErr } = await sb
        .from('pakta_signers')
        .select('id, status, event_id')
        .eq('id', signerId)
        .eq('event_id', eventId)
        .single();

      if (signerErr || !signer) {
        return res.status(404).json({ error: 'Penandatangan tidak ditemukan' });
      }
      if (signer.status === 'sudah') {
        return res.status(409).json({ error: 'Anda sudah menandatangani pakta ini' });
      }

      // Verifikasi event masih aktif
      const { data: event, error: eventErr } = await sb
        .from('pakta_events')
        .select('id, status')
        .eq('id', eventId)
        .single();

      if (eventErr || !event || event.status !== 'aktif') {
        return res.status(403).json({ error: 'Acara sudah ditutup atau tidak ditemukan' });
      }

      // Generate signed upload URL.
      // upsert: true — retry setelah upload sebelumnya terputus (tab tertutup,
      // koneksi hilang) sebelum updateSignerDone() sempat jalan akan menyisakan
      // file lama di path ini walau status di DB masih 'belum'. Tanpa upsert,
      // Storage menolak dengan "The resource already exists" dan signer terkunci
      // permanen. Status DB (dicek di atas) tetap satu-satunya sumber kebenaran
      // untuk "sudah TTD", jadi overwrite di sini aman.
      const pdfPath = `${eventId}/${signerId}.pdf`;
      const { data, error: urlErr } = await sb.storage
        .from('pakta-documents')
        .createSignedUploadUrl(pdfPath, { upsert: true });

      if (urlErr || !data) {
        return res.status(500).json({ error: urlErr?.message ?? 'Gagal membuat URL unggah' });
      }

      return res.status(200).json({ signedUrl: data.signedUrl, pdfPath });
    }

    default:
      return res.status(400).json({ error: `Action tidak dikenal: ${action}` });
  }
}
