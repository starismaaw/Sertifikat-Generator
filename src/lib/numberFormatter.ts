const ROMAN: [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(n: number): string {
  let out = '';
  let rem = n;
  for (const [val, sym] of ROMAN) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

/**
 * Build a certificate number string from a pattern.
 * Supported placeholders: {n} (sequence, zero-padded), {bulan} (Roman month),
 * {tahun} (full year). Unknown {tokens} are left literal.
 */
export function buildCertNumber(
  pattern: string,
  n: number,
  padding: number,
  date: Date,
): string {
  const padded = String(n).padStart(padding, '0');
  return pattern.replace(/\{(\w+)\}/g, (whole, token: string) => {
    switch (token) {
      case 'n': return padded;
      case 'bulan': return toRoman(date.getMonth() + 1);
      case 'tahun': return String(date.getFullYear());
      default: return whole;
    }
  });
}
