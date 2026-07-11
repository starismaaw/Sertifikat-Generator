import { useEffect, useRef, useState } from 'react';
import type { FieldValues, PaktaTemplate } from '../../types';
import { getAcaraByLink, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
import { renderPakta } from '../../lib/pdfRenderer';
import { matchesSignerQuery } from '../../lib/signerFilter';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';
import { PaktaDocumentPreview } from './PaktaDocumentPreview';
import { SkeletonBlock, SkeletonText } from '../Skeleton';

type PageState =
  | { step: 'loading' }
  | { step: 'notFound' }
  | { step: 'pickName'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signers: SignerRow[] }
  | { step: 'signing'; template: PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }; signer: SignerRow; backgroundDataUrl: string }
  | { step: 'submitting' }
  | { step: 'success'; signerNama: string; pdfBytes: Uint8Array }
  | { step: 'error'; message: string };

type SubmitPhase = 'preparing' | 'rendering' | 'uploading' | 'saving';

const SUBMIT_PHASE_LABELS: Record<SubmitPhase, string> = {
  preparing: 'Menyiapkan dokumen…',
  rendering: 'Membuat PDF…',
  uploading: 'Mengunggah dokumen…',
  saving: 'Menyimpan status…',
};

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

export function PaktaSignPage({ slug }: { slug: string }) {
  const [state, setState] = useState<PageState>({ step: 'loading' });
  const [loadKey, setLoadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [showSudah, setShowSudah] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('preparing');
  const [sigError, setSigError] = useState('');
  const sigPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ step: 'loading' });
    (async () => {
      const template = await getAcaraByLink(slug);
      if (cancelled) return;
      if (!template) {
        setState({ step: 'notFound' });
        return;
      }
      const signers = await listSigners(template.eventId);
      if (cancelled) return;
      setState({ step: 'pickName', template, signers });
    })();
    return () => { cancelled = true; };
  }, [slug, loadKey]);

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
      setSigError('Harap gambar tanda tangan Anda terlebih dahulu.');
      return;
    }
    setSigError('');
    const { template, signer, backgroundDataUrl } = state;
    setSubmitPhase('preparing');
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
        body: JSON.stringify({ action: 'get_pdf_upload_url', signerId: signer.id, eventId: template.eventId }),
      });
      if (!urlResp.ok) {
        const err = await urlResp.json().catch(() => ({ error: 'Gagal menghubungi server' }));
        throw new Error(err.error ?? 'Gagal mendapatkan URL unggah');
      }
      const { signedUrl, pdfPath } = await urlResp.json() as { signedUrl: string; pdfPath: string };

      setSubmitPhase('rendering');
      const pdfBytes = await renderPakta(templateWithBg, values, signaturePng);

      setSubmitPhase('uploading');
      const uploadResp = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }),
      });
      if (!uploadResp.ok) throw new Error('Gagal mengunggah dokumen ke server');

      setSubmitPhase('saving');
      try {
        await updateSignerDone(signer.id, pdfPath);
      } catch (dbErr) {
        setState({
          step: 'error',
          message: `Dokumen berhasil diunggah namun gagal menyimpan status. ${(dbErr as Error).message}`,
        });
        return;
      }

      setState({ step: 'success', signerNama: signer.nama, pdfBytes });
    } catch (err) {
      setState({ step: 'error', message: (err as Error).message });
    }
  }

  function downloadSuccessPdf(signerNama: string, pdfBytes: Uint8Array) {
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pakta-${signerNama.replace(/\s+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (state.step === 'loading') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact" style={{ opacity: 0.5, marginTop: 64 }}>
          <SkeletonText width="60%" height={28} />
          <div style={{ marginTop: 16 }}>
            <SkeletonBlock height={160} />
          </div>
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
    const belum = signers.filter(s => s.status === 'belum' && matchesSignerQuery(s.nama, query));
    const sudah = signers.filter(s => s.status === 'sudah' && matchesSignerQuery(s.nama, query));
    const totalBelum = signers.filter(s => s.status === 'belum').length;
    const totalSudah = signers.filter(s => s.status === 'sudah').length;
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <h2 className="apple-h2" style={{ marginBottom: 4 }}>{template.nama}</h2>
          <p style={{ color: 'var(--color-ink-faint)', marginBottom: 24 }}>
            Pilih nama Anda untuk menandatangani Pakta Integritas
          </p>

          {signers.length > 0 && (
            <div className="apple-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                Belum menandatangani ({totalBelum})
              </p>
              <input
                type="text"
                className="apple-input"
                placeholder="Cari nama…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div className="sg-signer-list-scroll">
                {belum.length === 0 ? (
                  <p className="apple-empty">Tidak ada nama yang cocok dengan pencarian.</p>
                ) : (
                  belum.map(s => (
                    <button
                      key={s.id}
                      className="sg-signer-item"
                      onClick={() => handleSelectSigner(s)}
                    >
                      <span className="sg-signer-item-nama">{s.nama}</span>
                      {s.nip && <span className="sg-signer-item-nip">{s.nip}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {totalSudah > 0 && (
            <div className="apple-card">
              <button
                className="sg-signer-toggle"
                onClick={() => setShowSudah(v => !v)}
              >
                Sudah menandatangani ({totalSudah}) {showSudah ? '▲' : '▼'}
              </button>
              {showSudah && sudah.map(s => (
                <div key={s.id} className="sg-signer-item-done">
                  <span>✓ {s.nama}</span>
                  {s.nip && <span className="sg-signer-item-nip">{s.nip}</span>}
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
    const { template, signer, backgroundDataUrl } = state;
    const values: FieldValues = {
      nama: signer.nama,
      nip: signer.nip,
      jabatan: signer.jabatan,
      tanggal: template.tanggal,
    };
    const previewTemplate: PaktaTemplate = { ...template, background: backgroundDataUrl };
    const hasSigField = template.fields.some(f => f.tipe === 'tandaTangan');

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

          <div
            style={{
              position: 'relative',
              marginBottom: 20,
              borderRadius: 'var(--apple-radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <PaktaDocumentPreview
              ref={hasSigField ? sigPadRef : undefined}
              template={previewTemplate}
              values={values}
            />
          </div>

          {!hasSigField && (
            <div className="apple-card" style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--color-ink-faint)', fontSize: 12, marginBottom: 12 }}>
                Template ini belum memiliki area tanda tangan yang ditentukan. Gambar tanda tangan Anda di kotak berikut.
              </p>
              <SignaturePad ref={sigPadRef} hideClearButton />
            </div>
          )}

          <button
            className="apple-btn apple-btn-primary"
            style={{ width: '100%' }}
            onClick={handleSubmit}
          >
            Kirim Tanda Tangan
          </button>

          <button
            type="button"
            className="apple-btn apple-btn-danger"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => { sigPadRef.current?.clear(); setSigError(''); }}
          >
            Hapus Tanda Tangan
          </button>

          {sigError && (
            <div className="apple-error" style={{ marginTop: 12 }}>{sigError}</div>
          )}
        </div>
      </div>
    );
  }

  if (state.step === 'submitting') {
    return (
      <div className="apple-page">
        <div className="apple-page-compact">
          <div className="apple-progress" style={{ marginTop: 64 }}>
            <div className="apple-progress-phase">{SUBMIT_PHASE_LABELS[submitPhase]}</div>
            <div className="apple-progress-track">
              <div className="apple-progress-fill indeterminate" />
            </div>
          </div>
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
            <button
              className="apple-btn apple-btn-primary"
              style={{ marginTop: 24 }}
              onClick={() => downloadSuccessPdf(state.signerNama, state.pdfBytes)}
            >
              Unduh PDF
            </button>
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
