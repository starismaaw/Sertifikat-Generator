import { useState, useEffect } from 'react';
import { Stage, Layer, Image as KImage, Text } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent } from '../../types';
import { FIELD_LABELS } from './FieldPalette';

const MAX_W = 700;

function useHtmlImage(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  return img;
}

export function EditorCanvas({
  event, selectedId, onSelect, onMove,
}: {
  event: CertEvent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const scale = Math.min(1, MAX_W / event.bgWidth);
  const img = useHtmlImage(event.background);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 11,
      padding: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      display: 'inline-block',
    }}>
      <Stage width={event.bgWidth * scale} height={event.bgHeight * scale}
        style={{ borderRadius: 6, overflow: 'hidden' }}>
        <Layer>
          {img && <KImage image={img} width={event.bgWidth * scale} height={event.bgHeight * scale} />}
          {event.fields.map(f => (
            <Text
              key={f.id}
              text={FIELD_LABELS[f.tipe]}
              x={f.x * scale}
              y={f.y * scale}
              fontSize={f.ukuran * scale}
              fill={f.warna}
              width={f.lebar * scale}
              align={f.perataan}
              draggable
              onClick={() => onSelect(f.id)}
              onTap={() => onSelect(f.id)}
              onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
                const x = e.target.x() / scale;
                const y = e.target.y() / scale;
                onSelect(f.id);
                onMove(f.id, x, y);
              }}
              stroke={selectedId === f.id ? '#0066cc' : undefined}
              strokeWidth={selectedId === f.id ? 0.5 : 0}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
