import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import type { PaktaTemplate, FieldValues } from '../src/types';

vi.mock('../src/components/pakta-signer/SignaturePad', () => ({
  SignaturePad: forwardRef(function MockSignaturePad(
    props: { onStrokeBegin?: () => void },
    ref: React.Ref<{ isEmpty: () => boolean; toDataURL: () => string; clear: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({
      isEmpty: () => true,
      toDataURL: () => 'data:image/png;base64,mock',
      clear: vi.fn(),
    }));
    return <div data-testid="mock-signature-pad" onClick={() => props.onStrokeBegin?.()} />;
  }),
}));

import { PaktaDocumentPreview } from '../src/components/pakta-signer/PaktaDocumentPreview';

const template: PaktaTemplate = {
  background: 'data:image/png;base64,bg',
  bgWidth: 1000,
  bgHeight: 1000,
  fields: [
    {
      id: 'f1', tipe: 'jabatan', x: 50, y: 50, lebar: 300,
      fontFamily: 'Inter', fontWeight: 'Regular', ukuran: 24,
      warna: '#000000', perataan: 'left', formatter: 'none',
    },
    {
      id: 'f2', tipe: 'namaNip', x: 50, y: 120, lebar: 300,
      fontFamily: 'Inter', fontWeight: 'Regular', ukuran: 20,
      warna: '#000000', perataan: 'left', formatter: 'none',
    },
    {
      id: 'f3', tipe: 'tandaTangan', x: 400, y: 400, lebar: 100, tinggi: 50,
      fontFamily: 'Inter', fontWeight: 'Regular', ukuran: 16,
      warna: '#000000', perataan: 'left', formatter: 'none',
    },
  ],
};

const values: FieldValues = {
  nama: 'Budi Santoso',
  nip: '198001012020121001',
  jabatan: 'Kepala Balai',
};

beforeEach(() => vi.clearAllMocks());

describe('PaktaDocumentPreview', () => {
  it('merender field jabatan dan namaNip (nama bergaris bawah + baris NIP) dengan nilai asli', () => {
    render(<PaktaDocumentPreview template={template} values={values} />);
    expect(screen.getByText('Kepala Balai')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('NIP. 198001012020121001')).toBeInTheDocument();
  });

  it('tidak merender baris namaNip bila nilai nama kosong', () => {
    render(<PaktaDocumentPreview template={template} values={{ jabatan: 'Kepala Balai' }} />);
    expect(screen.queryByText('NIP. 198001012020121001')).not.toBeInTheDocument();
  });

  it('tidak merender field bertipe lain bila nilainya kosong', () => {
    render(<PaktaDocumentPreview template={template} values={{ nama: 'Budi Santoso', nip: '123' }} />);
    expect(screen.queryByText('Kepala Balai')).not.toBeInTheDocument();
  });

  it('menampilkan hint "Tanda tangan di sini" sebelum menggambar, dan menyembunyikannya setelah stroke pertama', () => {
    render(<PaktaDocumentPreview template={template} values={values} />);
    expect(screen.getByText('Tanda tangan di sini')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-signature-pad'));
    expect(screen.queryByText('Tanda tangan di sini')).not.toBeInTheDocument();
  });

  it('menampilkan tombol "Hapus Tanda Tangan" hanya setelah ada tanda tangan', () => {
    render(<PaktaDocumentPreview template={template} values={values} />);
    expect(screen.queryByRole('button', { name: 'Hapus Tanda Tangan' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-signature-pad'));
    expect(screen.getByRole('button', { name: 'Hapus Tanda Tangan' })).toBeInTheDocument();
  });
});
