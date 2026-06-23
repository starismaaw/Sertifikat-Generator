import { useRef } from 'react';
import { Stage, Layer, Image as KImage, Text } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent, Field } from '../../types';
import { FIELD_LABELS } from './FieldPalette';

const MAX_W = 700; // max on-screen canvas width

function useHtmlImage(src: string): HTMLImageElement | undefined {
  const ref = useRef<HTMLImageElement>();
  if (!ref.current || ref.current.src !== src) {
    const img = new window.Image();
    img.src = src;
    ref.current = img;
  }
  return ref.current;
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

  const handleDrag = (f: Field) => (e: Konva.KonvaEventObject<DragEvent>) => {
    onMove(f.id, e.target.x() / scale, e.target.y() / scale);
  };

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
            draggable
            onClick={() => onSelect(f.id)}
            onTap={() => onSelect(f.id)}
            onDragStart={() => onSelect(f.id)}
            onDragEnd={handleDrag(f)}
            stroke={selectedId === f.id ? '#1e90ff' : undefined}
            strokeWidth={selectedId === f.id ? 0.5 : 0}
          />
        ))}
      </Layer>
    </Stage>
  );
}
