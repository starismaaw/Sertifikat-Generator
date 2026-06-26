import { useState, useEffect, Fragment } from 'react';
import { Stage, Layer, Image as KImage, Text } from 'react-konva';
import type { CertEvent } from '../../types';
import { resolveValues } from '../../lib/resolveValues';

function konvaFontStyle(weight: string): string {
  switch (weight) {
    case 'Bold':       return 'bold';
    case 'Italic':     return 'italic';
    case 'BoldItalic': return 'bold italic';
    default:           return 'normal';
  }
}

function useHtmlImage(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  return img;
}

export function CertPreviewMini({
  event,
  nama,
  peran,
  previewN,
}: {
  event: CertEvent;
  nama: string;
  peran: string;
  previewN: number;
}) {
  const img = useHtmlImage(event.background);
  const MAX_W = 380;
  const scale = Math.min(1, MAX_W / event.bgWidth);
  const canvasW = event.bgWidth * scale;
  const canvasH = event.bgHeight * scale;

  const values = resolveValues(event, { nama: nama || '(nama peserta)', peran }, previewN);

  return (
    <div>
      <div className="sg-section-eyebrow" style={{ marginBottom: 8 }}>Pratinjau Langsung</div>
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-hairline)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-soft)',
        display: 'inline-block',
        width: '100%',
      }}>
        <Stage width={canvasW} height={canvasH} style={{ display: 'block' }}>
          <Layer>
            {img && <KImage image={img} width={canvasW} height={canvasH} />}
            {event.fields.map(f => {
              const displayText = values[f.tipe] ?? '';
              return (
                <Fragment key={f.id}>
                  <Text
                    text={displayText}
                    x={f.x * scale}
                    y={f.y * scale}
                    fontFamily={f.fontFamily}
                    fontStyle={konvaFontStyle(f.fontWeight)}
                    fontSize={f.ukuran * scale}
                    fill={f.warna}
                    width={f.lebar * scale}
                    align={f.perataan}
                    listening={false}
                  />
                </Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>
      <div className="sg-hint" style={{ marginTop: 6, textAlign: 'center' }}>
        Pratinjau diperbarui otomatis saat Anda mengetik
      </div>
    </div>
  );
}
