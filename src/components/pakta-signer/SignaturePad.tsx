import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import SignaturePadLib from 'signature_pad';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, { minWidth: 1, maxWidth: 3 });
    padRef.current = pad;

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
  }, []);

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: () => padRef.current?.toDataURL('image/png') ?? '',
    clear: () => padRef.current?.clear(),
  }));

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: 180,
          border: '1px solid var(--color-separator)',
          borderRadius: 8,
          background: '#fff',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      />
      <div style={{ textAlign: 'right', marginTop: 6 }}>
        <button
          type="button"
          className="apple-btn apple-btn-secondary apple-btn-sm"
          onClick={() => padRef.current?.clear()}
        >
          Hapus Tanda Tangan
        </button>
      </div>
    </div>
  );
});
