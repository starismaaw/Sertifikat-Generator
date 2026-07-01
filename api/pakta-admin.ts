import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'crypto';
import { makeServiceClient } from './_supabase.js';

function verifyPassword(provided: string): boolean {
  const expected = process.env.PAKTA_ADMIN_PASSWORD ?? '';
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provided = (req.headers['x-pakta-admin'] as string) ?? '';
  if (!verifyPassword(provided)) {
    return res.status(401).json({ error: 'Tidak diizinkan' });
  }

  let sb: ReturnType<typeof makeServiceClient>;
  try {
    sb = makeServiceClient();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action as string | undefined;

  switch (action) {
    case 'list_events': {
      const { data, error } = await sb
        .from('pakta_events')
        .select('id, nama, tanggal, status, created_at')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ events: data });
    }

    case 'create_event': {
      const { nama, tanggal, template_path, bg_width, bg_height, fields } = body as {
        nama: string; tanggal: string; template_path?: string;
        bg_width: number; bg_height: number; fields: unknown[];
      };
      if (!nama || !tanggal) {
        return res.status(400).json({ error: 'nama dan tanggal wajib diisi' });
      }
      const { data, error } = await sb
        .from('pakta_events')
        .insert({ nama, tanggal, template_path: template_path ?? null, bg_width, bg_height, fields })
        .select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ event: data?.[0] ?? null });
    }

    case 'update_event': {
      const { id, action: _action, ...patch } = body as { id: string; action: string; [k: string]: unknown };
      if (!id) return res.status(400).json({ error: 'id acara wajib diisi' });
      const { error } = await sb.from('pakta_events').update(patch).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    case 'get_event': {
      const { id } = body as { id: string };
      if (!id) return res.status(400).json({ error: 'id acara wajib diisi' });
      const { data, error } = await sb
        .from('pakta_events')
        .select('*, pakta_signers(id, nama, nip, jabatan, status, signed_at, pdf_path)')
        .eq('id', id)
        .single();
      if (error) return res.status(404).json({ error: 'Acara tidak ditemukan' });
      return res.status(200).json({ event: data });
    }

    case 'import_signers': {
      const { event_id, signers } = body as {
        event_id: string;
        signers: { nama: string; nip?: string; jabatan?: string; data?: Record<string, string> }[];
      };
      if (!event_id || !Array.isArray(signers) || signers.length === 0) {
        return res.status(400).json({ error: 'event_id dan signers wajib diisi' });
      }
      const rows = signers.map(s => ({
        event_id,
        nama: s.nama,
        nip: s.nip ?? '',
        jabatan: s.jabatan ?? '',
        data: s.data ?? {},
      }));
      const { error } = await sb.from('pakta_signers').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ imported: rows.length });
    }

    case 'delete_event': {
      const { id } = body as { id: string };
      if (!id) return res.status(400).json({ error: 'id acara wajib diisi' });

      const { data: event } = await sb
        .from('pakta_events')
        .select('template_path')
        .eq('id', id)
        .single();

      const { data: signers } = await sb
        .from('pakta_signers')
        .select('pdf_path')
        .eq('event_id', id);

      const templatePaths = event?.template_path ? [event.template_path] : [];
      const pdfPaths = (signers ?? [])
        .map(s => s.pdf_path)
        .filter((p): p is string => !!p);

      if (templatePaths.length > 0) {
        await sb.storage.from('pakta-templates').remove(templatePaths);
      }
      if (pdfPaths.length > 0) {
        await sb.storage.from('pakta-documents').remove(pdfPaths);
      }

      const { error } = await sb.from('pakta_events').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    case 'reset_signer': {
      const { id } = body as { id: string };
      if (!id) return res.status(400).json({ error: 'id peserta wajib diisi' });

      const { data: signer } = await sb
        .from('pakta_signers')
        .select('pdf_path')
        .eq('id', id)
        .single();

      if (signer?.pdf_path) {
        await sb.storage.from('pakta-documents').remove([signer.pdf_path]);
      }

      const { error } = await sb
        .from('pakta_signers')
        .update({ status: 'belum', signed_at: null, pdf_path: null })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    case 'get_signed_url': {
      const { path } = body as { path: string };
      if (!path) return res.status(400).json({ error: 'path wajib diisi' });
      const { data, error } = await sb.storage
        .from('pakta-documents')
        .createSignedUrl(path, 3600);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ url: data.signedUrl });
    }

    case 'get_template_upload_url': {
      const { path } = body as { path: string };
      if (!path) return res.status(400).json({ error: 'path wajib diisi' });
      const { data, error } = await sb.storage
        .from('pakta-templates')
        .createSignedUploadUrl(path);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ signedUrl: data.signedUrl });
    }

    default:
      return res.status(400).json({ error: `Action tidak dikenal: ${action}` });
  }
}
