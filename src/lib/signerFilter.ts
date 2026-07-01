export function matchesSignerQuery(nama: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return nama.toLowerCase().includes(q);
}
