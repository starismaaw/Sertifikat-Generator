export interface EmailTemplate { subject: string; body: string; }

/** Versi penyimpanan (client-localstorage-schema) agar aman dievolusi. */
interface StoredTemplate { v: 1; subject: string; body: string; }

export const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: 'Sertifikat {acara}',
  body:
    'Yth. {nama},\n\n' +
    'Bersama email ini kami sampaikan sertifikat dengan nomor {nomor} ' +
    'atas partisipasi Anda dalam {acara}.\n\n' +
    'Sertifikat terlampir dalam format PDF.\n\n' +
    'Hormat kami,\n' +
    'Balai P3KP Jawa III',
};

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Ganti {kunci} dengan vars[kunci]; placeholder tak dikenal dibiarkan utuh. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (whole, key) =>
    key in vars ? vars[key] : whole,
  );
}

const keyOf = (eventId: string) => `emailTemplate:${eventId}`;

export function loadTemplate(eventId: string): EmailTemplate {
  try {
    const raw = localStorage.getItem(keyOf(eventId));
    if (!raw) return DEFAULT_TEMPLATE;
    const parsed = JSON.parse(raw) as StoredTemplate;
    if (parsed.v !== 1) return DEFAULT_TEMPLATE;
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function saveTemplate(eventId: string, tpl: EmailTemplate): void {
  const stored: StoredTemplate = { v: 1, subject: tpl.subject, body: tpl.body };
  localStorage.setItem(keyOf(eventId), JSON.stringify(stored));
}
