import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Field, FieldValues, PaktaTemplate } from '../../types';
import { WEIGHT_CSS } from '../../lib/fontRegistry';
import { computeScale, computeSignatureBox, fitFontSizeCss, measureFontAscent } from '../../lib/paktaPreviewLayout';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5 3.5l.5 8M9 3.5l-.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Satu baris teks field, dirender sebagai SVG <text> diposisikan lewat baseline
 * (bukan <div>/<span> HTML biasa). Ini penting: CSS line-height/kotak baris TIDAK
 * bisa dipakai untuk menempatkan glyph presisi di field.y (top kotak) — font
 * seperti Inter punya metrik ascent+descent bawaan jauh lebih besar dari 1em,
 * jadi walau line-height:1 diset, teks tetap tampak turun beberapa px (dikonfirmasi
 * manual: gap tidak berubah sama sekali walau line-height diubah 1.6 -> 1). SVG
 * text baseline (y = ascent yang diukur canvas) presisi 1:1, sama seperti Konva
 * Text & pdfRenderer.ts (keduanya ascent-based, bukan line-box-based).
 *
 * formatter (mis. uppercase) sengaja tidak diterapkan: pdfRenderer.ts juga tidak
 * menerapkannya untuk Pakta, supaya preview identik dengan PDF akhir.
 */
function FieldLine({
  field, scale, text, top, underline,
}: {
  field: Field; scale: number; text: string; top: number; underline?: boolean;
}) {
  if (!text) return null;
  const { weight, italic } = WEIGHT_CSS[field.fontWeight];
  const w = field.lebar * scale;
  const fontSize = fitFontSizeCss(text, {
    fontFamily: field.fontFamily,
    fontWeight: field.fontWeight,
    ukuran: field.ukuran * scale,
    lebar: w,
  });
  const ascent = measureFontAscent(field.fontFamily, field.fontWeight, fontSize);
  const x = field.perataan === 'center' ? w / 2 : field.perataan === 'right' ? w : 0;
  const textAnchor = field.perataan === 'center' ? 'middle' : field.perataan === 'right' ? 'end' : 'start';
  return (
    <svg
      style={{ position: 'absolute', left: field.x * scale, top, overflow: 'visible' }}
      width={w}
      height={fontSize * 2}
    >
      <text
        x={x}
        y={ascent}
        textAnchor={textAnchor}
        fontFamily={`"${field.fontFamily}"`}
        fontWeight={weight}
        fontStyle={italic ? 'italic' : 'normal'}
        fontSize={fontSize}
        fill={field.warna}
        textDecoration={underline ? 'underline' : undefined}
      >
        {text}
      </text>
    </svg>
  );
}

/** Field teks biasa (nama, nip, jabatan, tanggal, dst) — satu baris. */
function TextFieldOverlay({ field, scale, text }: { field: Field; scale: number; text: string }) {
  return <FieldLine field={field} scale={scale} text={text} top={field.y * scale} />;
}

/** Field gabungan Nama & NIP: baris nama bergaris bawah, lalu "NIP. <nip>" di bawahnya. */
function NamaNipOverlay({ field, scale, nama, nip }: { field: Field; scale: number; nama: string; nip: string }) {
  if (!nama) return null;
  const lineHeight = field.ukuran * scale * 1.4;
  const nipText = `NIP. ${nip}`;
  return (
    <>
      <FieldLine field={field} scale={scale} text={nama} top={field.y * scale} underline />
      <FieldLine field={field} scale={scale} text={nipText} top={field.y * scale + lineHeight} />
    </>
  );
}

export interface PaktaDocumentPreviewProps {
  template: PaktaTemplate;
  values: FieldValues;
}

export const PaktaDocumentPreview = forwardRef<SignaturePadHandle, PaktaDocumentPreviewProps>(
  function PaktaDocumentPreview({ template, values }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const innerSigRef = useRef<SignaturePadHandle>(null);
    const [scale, setScale] = useState(1);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      function update() {
        const width = el!.offsetWidth;
        setScale(width > 0 ? computeScale(width, template.bgWidth) : 1);
      }
      const observer = new ResizeObserver(update);
      observer.observe(el);
      update();
      return () => observer.disconnect();
    }, [template.bgWidth]);

    useImperativeHandle(ref, () => ({
      isEmpty: () => innerSigRef.current?.isEmpty() ?? true,
      toDataURL: () => innerSigRef.current?.toDataURL() ?? '',
      clear: () => {
        innerSigRef.current?.clear();
        setHasSignature(false);
      },
    }));

    const sigField = template.fields.find(f => f.tipe === 'tandaTangan');
    const sigBox = sigField ? computeSignatureBox(sigField, scale, template.bgWidth, template.bgHeight) : null;

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
        <img
          src={template.background}
          alt="Pratinjau dokumen Pakta Integritas"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />

        {template.fields.map(field => {
          if (field.tipe === 'tandaTangan') return null;
          if (field.tipe === 'namaNip') {
            return (
              <NamaNipOverlay
                key={field.id}
                field={field}
                scale={scale}
                nama={(values.nama ?? '').toString()}
                nip={(values.nip ?? '').toString()}
              />
            );
          }
          return (
            <TextFieldOverlay
              key={field.id}
              field={field}
              scale={scale}
              text={(values[field.tipe] ?? '').toString()}
            />
          );
        })}

        {sigBox && (
          <div
            style={{
              position: 'absolute',
              left: sigBox.left,
              top: sigBox.top,
              width: sigBox.width,
              height: sigBox.height,
              border: hasSignature ? 'none' : '1px dashed var(--color-separator)',
              borderRadius: 8,
            }}
          >
            <SignaturePad
              ref={innerSigRef}
              transparent
              hideClearButton
              onStrokeBegin={() => setHasSignature(true)}
            />
            {!hasSignature && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: 'var(--color-ink-faint)',
                  pointerEvents: 'none',
                }}
              >
                Tanda tangan di sini
              </span>
            )}
            {hasSignature && (
              <button
                type="button"
                className="sg-btn sg-btn-icon"
                title="Hapus Tanda Tangan"
                aria-label="Hapus Tanda Tangan"
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 4,
                  background: 'rgba(255,255,255,0.85)',
                }}
                onClick={() => {
                  innerSigRef.current?.clear();
                  setHasSignature(false);
                }}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);
