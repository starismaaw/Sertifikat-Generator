import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

export interface SignaturePadProps {
  /** Kanvas transparan tanpa border putih, untuk menyatu di atas gambar dokumen. */
  transparent?: boolean;
  /** Sembunyikan tombol "Hapus Tanda Tangan" bawaan (dipakai saat parent merender tombolnya sendiri). */
  hideClearButton?: boolean;
  /** Dipanggil sekali saat stroke pertama dimulai. */
  onStrokeBegin?: () => void;
  /** Style tambahan untuk elemen <canvas>. */
  style?: CSSProperties;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { transparent = false, hideClearButton = false, onStrokeBegin, style },
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
      minWidth: 1,
      maxWidth: 3,
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
    // onStrokeBegin sengaja tidak masuk deps: dibaca lewat ref supaya pad tidak
    // dibuat ulang (dan tanda tangan yang sudah digambar tidak hilang) tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent]);

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
