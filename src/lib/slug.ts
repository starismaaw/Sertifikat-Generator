const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 60;
const MIN_SLUG_LENGTH = 3;

/** Ubah teks bebas jadi slug URL: huruf kecil, angka, dan tanda hubung saja. */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

/** Validasi format slug: huruf kecil/angka/tanda hubung, 3-60 karakter. */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= MIN_SLUG_LENGTH &&
    slug.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}
