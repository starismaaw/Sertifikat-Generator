import JSZip from 'jszip';

export function downloadBlob(bytes: Uint8Array, filename: string, type = 'application/pdf'): void {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bundle multiple PDFs into a single ZIP and return its bytes. */
export async function buildZip(files: { name: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.bytes);
  return zip.generateAsync({ type: 'uint8array' });
}
