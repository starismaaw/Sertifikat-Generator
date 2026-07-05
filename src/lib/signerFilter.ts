export function matchesSignerQuery(nama: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return nama.toLowerCase().includes(q);
}

export type StatusFilter = 'semua' | 'sudah' | 'belum';

interface FilterableSigner {
  nama: string;
  nip: string;
  status: string;
}

export function filterSigners<T extends FilterableSigner>(
  signers: T[],
  statusFilter: StatusFilter,
  query: string,
): T[] {
  return signers.filter(s =>
    (statusFilter === 'semua' || s.status === statusFilter) &&
    (matchesSignerQuery(s.nama, query) || matchesSignerQuery(s.nip, query))
  );
}
