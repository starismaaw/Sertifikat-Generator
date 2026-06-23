import { useState, useEffect } from 'react';
import { Stage, Layer, Image as KImage, Text } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent } from '../../types';
import { FIELD_LABELS } from './FieldPalette';

const MAX_W = 700; // max on-screen canvas width

// BUG 1 fix: useState + useEffect so React re-renders when image loads
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
    <Stage width={event.bgWidth * scale} height={event.bgHeight * scale}
      style={{ border: '1px solid #ccc' }}>
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
            stroke={selectedId === f.id ? '#1e90ff' : undefined}
            strokeWidth={selectedId === f.id ? 0.5 : 0}
          />
        ))}
      </Layer>
    </Stage>
  );
}
