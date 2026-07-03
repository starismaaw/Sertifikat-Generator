import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

/** Target lebar goresan FINAL (satuan dokumen/PDF-point), independen dari device/scale.
 *  Sama seperti minWidth/maxWidth statis yang dipakai sebelum ada strokeScale -- supaya
 *  tampilan saat strokeScale=1 (default, mode standalone) tidak berubah sama sekali.
 *  Dikalikan `strokeScale` (scale layar-ke-dokumen dari PaktaDocumentPreview) supaya lebar
 *  goresan yang di-embed ke PDF (dibagi scale yang sama saat scaleToFit) selalu konsisten
 *  ke target ini di semua device -- lihat docs/superpowers/specs/2026-07-03-pakta-signature-stroke-width-scaling-design.md. */
const BASE_MIN_WIDTH = 1;
const BASE_MAX_WIDTH = 3;

export interface SignaturePadProps {
  /** Kanvas transparan tanpa border putih, untuk menyatu di atas gambar dokumen. */
  transparent?: boolean;
  /** Sembunyikan tombol "Hapus Tanda Tangan" bawaan (dipakai saat parent merender tombolnya sendiri). */
  hideClearButton?: boolean;
  /** Dipanggil sekali saat stroke pertama dimulai. */
  onStrokeBegin?: () => void;
  /** Style tambahan untuk elemen <canvas>. */
  style?: CSSProperties;
  /** Faktor scale layar-ke-dokumen (dari computeScale di PaktaDocumentPreview) -- lebar
   *  goresan (minWidth/maxWidth) dikalikan nilai ini supaya lebar goresan FINAL setelah
   *  di-embed ke PDF (yang membagi balik dengan scale yang sama lewat scaleToFit) tetap
   *  konsisten di semua device, tidak makin tebal di kotak kecil (mobile). Default 1
   *  (tidak ada kompensasi) -- dipakai di mode standalone (PaktaSignPage.tsx, saat
   *  template belum punya field tandaTangan) yang tidak pernah di-embed lewat field
   *  manapun, jadi tidak ada faktor scale untuk dikompensasi. */
  strokeScale?: number;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { transparent = false, hideClearButton = false, onStrokeBegin, style, strokeScale = 1 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const onStrokeBeginRef = useRef(onStrokeBegin);
  onStrokeBeginRef.current = onStrokeBegin;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      minWidth: BASE_MIN_WIDTH * strokeScale,
      maxWidth: BASE_MAX_WIDTH * strokeScale,
      minDistance: 1,
      backgroundColor: transparent ? 'rgba(255,255,255,0)' : '#fff',
    });
    padRef.current = pad;
    pad.addEventListener('beginStroke', () => onStrokeBeginRef.current?.());

    function resizeCanvas() {
      if (!canvas || !padRef.current) return;
      const strokes = padRef.current.toData();
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      padRef.current.clear();
      if (strokes.length > 0) padRef.current.fromData(strokes);
    }

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    return () => {
      observer.disconnect();
      pad.off();
    };
    // onStrokeBegin & strokeScale sengaja tidak masuk deps: pad tidak boleh dibuat ulang
    // (dan tanda tangan yang sudah digambar tidak hilang) tiap render -- onStrokeBegin
    // dibaca lewat ref, strokeScale diterapkan lewat efek terpisah di bawah (memutasi
    // properti pad langsung, bukan re-create instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent]);

  // Terapkan strokeScale ke pad yang SUDAH ada (mutasi properti minWidth/maxWidth
  // langsung -- signature_pad mendukung ini tanpa perlu re-create instance), supaya
  // perubahan scale (mis. resize kontainer) tidak menghapus goresan yang sedang digambar.
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.minWidth = BASE_MIN_WIDTH * strokeScale;
    pad.maxWidth = BASE_MAX_WIDTH * strokeScale;
  }, [strokeScale]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
    clear: () => padRef.current?.clear(),
  }));

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: transparent ? '100%' : 180,
          border: transparent ? 'none' : '1px solid var(--color-separator)',
          borderRadius: transparent ? 0 : 8,
          background: transparent ? 'transparent' : '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
          ...style,
        }}
      />
      {!hideClearButton && (
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button
            type="button"
            className="apple-btn apple-btn-secondary apple-btn-sm"
            onClick={() => padRef.current?.clear()}
          >
            Hapus Tanda Tangan
          </button>
        </div>
      )}
    </div>
  );
});
