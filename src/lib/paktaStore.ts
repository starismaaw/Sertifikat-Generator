import type { PaktaTemplate } from '../types';
import { getSupabaseClient } from './supabaseClient';

export interface SignerRow {
  id: string;
  event_id: string;
  nama: string;
  nip: string;
  jabatan: string;
  data: Record<string, string>;
  status: 'belum' | 'sudah';
  signed_at: string | null;
  pdf_path: string | null;
}

/**
 * Ambil data acara pakta untuk halaman tanda tangan publik.
 * Mengembalikan null bila acara tidak ditemukan atau sudah ditutup.
 * Catatan: background belum diisi di sini (diunduh terpisah di Plan 4).
 */
export async function getAcaraPakta(id: string): Promise<
  (PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }) | null
> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('pakta_events')
    .select('id, nama, tanggal, template_path, bg_width, bg_height, fields, status')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  if (data.status === 'ditutup') return null;

  return {
    eventId: data.id,
    nama: data.nama,
    tanggal: data.tanggal,
    templatePath: data.template_path ?? '',
    background: '',    // diisi Plan 4 setelah unduh dari Storage
    bgWidth: data.bg_width,
    bgHeight: data.bg_height,
    fields: data.fields ?? [],
  };
}

/** Ambil semua penandatangan untuk satu acara (untuk UI pilih nama). */
export async function listSigners(eventId: string): Promise<SignerRow[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('pakta_signers')
    .select('id, event_id, nama, nip, jabatan, data, status, signed_at, pdf_path')
    .eq('event_id', eventId);

  if (error || !data) return [];
  return data as SignerRow[];
}

/**
 * Tandai signer sudah menandatangani + simpan path PDF.
 * RLS di Supabase memblokir update bila status sudah 'sudah'.
 */
export async function updateSignerDone(signerId: string, pdfPath: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('pakta_signers')
    .update({
      status: 'sudah',
      pdf_path: pdfPath,
      signed_at: new Date().toISOString(),
    })
    .eq('id', signerId);

  if (error) throw new Error(`Gagal menyimpan tanda tangan: ${error.message}`);
}
