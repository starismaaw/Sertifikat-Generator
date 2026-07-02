import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mock vars inside vi.hoisted() to avoid TDZ errors with vi.mock hoisting
const { singleMock, selectMock, updateMock, fromMock, eqEventsMock } = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn();
  const updateMock = vi.fn();
  const eqEventsMock = vi.fn().mockReturnValue({ single: singleMock });
  const fromMock = vi.fn((table: string) => {
    if (table === 'pakta_events') {
      return {
        select: vi.fn().mockReturnValue({ eq: eqEventsMock }),
      };
    }
    if (table === 'pakta_signers') {
      return { select: selectMock, update: updateMock };
    }
    return {};
  });
  return { singleMock, selectMock, updateMock, fromMock, eqEventsMock };
});

vi.mock('../src/lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: fromMock }),
}));

import { getAcaraByLink, listSigners, updateSignerDone } from '../src/lib/paktaStore';

describe('getAcaraByLink', () => {
  beforeEach(() => {
    singleMock.mockReset();
    fromMock.mockClear();
    eqEventsMock.mockClear();
  });

  it('mengembalikan PaktaTemplate bila acara ditemukan lewat slug dan aktif', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'ev1',
        nama: 'Pakta 2026',
        tanggal: '2026-07-01',
        template_path: 'pakta-templates/ev1/bg.png',
        bg_width: 800,
        bg_height: 600,
        fields: [{ id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
          fontFamily: 'Playfair Display', fontWeight: 'Regular',
          ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' }],
        status: 'aktif',
      },
      error: null,
    });

    const result = await getAcaraByLink('pelatihan-2026');
    // WHY: fungsi harus mengembalikan PaktaTemplate (background diisi setelah template_path diketahui)
    expect(result).not.toBeNull();
    expect(result!.eventId).toBe('ev1');
    expect(result!.bgWidth).toBe(800);
    expect(result!.bgHeight).toBe(600);
    expect(result!.fields).toHaveLength(1);
    // WHY: lookup harus lewat kolom slug, bukan lagi id — ini inti dari perubahan link custom.
    expect(eqEventsMock).toHaveBeenCalledWith('slug', 'pelatihan-2026');
  });

  it('mengembalikan null bila slug tidak ditemukan (error Supabase)', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const result = await getAcaraByLink('slug-tidak-ada');
    // WHY: halaman publik harus handle acara tidak ada dengan graceful, termasuk slug lama/salah
    expect(result).toBeNull();
  });

  it('mengembalikan null bila acara berstatus ditutup', async () => {
    singleMock.mockResolvedValue({
      data: { id: 'ev2', status: 'ditutup', bg_width: 800, bg_height: 600, fields: [] },
      error: null,
    });
    const result = await getAcaraByLink('pelatihan-2026');
    // WHY: pegawai tidak boleh tanda tangan setelah acara ditutup
    expect(result).toBeNull();
  });
});

describe('listSigners', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('mengembalikan daftar signer dengan status', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { id: 's1', nama: 'Budi', nip: '123', jabatan: 'Staf', status: 'belum', signed_at: null, pdf_path: null },
        { id: 's2', nama: 'Ani',  nip: '456', jabatan: 'Kabag', status: 'sudah', signed_at: '2026-07-01T10:00:00Z', pdf_path: 'pakta-documents/ev1/s2.pdf' },
      ],
      error: null,
    });
    selectMock.mockReturnValue({ eq: eqMock });

    const signers = await listSigners('ev1');
    // WHY: daftar nama harus tampil dengan status untuk UI pilih-nama dan dashboard admin
    expect(signers).toHaveLength(2);
    expect(signers[0].status).toBe('belum');
    expect(signers[1].status).toBe('sudah');
  });

  it('mengembalikan array kosong bila Supabase error', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'error' } });
    selectMock.mockReturnValue({ eq: eqMock });
    const signers = await listSigners('ev1');
    // WHY: error Supabase tidak boleh crash halaman publik
    expect(signers).toEqual([]);
  });
});

describe('updateSignerDone', () => {
  beforeEach(() => {
    updateMock.mockReset();
  });

  it('mengirim status sudah + pdf_path + signed_at ke Supabase', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });

    await updateSignerDone('s1', 'pakta-documents/ev1/s1.pdf');

    // WHY: status harus 'sudah' agar RLS memblokir tanda tangan ulang
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sudah',
        pdf_path: 'pakta-documents/ev1/s1.pdf',
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 's1');
  });

  it('melempar error bila Supabase gagal menyimpan', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'RLS rejected' } });
    updateMock.mockReturnValue({ eq: eqMock });

    // WHY: gagal simpan harus diketahui agar UI bisa tampilkan pesan retry
    await expect(updateSignerDone('s1', 'path/s1.pdf')).rejects.toThrow();
  });
});
