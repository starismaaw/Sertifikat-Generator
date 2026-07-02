import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import type { Field, FieldValues, PaktaTemplate } from '../../types';
import { WEIGHT_CSS } from '../../lib/fontRegistry';
import { computeScale, computeSignatureBox, fitFontSizeCss } from '../../lib/paktaPreviewLayout';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

function textStyle(field: Field, scale: number, text: string): CSSProperties {
  const { weight, italic } = WEIGHT_CSS[field.fontWeight];
  const size = fitFontSizeCss(text, {
    fontFamily: field.fontFamily,
    fontWeight: field.fontWeight,
    ukuran: field.ukuran * scale,
    lebar: field.lebar * scale,
  });
  return {
    fontFamily: `"${field.fontFamily}"`,
    fontWeight: weight,
    fontStyle: italic ? 'italic' : 'normal',
    fontSize: size,
    color: field.warna,
    // fitFontSizeCss menghitung ukuran agar teks satu baris muat dalam field.lebar,
    // tapi pengukuran canvas vs layout DOM bisa beda sub-pixel — nowrap mencegah
    // teks pecah ke baris baru (PDF akhir selalu satu baris; lihat overflow:hidden
    // di wrapper div pemanggil untuk pengaman sisa sub-pixel).
    whiteSpace: 'nowrap',
  };
}

/** Field teks biasa (nama, nip, jabatan, tanggal, dst) — satu baris.
 *  formatter (mis. uppercase) sengaja tidak diterapkan: pdfRenderer.ts juga tidak
 *  menerapkannya untuk Pakta, supaya preview identik dengan PDF akhir. */
function TextFieldOverlay({ field, scale, text }: { field: Field; scale: number; text: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: field.x * scale,
        top: field.y * scale,
        width: field.lebar * scale,
        textAlign: field.perataan,
        overflow: 'hidden',
      }}
    >
      <span style={textStyle(field, scale, text)}>{text}</span>
    </div>
  );
}

/** Field gabungan Nama & NIP: baris nama bergaris bawah, lalu "NIP. <nip>" di bawahnya. */
function NamaNipOverlay({ field, scale, nama, nip }: { field: Field; scale: number; nama: string; nip: string }) {
  if (!nama) return null;
  const lineHeight = field.ukuran * scale * 1.4;
  const nipText = `NIP. ${nip}`;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: field.x * scale,
          top: field.y * scale,
          width: field.lebar * scale,
          textAlign: field.perataan,
          overflow: 'hidden',
        }}
      >
        <span style={{ ...textStyle(field, scale, nama), textDecoration: 'underline' }}>{nama}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: field.x * scale,
          top: field.y * scale + lineHeight,
          width: field.lebar * scale,
          textAlign: field.perataan,
          overflow: 'hidden',
        }}
      >
        <span style={textStyle(field, scale, nipText)}>{nipText}</span>
      </div>
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
                className="apple-btn apple-btn-secondary apple-btn-sm"
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
                Hapus Tanda Tangan
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);
