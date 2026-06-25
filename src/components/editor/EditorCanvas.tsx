import { useState, useEffect, Fragment } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CertEvent } from '../../types';
import { FIELD_LABELS } from './FieldPalette';

const MAX_W = 680;
const BOUNDARY_PADDING = 4;

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
  event, selectedId, onSelect, onMove, showGrid = false,
}: {
  event: CertEvent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  showGrid?: boolean;
}) {
  const scale = Math.min(1, MAX_W / event.bgWidth);
  const img = useHtmlImage(event.background);
  const canvasW = event.bgWidth * scale;
  const canvasH = event.bgHeight * scale;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-soft)',
        position: 'relative',
      }}>
        <Stage width={canvasW} height={canvasH}>
          <Layer>
            {img && <KImage image={img} width={canvasW} height={canvasH} />}

            {/* Grid overlay */}
            {showGrid && (() => {
              const gridSize = 34;
              const lines: React.ReactElement[] = [];
              for (let x = 0; x <= canvasW; x += gridSize) {
                lines.push(
                  <Rect key={`vg${x}`} x={x} y={0} width={1} height={canvasH}
                    fill="rgba(0,117,222,0.07)" listening={false} />
                );
              }
              for (let y = 0; y <= canvasH; y += gridSize) {
                lines.push(
                  <Rect key={`hg${y}`} x={0} y={y} width={canvasW} height={1}
                    fill="rgba(0,117,222,0.07)" listening={false} />
                );
              }
              return lines;
            })()}

            {event.fields.map(f => {
              const isSelected = selectedId === f.id;
              const sx = f.x * scale;
              const sy = f.y * scale;
              const sw = f.lebar * scale;
              const textHeight = f.ukuran * scale * 1.4;

              return (
                <Fragment key={f.id}>
                  <Rect
                    x={sx - BOUNDARY_PADDING * scale}
                    y={sy - BOUNDARY_PADDING * scale}
                    width={sw + BOUNDARY_PADDING * 2 * scale}
                    height={textHeight + BOUNDARY_PADDING * 2 * scale}
                    fill={isSelected ? 'rgba(0,117,222,0.05)' : 'rgba(0,0,0,0.01)'}
                    stroke={isSelected ? '#0075de' : 'rgba(0,117,222,0.4)'}
                    strokeWidth={isSelected ? 2 : 0.8}
                    dash={isSelected ? undefined : [4, 3]}
                    cornerRadius={3}
                    listening={false}
                  />
                  <Text
                    text={FIELD_LABELS[f.tipe]}
                    x={sx}
                    y={sy}
                    fontFamily={f.font}
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
    </div>
  );
}
