// Hoist regex sekali (js-hoist-regexp). Sengaja sederhana: satu @, ada titik di domain,
// tanpa spasi. Validasi nyata dilakukan oleh server email; ini hanya filter UI.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
