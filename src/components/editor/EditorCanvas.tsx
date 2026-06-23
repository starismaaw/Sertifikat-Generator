import { useState, useEffect, Fragment } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent } from '../../types';
import { FIELD_LABELS } from './FieldPalette';

const MAX_W = 700;
const BOUNDARY_PADDING = 4; // px padding inside the boundary rect

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
          {event.fields.map(f => {
            const isSelected = selectedId === f.id;
            const sx = f.x * scale;
            const sy = f.y * scale;
            const sw = f.lebar * scale;
            // Estimate text height from font size (proportional)
            const textHeight = f.ukuran * scale * 1.4;
            return (
              <Fragment key={f.id}>
                {/* Width boundary indicator */}
                <Rect
                  x={sx - BOUNDARY_PADDING * scale}
                  y={sy - BOUNDARY_PADDING * scale}
                  width={sw + BOUNDARY_PADDING * 2 * scale}
                  height={textHeight + BOUNDARY_PADDING * 2 * scale}
                  fill={isSelected ? 'rgba(0,102,204,0.06)' : 'rgba(0,0,0,0.02)'}
                  stroke={isSelected ? '#0066cc' : 'rgba(0,0,0,0.12)'}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  dash={isSelected ? [4, 3] : [3, 4]}
                  cornerRadius={3}
                  listening={false}
                />
                {/* Bottom edge marker — subtly shows where the width ends */}
                <Rect
                  x={sx}
                  y={sy + textHeight - 1}
                  width={sw}
                  height={1}
                  fill={isSelected ? 'rgba(0,102,204,0.3)' : 'rgba(0,0,0,0.08)'}
                  listening={false}
                />
                <Text
                  text={FIELD_LABELS[f.tipe]}
                  x={sx}
                  y={sy}
                  fontSize={f.ukuran * scale}
                  fill={f.warna}
                  width={sw}
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
                />
              </Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
