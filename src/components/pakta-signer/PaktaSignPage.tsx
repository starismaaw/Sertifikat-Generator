import { useEffect, useRef, useState } from 'react';
import type { FieldValues, PaktaTemplate } from '../../types';
import { getAcaraPakta, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
import { renderPakta } from '../../lib/pdfRenderer';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

type PageState =
  | { step: 'loading' }
  | { step: 'notFound' }
  | { step: 'pickName'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signers: SignerRow[] }
  | { step: 'signing'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signer: SignerRow; backgroundDataUrl: string }
  | { step: 'submitting' }
  | { step: 'success'; signerNama: string }
  | { step: 'error'; message: string };

async function loadBackground(templatePath: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/pakta-templates/${templatePath}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Gagal memuat gambar latar pakta');
  const blob = await resp.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function PaktaSignPage({ eventId }: { eventId: string }) {
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [loadKey, setLoadKey] = useState(0);
  const sigPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ step: 'loading' });
    (async () => {
      const [template, signers] = await Promise.all([
        getAcaraPakta(eventId),
        listSigners(eventId),
      ]);
      if (cancelled) return;
      if (!template) {
        setState({ step: 'notFound' });
        return;
      }
      setState({ step: 'pickName', template, signers });
    })();
    return () => { cancelled = true; };
  }, [eventId, loadKey]);

  async function handleSelectSigner(signer: SignerRow) {
    if (state.step !== 'pickName') return;
    if (signer.status === 'sudah') return;
    const { template } = state;
    try {
      const backgroundDataUrl = await loadBackground(template.templatePath);
      setState({ step: 'signing', template, signer, backgroundDataUrl });
    } catch (err) {
      setState({ step: 'error', message: (err as Error).message });
    }
  }

  async function handleSubmit() {
    if (state.step !== 'signing') return;
    const pad = sigPadRef.current;
    if (!pad || pad.isEmpty()) {
      alert('Harap gambar tanda tangan Anda terlebih dahulu.');
      return;
    }
    const { template, signer, backgroundDataUrl } = state;
    setState({ step: 'submitting' });

    try {
      const signaturePng = pad.toDataURL();
      const values: FieldValues = {
        nama: signer.nama,
        nip: signer.nip,
        jabatan: signer.jabatan,
        tanggal: template.tanggal,
      };
      const templateWithBg: typeof template = { ...template, background: backgroundDataUrl };

      const urlResp = await fetch('/api/pakta-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_pdf_upload_url', signerId: signer.id, eventId }),
      });
      if (!urlResp.ok) {
        const err = await urlResp.json().catch(() => ({ error: 'Gagal menghubungi server' }));
        throw new Error(err.error ?? 'Gagal mendapatkan URL unggah');
      }
      const { signedUrl, pdfPath } = await urlResp.json() as { signedUrl: string; pdfPath: string };

      const pdfBytes = await renderPakta(templateWithBg, values, signaturePng);

      const uploadResp = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }),
      });
      if (!uploadResp.ok) throw new Error('Gagal mengunggah dokumen ke server');

      try {
        await updateSignerDone(signer.id, pdfPath);
      } catch (dbErr) {
        setState({
          step: 'error',
          message: `Dokumen berhasil diunggah namun gagal menyimpan status. ${(dbErr as Error).message}`,
        });
        return;
      }

      setState({ step: 'success', signerNama: signer.nama });
    } catch (err) {
      setState({ step: 'error', message: (err as Error).message });
    }
  }

  if (state.step === 'loading') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <p style={{ color: 'var(--color-ink-faint)', textAlign: 'center', marginTop: 64 }}>
            Memuat acara…
          </p>
        </div>
      </div>
    );
  }

  if (state.step === 'notFound') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <div className="apple-card" style={{ textAlign: 'center', padding: 40 }}>
            <h2 className="apple-h2">Acara Tidak Tersedia</h2>
            <p style={{ color: 'var(--color-ink-faint)', marginTop: 8 }}>
              Acara pakta integritas ini tidak ditemukan atau sudah ditutup.
              Hubungi panitia untuk informasi lebih lanjut.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.step === 'pickName') {
    const { template, signers } = state;
    const belum = signers.filter(s => s.status === 'belum');
    const sudah = signers.filter(s => s.status === 'sudah');
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <h2 className="apple-h2" style={{ marginBottom: 4 }}>{template.nama}</h2>
          <p style={{ color: 'var(--color-ink-faint)', marginBottom: 24 }}>
            Pilih nama Anda untuk menandatangani Pakta Integritas
          </p>

          {belum.length > 0 && (
            <div className="apple-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Belum menandatangani</p>
              {belum.map(s => (
                <button
                  key={s.id}
                  className="apple-btn apple-btn-primary"
                  style={{ width: '100%', marginBottom: 8, textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => handleSelectSigner(s)}
                >
                  <span style={{ fontWeight: 600 }}>{s.nama}</span>
                  {s.nip && <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 12 }}>{s.nip}</span>}
                </button>
              ))}
            </div>
          )}

          {sudah.length > 0 && (
            <div className="apple-card">
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--color-ink-faint)' }}>
                Sudah menandatangani
              </p>
              {sudah.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-separator)',
                    color: 'var(--color-ink-faint)',
                    fontSize: 14,
                  }}
                >
                  ✓ {s.nama}
                  {s.nip && <span style={{ marginLeft: 8, fontSize: 12 }}>{s.nip}</span>}
                </div>
              ))}
            </div>
          )}

          {signers.length === 0 && (
            <p style={{ color: 'var(--color-ink-faint)', textAlign: 'center' }}>
              Belum ada peserta terdaftar untuk acara ini.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (state.step === 'signing') {
    const { template, signer } = state;
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <button
            className="apple-btn apple-btn-secondary apple-btn-sm"
            style={{ marginBottom: 20 }}
            onClick={() => setLoadKey(k => k + 1)}
          >
            ← Pilih Nama Lain
          </button>

          <div className="apple-card" style={{ marginBottom: 20 }}>
            <h2 className="apple-h2" style={{ marginBottom: 4 }}>{template.nama}</h2>
            <p style={{ color: 'var(--color-ink-faint)', fontSize: 13 }}>
              {signer.nama}
              {signer.nip ? ` — ${signer.nip}` : ''}
              {signer.jabatan ? ` — ${signer.jabatan}` : ''}
            </p>
          </div>

          <div className="apple-card" style={{ marginBottom: 20 }}>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
              Tanda Tangan Anda
            </p>
            <p style={{ color: 'var(--color-ink-faint)', fontSize: 12, marginBottom: 12 }}>
              Gambar tanda tangan di kotak di bawah ini menggunakan jari atau mouse.
            </p>
            <SignaturePad ref={sigPadRef} />
          </div>

          <button
            className="apple-btn apple-btn-primary"
            style={{ width: '100%' }}
            onClick={handleSubmit}
          >
            Kirim Tanda Tangan
          </button>
        </div>
      </div>
    );
  }

  if (state.step === 'submitting') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <p style={{ color: 'var(--color-ink-faint)', textAlign: 'center', marginTop: 64 }}>
            Mengirim tanda tangan…
          </p>
        </div>
      </div>
    );
  }

  if (state.step === 'success') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <div className="apple-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 className="apple-h2">Tanda Tangan Berhasil</h2>
            <p style={{ color: 'var(--color-ink-faint)', marginTop: 8 }}>
              Terima kasih, <strong>{state.signerNama}</strong>.<br />
              Pakta Integritas Anda telah berhasil ditandatangani dan disimpan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="apple-page">
      <div className="apple-page-compact">
        <div className="apple-card">
          <p className="apple-error" style={{ marginBottom: 16 }}>{state.message}</p>
          <button
            className="apple-btn apple-btn-secondary"
            onClick={() => setLoadKey(k => k + 1)}
          >
            Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}
